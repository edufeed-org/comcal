<script>
	import { onMount } from 'svelte';
	import {
		articleTimelineLoader,
		ambTimelineLoader,
		feedTargetedPublicationsLoader,
		calendarTimelineLoader,
		addressLoader,
		timedPool
	} from '$lib/loaders';
	import { ambSearchLoader } from '$lib/loaders/amb-search.js';
	import { hasActiveFilters, createEmptyFilters } from '$lib/helpers/educational/searchQueryBuilder.js';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { runtimeConfig } from '$lib/stores/config.svelte.js';
	import { createTimelineLoader } from 'applesauce-loaders/loaders';
	import {
		getEducationalRelays,
		getArticleRelays,
		getCalendarRelays,
		getCommunikeyRelays
	} from '$lib/helpers/relay-helper.js';
	import { TimelineModel } from 'applesauce-core/models';
	import { AMBResourceModel, GlobalCalendarEventModel } from '$lib/models';
	import { useProfileMap } from '$lib/stores/profile-map.svelte.js';
	import { getTagValue } from 'applesauce-core/helpers';
	import { getArticlePublished } from 'applesauce-common/helpers';
	import ArticleCard from '$lib/components/article/ArticleCard.svelte';
	import AMBResourceCard from '$lib/components/educational/AMBResourceCard.svelte';
	import CalendarEventCard from '$lib/components/calendar/CalendarEventCard.svelte';
	import CommunityFilterDropdown from '$lib/components/feed/CommunityFilterDropdown.svelte';
	import RelayFilterDropdown from '$lib/components/feed/RelayFilterDropdown.svelte';
	import { getAppRelaysForCategory } from '$lib/services/app-relay-service.svelte.js';
	import { getSeenRelays } from 'applesauce-core/helpers/relays';
	import { normalizeURL } from 'applesauce-core/helpers';
	import CommunikeyCard from '$lib/components/CommunikeyCard.svelte';
	import ContentCardSkeleton from '$lib/components/shared/ContentCardSkeleton.svelte';
	import LearningContentFilters from '$lib/components/educational/LearningContentFilters.svelte';
	import { SearchIcon } from '$lib/components/icons';
	import { timer, debounceTime } from 'rxjs';
	import { takeUntil } from 'rxjs/operators';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { updateQueryParams, parseFeedFilters } from '$lib/helpers/urlParams.js';
	import { encodeEventToNaddr } from '$lib/helpers/nostrUtils.js';
	import { useJoinedCommunitiesList } from '$lib/stores/joined-communities-list.svelte.js';
	import { useAllCommunities } from '$lib/stores/all-communities.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import {
		buildContentToCommunityMap,
		filterContentByCommunity,
		getCommunityFilterOptions
	} from '$lib/helpers/communityContent.js';
	import * as m from '$lib/paraglide/messages';

	// State management
	// Use $state.raw() for event data arrays to avoid deep proxying.
	// Svelte 5's $state() proxy breaks Symbol-based properties (e.g. getSeenRelays)
	// because Set.prototype.has() fails on proxied Sets.
	// These arrays are always replaced entirely, so $state.raw() preserves reactivity.
	let articles = $state.raw(/** @type {any[]} */ ([]));
	let ambResources = $state.raw(/** @type {any[]} */ ([]));
	let calendarEvents = $state.raw(/** @type {any[]} */ ([]));
	let targetedPubs = $state.raw(/** @type {any[]} */ ([]));
	const getAuthorProfiles = useProfileMap(() => new Set([
		...articles.map((a) => a.pubkey),
		...ambResources.map((r) => r.pubkey),
		...calendarEvents.map((e) => e.pubkey),
		...communities.map((c) => getTagValue(c, 'd') || c.pubkey)
	]));
	const getCommunityProfiles = useProfileMap(() =>
		allCommunities.map((c) => c.pubkey)
	);
	let authorProfiles = $derived(getAuthorProfiles());
	let communityProfiles = $derived(getCommunityProfiles());
	let isLoading = $state(true);
	let isLoadingMore = $state(false);
	let hasMoreArticles = $state(true);
	let hasMoreAMB = $state(true);
	let hasMoreCalendarEvents = $state(true);
	let sortBy = $state('newest');
	let searchQuery = $state('');

	// Debounced search for main content filtering (learning tab has its own debouncing)
	let debouncedMainSearchQuery = $state('');
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let mainSearchDebounceTimer;

	// Lazy rendering - track which items are visible
	let visibleItemIds = $state(/** @type {Set<string>} */ (new Set()));
	/** @type {IntersectionObserver | undefined} */
	let cardObserver;

	// Learning content filter state
	/** @type {import('$lib/helpers/educational/searchQueryBuilder.js').SearchFilters} */
	let learningFilters = $state(createEmptyFilters());
	let isLearningSearchActive = $state(false);
	let learningSearchResults = $state(/** @type {import('nostr-tools').Event[]} */ ([]));
	/** @type {import('rxjs').Subscription | null} */
	let currentSearchSubscription = $state(null);
	/** @type {ReturnType<typeof setTimeout> | null} */
	let searchDebounceTimer = null;

	// Get current locale
	const locale = $derived(getLocale());

	// Search input reference for auto-focus
	let searchInputRef = $state(/** @type {HTMLInputElement | null} */ (null));

	// Debounced search text for learning tab (triggers NIP-50 search)
	let debouncedSearchQuery = $state('');

	// Valid content types
	const VALID_CONTENT_TYPES = ['all', 'events', 'learning', 'articles', 'communities'];

	// Initialize from URL params
	const initialFilters = parseFeedFilters($page.url.searchParams);
	let selectedTags = $state(/** @type {string[]} */ (initialFilters.tags));
	let communityFilter = $state(/** @type {string | null} */ (initialFilters.community));
	let relayFilter = $state(/** @type {string | null} */ (null));

	// Initialize contentType from URL, with validation
	const initialContentType = VALID_CONTENT_TYPES.includes(initialFilters.type) ? initialFilters.type : 'all';
	let contentType = $state(initialContentType); // 'events', 'learning', 'articles', 'communities', 'all'

	// Relay filter: map current tab to relay category
	const tabRelayCategory = $derived(
		contentType === 'events' ? 'calendar' :
		contentType === 'learning' ? 'educational' :
		contentType === 'articles' ? 'longform' : null
	);
	const availableRelays = $derived(
		tabRelayCategory ? getAppRelaysForCategory(tabRelayCategory) : []
	);

	// Active user state
	let activeUser = $state(manager.active);
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

	// Debounce search query for main content (not learning tab which has its own)
	$effect(() => {
		// Learning tab has its own debouncing, so sync immediately
		if (contentType === 'learning') {
			debouncedMainSearchQuery = searchQuery;
			return;
		}

		clearTimeout(mainSearchDebounceTimer);
		mainSearchDebounceTimer = setTimeout(() => {
			debouncedMainSearchQuery = searchQuery;
		}, 300);

		return () => clearTimeout(mainSearchDebounceTimer);
	});

	// IntersectionObserver for lazy rendering cards
	$effect(() => {
		cardObserver = new IntersectionObserver(
			(entries) => {
				let changed = false;
				for (const entry of entries) {
					const id = entry.target.getAttribute('data-item-id');
					if (!id) continue;

					if (entry.isIntersecting && !visibleItemIds.has(id)) {
						visibleItemIds.add(id);
						changed = true;
					}
					// Keep items rendered once visible to avoid re-render costs
				}
				if (changed) {
					visibleItemIds = new Set(visibleItemIds);
				}
			},
			{ rootMargin: '400px' } // Pre-render items 400px before viewport
		);

		return () => cardObserver?.disconnect();
	});

	/**
	 * Svelte action for observing card visibility
	 * @param {HTMLElement} node
	 * @param {string} itemId
	 */
	function observeCard(node, itemId) {
		node.setAttribute('data-item-id', itemId);
		cardObserver?.observe(node);
		return {
			destroy: () => cardObserver?.unobserve(node),
			update: (/** @type {string} */ newId) => {
				node.setAttribute('data-item-id', newId);
			}
		};
	}

	// Community hooks
	const getJoinedCommunities = useJoinedCommunitiesList();
	const getAllCommunities = useAllCommunities();
	const joinedCommunities = $derived(getJoinedCommunities());
	const allCommunities = $derived(getAllCommunities());

	// Communities state for the Communities tab
	let communities = $state(/** @type {any[]} */ ([]));
	let hasMoreCommunities = $state(true);
	let displayedCommunitiesCount = $state(20);

	// Get joined community pubkeys for filtering
	const joinedCommunityPubkeys = $derived(
		joinedCommunities.map((rel) => getTagValue(rel, 'd')).filter(Boolean)
	);

	// Build content-to-community map from targeted publications
	let contentToCommunityMap = $state(/** @type {Map<string, string[]>} */ (new Map()));
	$effect(() => {
		contentToCommunityMap = buildContentToCommunityMap(targetedPubs);
	});

	// Get community options for dropdown
	const communityOptions = $derived(
		getCommunityFilterOptions(allCommunities, joinedCommunities, communityProfiles)
	);

	// Watch for URL changes and sync to state
	$effect(() => {
		const urlTags = $page.url.searchParams.getAll('tags');
		const sortedUrlTags = [...urlTags].sort();
		const sortedSelectedTags = [...selectedTags].sort();

		if (JSON.stringify(sortedUrlTags) !== JSON.stringify(sortedSelectedTags)) {
			selectedTags = urlTags;
		}

		const urlCommunity = $page.url.searchParams.get('community') || null;
		if (urlCommunity !== communityFilter) {
			communityFilter = urlCommunity;
		}

		// Sync content type from URL
		const urlType = $page.url.searchParams.get('type') || 'all';
		if (VALID_CONTENT_TYPES.includes(urlType) && urlType !== contentType) {
			contentType = urlType;
		}
	});

	/**
	 * Handle content type tab change
	 * @param {string} newType
	 */
	function handleContentTypeChange(newType) {
		contentType = newType;
		relayFilter = null;
		// Update URL - use null for 'all' to keep URL clean
		updateQueryParams($page.url.searchParams, { type: newType === 'all' ? null : newType });

		// Reset learning filters when switching away from learning tab
		if (newType !== 'learning') {
			learningFilters = createEmptyFilters();
			isLearningSearchActive = false;
			learningSearchResults = [];
			if (currentSearchSubscription) {
				currentSearchSubscription.unsubscribe();
				currentSearchSubscription = null;
			}
		}
	}

	/**
	 * Handle learning content filter changes
	 * @param {import('$lib/helpers/educational/searchQueryBuilder.js').SearchFilters} filters
	 */
	function handleLearningFilterChange(filters) {
		learningFilters = filters;
		
		// Cancel any pending search
		if (currentSearchSubscription) {
			currentSearchSubscription.unsubscribe();
			currentSearchSubscription = null;
		}

		// Check if we should use NIP-50 search
		if (hasActiveFilters(filters)) {
			isLearningSearchActive = true;
			learningSearchResults = []; // Clear previous results
			
			// Start NIP-50 search - accumulate individual events into array
			currentSearchSubscription = ambSearchLoader(filters, 100).subscribe({
				next: (/** @type {import('nostr-tools').Event} */ event) => {
					// Accumulate events as they arrive (createTimelineLoader emits one at a time)
					// The events are already added to eventStore by the loader
					learningSearchResults = [...learningSearchResults, event];
				},
				error: (error) => {
					console.error('🔍 Learning search error:', error);
					isLearningSearchActive = false;
				},
				complete: () => {}
			});
		} else {
			// No active filters, use normal timeline loading
			isLearningSearchActive = false;
			learningSearchResults = [];
		}
	}

	// Batch sizes for loading
	const BATCH_SIZE = 20;
	const CALENDAR_BATCH_SIZE = 40; // Matches limit in calendarTimelineLoader
	const BATCH_TIMEOUT = 4_000; // Safety timeout per batch (timedPool is 2s + buffer)

	// Step 1: Create stateful loaders
	const articleLoader = articleTimelineLoader(BATCH_SIZE);
	const ambLoader = ambTimelineLoader(BATCH_SIZE);
	const calendarLoader = calendarTimelineLoader();
	const targetedPubsLoader = feedTargetedPublicationsLoader(200);

	// Step 2: Initial load (subscriptions captured for cleanup on destroy)
	const initialArticleSub = articleLoader().subscribe({
		complete: () => { isLoading = false; },
		error: (/** @type {any} */ error) => {
			console.error('🔍 Discover: Article loader error:', error);
			isLoading = false;
		}
	});

	const initialAmbSub = ambLoader().subscribe({
		complete: () => { isLoading = false; },
		error: (/** @type {any} */ error) => {
			console.error('🔍 Discover: AMB loader error:', error);
			isLoading = false;
		}
	});

	const initialCalendarSub = calendarLoader().subscribe({
		complete: () => { isLoading = false; },
		error: (/** @type {any} */ error) => {
			console.error('🔍 Discover: Calendar loader error:', error);
			isLoading = false;
		}
	});

	const initialTargetedPubsSub = targetedPubsLoader().subscribe({
		error: (/** @type {any} */ error) => {
			console.error('🔍 Discover: Targeted publications loader error:', error);
		}
	});

	// Supplemental relay loading: when user override relays arrive (kind 30002),
	// the initial loaders above won't include them because they resolved relays
	// at mount time before the async cache populated. This $effect watches for
	// relay changes and creates additional loaders for any new relays.
	const initialEducationalRelays = new Set(getEducationalRelays());
	const initialArticleRelays = new Set(getArticleRelays());
	const initialCalendarRelays = new Set(getCalendarRelays());
	const initialCommunikeyRelays = new Set(getCommunikeyRelays());

	$effect(() => {
		/** @type {import('rxjs').Subscription[]} */
		const supplementalSubs = [];

		const currentEducational = getEducationalRelays();
		const newEducational = currentEducational.filter((r) => !initialEducationalRelays.has(r));
		if (newEducational.length > 0) {
			newEducational.forEach((r) => initialEducationalRelays.add(r));
			const loader = createTimelineLoader(
				timedPool, newEducational, { kinds: [30142] }, { eventStore, limit: BATCH_SIZE }
			);
			supplementalSubs.push(loader().subscribe());
		}

		const currentArticle = getArticleRelays();
		const newArticle = currentArticle.filter((r) => !initialArticleRelays.has(r));
		if (newArticle.length > 0) {
			newArticle.forEach((r) => initialArticleRelays.add(r));
			const loader = createTimelineLoader(
				timedPool, newArticle, { kinds: [30023] }, { eventStore, limit: BATCH_SIZE }
			);
			supplementalSubs.push(loader().subscribe());
		}

		const currentCalendar = getCalendarRelays();
		const newCalendar = currentCalendar.filter((r) => !initialCalendarRelays.has(r));
		if (newCalendar.length > 0) {
			newCalendar.forEach((r) => initialCalendarRelays.add(r));
			const loader = createTimelineLoader(
				timedPool, newCalendar, { kinds: [31922, 31923], limit: 40 }, { eventStore }
			);
			supplementalSubs.push(loader().subscribe());
		}

		const currentCommunikey = getCommunikeyRelays();
		const newCommunikey = currentCommunikey.filter((r) => !initialCommunikeyRelays.has(r));
		if (newCommunikey.length > 0) {
			newCommunikey.forEach((r) => initialCommunikeyRelays.add(r));
			const loader = createTimelineLoader(
				timedPool, newCommunikey,
				{ kinds: [30222], '#k': ['30023', '30142', '31922', '31923'] },
				{ eventStore, limit: 200 }
			);
			supplementalSubs.push(loader().subscribe());
		}

		return () => {
			supplementalSubs.forEach((sub) => sub.unsubscribe());
		};
	});

	// Subscribe to targeted publications model (debounced via RxJS)
	const targetedPubsModelSub = eventStore
		.model(TimelineModel, { kinds: [30222], '#k': ['30023', '30142', '31922', '31923'] })
		.pipe(debounceTime(100))
		.subscribe((pubs) => {
			targetedPubs = pubs || [];
		});

	// Subscribe to articles (debounced via RxJS)
	const articleModelSub = eventStore
		.model(TimelineModel, { kinds: [30023] })
		.pipe(debounceTime(100))
		.subscribe((timeline) => {
			articles = timeline || [];
			isLoading = false;
		});

	// Subscribe to AMB resources (debounced via RxJS)
	const ambModelSub = /** @type {import('rxjs').Observable<any[]>} */ (
		eventStore.model(AMBResourceModel, [])
	).pipe(debounceTime(100))
		.subscribe((resources) => {
			ambResources = resources || [];
			isLoading = false;
		});

	// Subscribe to calendar events (debounced via RxJS)
	const calendarModelSub = /** @type {import('rxjs').Observable<any[]>} */ (
		eventStore.model(GlobalCalendarEventModel, [])
	).pipe(debounceTime(100))
		.subscribe((events) => {
			calendarEvents = events || [];
			isLoading = false;
		});

	// Community-specific calendar event loader subscriptions
	// Note: Plain let (not $state) to avoid infinite loops in $effect
	/** @type {import('rxjs').Subscription | undefined} */
	let communityCalendarSub;
	/** @type {import('rxjs').Subscription | undefined} */
	let communityTargetedPubsSub;
	/** @type {import('rxjs').Subscription | undefined} */
	let communityReferencedEventsSub;

	// Load community-specific calendar events when community filter changes
	$effect(() => {
		// Clean up previous subscriptions
		communityCalendarSub?.unsubscribe();
		communityTargetedPubsSub?.unsubscribe();
		communityReferencedEventsSub?.unsubscribe();

		// Only load if a specific community is selected (not 'joined' or null)
		if (communityFilter && communityFilter !== 'joined') {

			// 1. Subscribe to direct calendar events with #h tag (uses TimelineModel for deletion filtering)
			communityCalendarSub = eventStore.model(TimelineModel, {
				kinds: [31922, 31923],
				'#h': [communityFilter],
				limit: 50
			}).subscribe();

			// 2. Subscribe to targeted publications for this community
			communityTargetedPubsSub = eventStore.model(TimelineModel, {
				kinds: [30222],
				'#p': [communityFilter],
				'#k': ['31922', '31923'],
				limit: 100
			}).subscribe();

			// 3. Watch targeted publications and load referenced calendar events
			communityReferencedEventsSub = eventStore.model(TimelineModel, {
				kinds: [30222],
				'#p': [communityFilter],
				'#k': ['31922', '31923'],
				limit: 100
			}).subscribe((shareEvents) => {
				const eventIds = /** @type {Set<string>} */ (new Set());
				/** @type {Array<{kind: number, pubkey: string, dTag: string}>} */
				const addressableRefs = [];

				shareEvents.forEach((shareEvent) => {
					const eTag = getTagValue(shareEvent, 'e');
					const aTag = getTagValue(shareEvent, 'a');

					if (eTag) {
						eventIds.add(eTag);
					}
					if (aTag) {
						// Parse addressable reference format: kind:pubkey:d-tag
						const parts = aTag.split(':');
						if (parts.length === 3) {
							const [kind, pubkey, dTag] = parts;
							addressableRefs.push({
								kind: parseInt(kind, 10),
								pubkey,
								dTag
							});
						}
					}
				});

				// Load events by ID (TimelineModel filters deletions)
				if (eventIds.size > 0) {
					const referencedSub = eventStore.model(TimelineModel, {
						ids: Array.from(eventIds)
					}).subscribe();
					// Note: this sub is not tracked individually — cleaned up when
					// communityReferencedEventsSub is unsubscribed and effect re-runs
				}

				// Load addressable events
				addressableRefs.forEach((ref) => {
					addressLoader({
						kind: ref.kind,
						pubkey: ref.pubkey,
						identifier: ref.dTag
					}).subscribe();
				});

							});
		}

		return () => {
			communityCalendarSub?.unsubscribe();
			communityTargetedPubsSub?.unsubscribe();
			communityReferencedEventsSub?.unsubscribe();
		};
	});

	// Update communities from allCommunities hook
	$effect(() => {
		communities = allCommunities || [];
	});

	// Auto-focus search input on mount
	onMount(() => {
		if (searchInputRef) {
			searchInputRef.focus();
		}
	});

	// Debounce search query for learning tab NIP-50 search
	$effect(() => {
		if (contentType === 'learning') {
			if (searchDebounceTimer) {
				clearTimeout(searchDebounceTimer);
			}
			searchDebounceTimer = setTimeout(() => {
				debouncedSearchQuery = searchQuery;
			}, runtimeConfig.educational?.searchDebounceMs || 300);
		}
	});

	/**
	 * Load more content
	 */
	function loadMoreContent() {
		const hasMore =
			(contentType === 'events' && hasMoreCalendarEvents) ||
			(contentType === 'articles' && hasMoreArticles) ||
			(contentType === 'learning' && hasMoreAMB) ||
			(contentType === 'communities' && hasMoreCommunities) ||
			(contentType === 'all' && (hasMoreArticles || hasMoreAMB || hasMoreCalendarEvents));

		if (isLoadingMore || !hasMore) return;

		isLoadingMore = true;

		if (contentType === 'communities') {
			const currentCount = displayedCommunitiesCount;
			const totalCount = filteredCommunities.length;
			if (currentCount < totalCount) {
				displayedCommunitiesCount = Math.min(currentCount + 20, totalCount);
			} else {
				hasMoreCommunities = false;
			}
			isLoadingMore = false;
			return;
		}

		// Use loader next/complete callbacks to track batch completion
		let pendingLoaders = 0;

		function onLoaderDone() {
			pendingLoaders--;
			if (pendingLoaders <= 0) {
				isLoadingMore = false;
				// The IntersectionObserver won't re-fire if sentinel is still in viewport.
				// Manually re-check after DOM settles.
				requestAnimationFrame(() => {
					const sentinel = document.getElementById('load-more-sentinel');
					if (!sentinel) return;
					const rect = sentinel.getBoundingClientRect();
					if (rect.top < window.innerHeight + 200) {
						loadMoreContent();
					}
				});
			}
		}

		if (contentType === 'events' || contentType === 'all') {
			if (hasMoreCalendarEvents) {
				pendingLoaders++;
				let count = 0;
				calendarLoader().pipe(takeUntil(timer(BATCH_TIMEOUT))).subscribe({
					next: () => { count++; },
					complete: () => {
						// v5 filterDuplicateEvents may reduce count by 1 at batch boundaries
					if (count === 0) hasMoreCalendarEvents = false;
						onLoaderDone();
					},
					error: (/** @type {any} */ error) => {
						console.error('🔍 Discover: Calendar pagination error:', error);
						onLoaderDone();
					}
				});
			}
		}

		if (contentType === 'articles' || contentType === 'all') {
			if (hasMoreArticles) {
				pendingLoaders++;
				let count = 0;
				articleLoader().pipe(takeUntil(timer(BATCH_TIMEOUT))).subscribe({
					next: () => { count++; },
					complete: () => {
						// v5 filterDuplicateEvents may reduce count by 1 at batch boundaries
						if (count === 0) hasMoreArticles = false;
						onLoaderDone();
					},
					error: (/** @type {any} */ error) => {
						console.error('🔍 Discover: Article pagination error:', error);
						onLoaderDone();
					}
				});
			}
		}

			if (contentType === 'learning' || contentType === 'all') {
			// Skip AMB pagination when learning search is active - search results are a single batch
			if (hasMoreAMB && !(contentType === 'learning' && isLearningSearchActive)) {
				pendingLoaders++;
				let count = 0;
				const ambCountBefore = ambResources.length;
				ambLoader().pipe(takeUntil(timer(BATCH_TIMEOUT))).subscribe({
					next: () => { count++; },
					complete: () => {
						if (count === 0) {
							hasMoreAMB = false;
							onLoaderDone();
						} else {
							// v5 filterDuplicateEvents may reduce count at batch boundaries.
							// Wait for the model debounce (100ms) to settle, then check if
							// content actually grew.
							setTimeout(() => {
								if (ambResources.length <= ambCountBefore) hasMoreAMB = false;
								onLoaderDone();
							}, 200);
						}
					},
					error: (/** @type {any} */ error) => {
						console.error('🔍 Discover: AMB pagination error:', error);
						onLoaderDone();
					}
				});
			}
		}

		if (pendingLoaders === 0) {
			isLoadingMore = false;
		}
	}

	// Filtered communities for the Communities tab
	const filteredCommunities = $derived.by(() => {
		let filtered = communities;

		// Apply search filter by name and description
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter((community) => {
				const communityPubkey = getTagValue(community, 'd') || community.pubkey;
				const profile = communityProfiles.get(communityPubkey);
				
				const name = profile?.name?.toLowerCase() || '';
				const about = profile?.about?.toLowerCase() || '';
				
				return name.includes(query) || about.includes(query);
			});
		}

		return filtered;
	});

	// Reset displayed count when search changes
	$effect(() => {
		if (searchQuery) {
			displayedCommunitiesCount = 20;
			hasMoreCommunities = true;
		}
	});

	// Cleanup subscriptions on component destroy
	$effect(() => {
		return () => {
			// Unsubscribe initial loader subscriptions
			initialArticleSub.unsubscribe();
			initialAmbSub.unsubscribe();
			initialCalendarSub.unsubscribe();
			initialTargetedPubsSub.unsubscribe();

			// Unsubscribe model subscriptions
			articleModelSub.unsubscribe();
			ambModelSub.unsubscribe();
			calendarModelSub.unsubscribe();
			targetedPubsModelSub.unsubscribe();
		};
	});

	// Intersection Observer for infinite scroll
	$effect(() => {
		let hasContent = false;
		let hasMore = false;

		if (contentType === 'events') {
			hasContent = calendarEvents.length > 0;
			hasMore = hasMoreCalendarEvents;
		} else if (contentType === 'learning') {
			hasContent = ambResources.length > 0;
			hasMore = hasMoreAMB && !isLearningSearchActive;
		} else if (contentType === 'articles') {
			hasContent = articles.length > 0;
			hasMore = hasMoreArticles;
		} else if (contentType === 'all') {
			hasContent = articles.length > 0 || ambResources.length > 0 || calendarEvents.length > 0;
			hasMore = hasMoreArticles || hasMoreAMB || hasMoreCalendarEvents;
		}

		if (!hasContent || !hasMore || isLoading) return;

		const sentinel = document.getElementById('load-more-sentinel');
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !isLoadingMore) {
					loadMoreContent();
				}
			},
			{ root: null, rootMargin: '200px', threshold: 0.1 }
		);

		observer.observe(sentinel);

		return () => observer.disconnect();
	});

	// Get all unique tags
	const allTags = $derived.by(() => {
		const tags = new Set();

		articles.forEach((article) => {
			article.tags
				?.filter((/** @type {any} */ t) => t[0] === 't')
				.forEach((/** @type {any} */ t) => tags.add(t[1]));
		});

		ambResources.forEach((resource) => {
			resource.keywords?.forEach((/** @type {string} */ keyword) => tags.add(keyword));
		});

		calendarEvents.forEach((event) => {
			event.hashtags?.forEach((/** @type {string} */ tag) => tags.add(tag));
		});

		return Array.from(tags).sort();
	});

	// Helper functions for filtering (extracted for cleaner derivations)
	/**
	 * Check if an item matches text search query
	 * @param {{type: string, data: any}} item
	 * @param {string} query - lowercase query
	 * @param {Map<string, any>} profiles
	 * @returns {boolean}
	 */
	function matchesTextSearch(item, query, profiles) {
		const pubkey = item.data.pubkey;
		const profile = profiles.get(pubkey);
		const name = profile?.name?.toLowerCase() || '';
		const displayName = profile?.display_name?.toLowerCase() || '';

		if (item.type === 'article') {
			const title = getTagValue(item.data, 'title')?.toLowerCase() || '';
			const summary = getTagValue(item.data, 'summary')?.toLowerCase() || '';
			return title.includes(query) || summary.includes(query) || name.includes(query) || displayName.includes(query);
		} else if (item.type === 'amb') {
			const resourceName = item.data.name?.toLowerCase() || '';
			const description = item.data.description?.toLowerCase() || '';
			return resourceName.includes(query) || description.includes(query) || name.includes(query) || displayName.includes(query);
		} else if (item.type === 'event') {
			const title = item.data.title?.toLowerCase() || '';
			const summary = item.data.summary?.toLowerCase() || '';
			const locations = item.data.locations?.join(' ').toLowerCase() || '';
			return title.includes(query) || summary.includes(query) || locations.includes(query) || name.includes(query) || displayName.includes(query);
		}
		return false;
	}

	/**
	 * Check if an item matches selected tags
	 * @param {{type: string, data: any}} item
	 * @param {string[]} tags
	 * @returns {boolean}
	 */
	function matchesTagFilter(item, tags) {
		if (item.type === 'article') {
			const articleTags = item.data.tags?.filter((/** @type {any} */ t) => t[0] === 't').map((/** @type {any} */ t) => t[1].toLowerCase()) || [];
			return tags.some((tag) => articleTags.includes(tag.toLowerCase()));
		} else if (item.type === 'amb') {
			const keywords = item.data.keywords?.map((/** @type {string} */ k) => k.toLowerCase()) || [];
			return tags.some((tag) => keywords.includes(tag.toLowerCase()));
		} else if (item.type === 'event') {
			const eventTags = item.data.hashtags?.map((/** @type {string} */ t) => t.toLowerCase()) || [];
			return tags.some((tag) => eventTags.includes(tag.toLowerCase()));
		}
		return false;
	}

	/**
	 * Get timestamp for sorting
	 * @param {{type: string, data: any}} item
	 * @returns {number}
	 */
	function getItemTimestamp(item) {
		if (item.type === 'article') {
			return getArticlePublished(item.data) || 0;
		} else if (item.type === 'amb') {
			return item.data.publishedDate || 0;
		} else {
			return item.data.start || 0;
		}
	}

	// Combined and filtered content - split into pipeline for better reactivity
	// Step 1: Build raw items (only runs when source arrays change)
	const rawItems = $derived.by(() => {
		/** @type {Array<{type: string, data: any}>} */
		let items = [];

		if (contentType === 'events' || contentType === 'all') {
			items = [...items, ...calendarEvents.map((e) => ({ type: 'event', data: e }))];
		}

		if (contentType === 'learning' || contentType === 'all') {
			if (contentType === 'learning' && isLearningSearchActive) {
				const searchResultIds = new Set(learningSearchResults.map((e) => e.id));
				const filteredAmbResources = ambResources.filter((r) => searchResultIds.has(r.event?.id || r.id));
				items = [...items, ...filteredAmbResources.map((r) => ({ type: 'amb', data: r }))];
			} else {
				items = [...items, ...ambResources.map((r) => ({ type: 'amb', data: r }))];
			}
		}

		if (contentType === 'articles' || contentType === 'all') {
			items = [...items, ...articles.map((a) => ({ type: 'article', data: a }))];
		}

		return items;
	});

	// Step 2: Apply community filter (only runs when community filter or rawItems change)
	const communityFilteredItems = $derived.by(() => {
		if (!communityFilter) return rawItems;
		return filterContentByCommunity(
			rawItems,
			communityFilter,
			/** @type {string[]} */ (joinedCommunityPubkeys),
			contentToCommunityMap
		);
	});

	// Step 3: Apply relay filter (only runs when relay filter changes)
	const relayFilteredItems = $derived.by(() => {
		if (!relayFilter) return communityFilteredItems;
		const normalizedFilter = normalizeURL(relayFilter);
		return communityFilteredItems.filter((item) => {
			const event = item.data?.rawEvent || item.data?.originalEvent || item.data;
			return getSeenRelays(event)?.has(normalizedFilter);
		});
	});

	// Step 4: Apply text search (only runs when search query changes)
	const searchFilteredItems = $derived.by(() => {
		if (!debouncedMainSearchQuery.trim() || (contentType === 'learning' && isLearningSearchActive)) {
			return relayFilteredItems;
		}
		const query = debouncedMainSearchQuery.toLowerCase();
		return relayFilteredItems.filter((item) => matchesTextSearch(item, query, authorProfiles));
	});

	// Step 5: Apply tag filter (only runs when selected tags change)
	const tagFilteredItems = $derived.by(() => {
		if (selectedTags.length === 0) return searchFilteredItems;
		return searchFilteredItems.filter((item) => matchesTagFilter(item, selectedTags));
	});

	// Step 6: Sort (only runs when filtered items or sort order changes)
	const combinedContent = $derived.by(() => {
		return [...tagFilteredItems].sort((a, b) => {
			const aDate = getItemTimestamp(a);
			const bDate = getItemTimestamp(b);
			return sortBy === 'newest' ? bDate - aDate : aDate - bDate;
		});
	});

	const displayedContent = $derived(combinedContent);

	/**
	 * Toggle tag selection
	 * @param {string} tag
	 */
	function toggleTag(tag) {
		const newTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];

		selectedTags = newTags;
		updateQueryParams($page.url.searchParams, { tags: newTags });
	}

	/**
	 * Handle community filter change
	 * @param {string | null} newValue
	 */
	function handleCommunityFilterChange(newValue) {
		communityFilter = newValue;
		updateQueryParams($page.url.searchParams, { community: newValue });
	}

	/**
	 * Handle event click - navigate to event detail page
	 * @param {any} event
	 */
	function handleEventClick(event) {
		// Navigate to event detail page using the original event for naddr encoding
		const originalEvent = event.originalEvent || event;
		const naddr = encodeEventToNaddr(originalEvent);
		if (naddr) {
			goto(`/calendar/event/${naddr}`);
		}
	}
</script>

<svelte:head>
	<title>{m.discover_content_meta_title()}</title>
	<meta name="description" content={m.discover_content_meta_description()} />
</svelte:head>

<div class="min-h-screen bg-base-100">
	<!-- Hero Section -->
	<div class="bg-gradient-to-br from-primary/10 to-secondary/10 py-12">
		<div class="container mx-auto px-4">
			<h1 class="mb-4 text-center text-4xl font-bold text-base-content md:text-5xl">
				{m.discover_content_title()}
			</h1>
			<p class="text-center text-lg text-base-content/70">
				{m.discover_content_subtitle()}
			</p>
		</div>
	</div>

	<!-- Content Type Tabs -->
	<div class="border-b border-base-300 bg-base-100">
		<div class="container mx-auto px-4">
			<div class="tabs tabs-boxed bg-transparent justify-center py-4">
				<button
					class="tab {contentType === 'all' ? 'tab-active' : ''}"
					data-testid="tab-all"
					onclick={() => handleContentTypeChange('all')}
				>
					{m.discover_tab_all()}
				</button>
				<button
					class="tab {contentType === 'events' ? 'tab-active' : ''}"
					data-testid="tab-events"
					onclick={() => handleContentTypeChange('events')}
				>
					{m.discover_tab_events()}
				</button>
				<button
					class="tab {contentType === 'learning' ? 'tab-active' : ''}"
					data-testid="tab-learning"
					onclick={() => handleContentTypeChange('learning')}
				>
					{m.discover_tab_learning()}
				</button>
				<button
					class="tab {contentType === 'articles' ? 'tab-active' : ''}"
					data-testid="tab-articles"
					onclick={() => handleContentTypeChange('articles')}
				>
					{m.discover_tab_articles()}
				</button>
				<button
					class="tab {contentType === 'communities' ? 'tab-active' : ''}"
					data-testid="tab-communities"
					onclick={() => handleContentTypeChange('communities')}
				>
					{m.discover_tab_communities()}
				</button>
			</div>
		</div>
	</div>

	<!-- Unified Filter Section (shown for all content types) -->
	<div class="container mx-auto px-4 py-6 space-y-4">
		<!-- Row 1: Search Input -->
		<div class="relative w-full">
			<div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
				{#if contentType === 'learning' && isLearningSearchActive && learningSearchResults.length === 0}
					<span class="loading loading-spinner loading-sm text-primary"></span>
				{:else}
					<SearchIcon class_="h-5 w-5 text-base-content/50" />
				{/if}
			</div>
			<input
				bind:this={searchInputRef}
				type="text"
				placeholder={m.discover_content_search_placeholder()}
				bind:value={searchQuery}
				class="input input-bordered w-full pl-9 pr-10"
				aria-label={m.discover_content_search_aria()}
			/>
			{#if searchQuery}
				<button
					type="button"
					class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-sm btn-circle"
					onclick={() => (searchQuery = '')}
					aria-label={m.discover_content_clear_search()}
				>
					✕
				</button>
			{/if}
		</div>

		<!-- Row 2: All dropdown filters in a unified row -->
		<div class="flex flex-wrap gap-4 items-end">
			<!-- Sort (not shown for communities) -->
			{#if contentType !== 'communities'}
				<div class="form-control w-full sm:w-auto sm:min-w-[160px]">
					<label for="sort" class="label">
						<span class="label-text font-medium">{m.discover_sort_label()}</span>
					</label>
					<select id="sort" bind:value={sortBy} class="select select-bordered w-full">
						<option value="newest">{m.discover_sort_newest()}</option>
						<option value="oldest">{m.discover_sort_oldest()}</option>
					</select>
				</div>
			{/if}

			<!-- Community Filter (shown for all except communities tab, only for logged-in users) -->
			{#if activeUser && contentType !== 'communities'}
				<div class="w-full sm:w-auto sm:min-w-[200px]">
					<CommunityFilterDropdown
						value={communityFilter}
						joinedCommunities={communityOptions.joined}
						discoverCommunities={communityOptions.discover}
						onchange={handleCommunityFilterChange}
					/>
				</div>
			{/if}

			<!-- Relay Filter (shown for tabs with app-specific relays) -->
			{#if tabRelayCategory && availableRelays.length > 0}
				<div class="w-full sm:w-auto sm:min-w-[200px]">
					<RelayFilterDropdown
						relays={availableRelays}
						value={relayFilter}
						onchange={(v) => { relayFilter = v; }}
						settingsCategory={tabRelayCategory}
					/>
				</div>
			{/if}

			<!-- Learning Content SKOS Filters (shown only on learning tab) -->
			{#if contentType === 'learning'}
				<div class="w-full sm:flex-1 sm:min-w-[200px]">
					<LearningContentFilters
						onfilterchange={handleLearningFilterChange}
						isSearching={isLearningSearchActive && learningSearchResults.length === 0}
						searchText={debouncedSearchQuery}
					/>
				</div>
			{/if}
		</div>

		<!-- Tag Filter (not shown for communities or learning) -->
		{#if contentType !== 'communities' && contentType !== 'learning' && allTags.length > 0}
			<div>
				<div class="mb-2 text-sm font-medium text-base-content">{m.discover_filter_by_topic()}</div>
				<div class="flex flex-wrap gap-2">
					{#each allTags.slice(0, 20) as tag}
						<button
							class="badge cursor-pointer badge-lg transition-colors {selectedTags.includes(tag)
								? 'badge-primary'
								: 'badge-outline hover:badge-primary'}"
							onclick={() => toggleTag(tag)}
						>
							#{tag}
						</button>
					{/each}
				</div>
				{#if selectedTags.length > 0}
					<button
						class="btn mt-2 btn-ghost btn-xs"
						onclick={() => {
							selectedTags = [];
							updateQueryParams($page.url.searchParams, { tags: [] });
						}}
					>
						{m.discover_clear_filters()}
					</button>
				{/if}
			</div>
		{/if}

		<!-- Results count (not shown for communities which has its own) -->
		{#if contentType !== 'communities' && displayedContent.length > 0}
			<div class="text-center text-sm text-base-content/70">
				{m.discover_results_count({ count: displayedContent.length })}
				{#if hasMoreArticles || hasMoreAMB}
					<span class="ml-2 text-primary">• {m.discover_scroll_for_more()}</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Content Grid -->
	<div class="container mx-auto px-4 py-8">
		{#if contentType === 'communities'}
			<!-- Communities Grid -->
			{#if communities.length === 0}
				<div class="flex justify-center py-12">
					<div class="text-center">
						<div class="loading loading-lg loading-spinner text-primary"></div>
						<p class="mt-4 text-base-content/70">{m.discover_loading()}</p>
					</div>
				</div>
	{:else if filteredCommunities.length === 0}
		<div class="flex justify-center py-12">
			<div class="text-center">
				<p class="text-xl text-base-content/70">{m.discover_no_matches()}</p>
				<p class="mt-2 text-base-content/50">{m.discover_no_matches_subtitle()}</p>
				
				{#if activeUser}
					<button
						class="btn btn-primary mt-6 gap-2"
						onclick={() => modalStore.openModal('createCommunity')}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Create Community
					</button>
				{/if}
			</div>
		</div>
		{:else}
			<!-- Create Community CTA (for logged-in users) -->
			{#if activeUser}
				<div class="mb-8 flex justify-center">
					<button
						class="btn btn-primary btn-lg gap-2"
						onclick={() => modalStore.openModal('createCommunity')}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Create Community
					</button>
				</div>
			{/if}

			<!-- Results count -->
			<div class="mb-6 text-center text-sm text-base-content/70">
				{m.discover_results_count({ count: filteredCommunities.length })}
			</div>

			<div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each filteredCommunities.slice(0, displayedCommunitiesCount) as community (community.pubkey)}
						<CommunikeyCard 
							pubkey={community.pubkey}
							showJoinButton={true}
						/>
					{/each}
				</div>

				<!-- Infinite Scroll Sentinel for Communities -->
				{#if displayedCommunitiesCount < filteredCommunities.length}
					<div id="load-more-sentinel" class="mt-8 py-8">
						{#if isLoadingMore}
							<div class="flex justify-center">
								<div class="text-center">
									<div class="loading loading-lg loading-spinner text-primary"></div>
									<p class="mt-4 text-base-content/70">{m.discover_loading_more()}</p>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<div class="mt-8 py-8 flex justify-center">
						<p class="text-base-content/50">{m.discover_no_more_content()}</p>
					</div>
				{/if}
			{/if}
		{:else if isLoading}
			<!-- Loading State -->
			<div class="flex justify-center py-12">
				<div class="text-center">
					<div class="loading loading-lg loading-spinner text-primary"></div>
					<p class="mt-4 text-base-content/70">{m.discover_loading()}</p>
				</div>
			</div>
		{:else if displayedContent.length === 0}
			<!-- Empty State -->
			<div class="flex justify-center py-12">
				<div class="text-center">
					{#if articles.length === 0 && ambResources.length === 0 && calendarEvents.length === 0}
						<p class="text-xl text-base-content/70">{m.discover_no_content()}</p>
						<p class="mt-2 text-base-content/50">{m.discover_no_content_subtitle()}</p>
					{:else}
						<p class="text-xl text-base-content/70">{m.discover_no_matches()}</p>
						<p class="mt-2 text-base-content/50">{m.discover_no_matches_subtitle()}</p>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Content List with lazy rendering -->
			<div class="flex flex-col gap-3" data-testid="content-list">
				{#each displayedContent as item (item.data.id)}
					<div use:observeCard={item.data.id} class="min-h-[80px]" data-testid="content-card">
						{#if visibleItemIds.has(item.data.id)}
							{#if item.type === 'article'}
								<ArticleCard
									article={item.data}
									authorProfile={authorProfiles.get(item.data.pubkey)}
									variant="list"
								/>
							{:else if item.type === 'amb'}
								<AMBResourceCard
									resource={item.data}
									authorProfile={authorProfiles.get(item.data.pubkey)}
									variant="list"
								/>
							{:else if item.type === 'event'}
								<CalendarEventCard
									event={item.data}
									onEventClick={handleEventClick}
									variant="list"
								/>
							{/if}
						{:else}
							<ContentCardSkeleton variant="list" />
						{/if}
					</div>
				{/each}
			</div>

			<!-- Infinite Scroll Sentinel -->
			<div id="load-more-sentinel" class="mt-8 py-8">
				{#if isLoadingMore}
					<div class="flex justify-center">
						<div class="text-center">
							<div class="loading loading-lg loading-spinner text-primary"></div>
							<p class="mt-4 text-base-content/70">{m.discover_loading_more()}</p>
						</div>
					</div>
				{:else if (contentType === 'events' && !hasMoreCalendarEvents) ||
						(contentType === 'learning' && !hasMoreAMB && !isLearningSearchActive) ||
						(contentType === 'articles' && !hasMoreArticles) ||
						(contentType === 'all' && !hasMoreArticles && !hasMoreAMB && !hasMoreCalendarEvents)}
					<div class="flex justify-center">
						<p class="text-base-content/50">{m.discover_no_more_content()}</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
