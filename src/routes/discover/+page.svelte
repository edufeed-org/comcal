<script>
	import { onMount } from 'svelte';
	import {
		articleTimelineLoader,
		ambTimelineLoader,
		feedTargetedPublicationsLoader,
		calendarTimelineLoader
	} from '$lib/loaders';
	import { ambSearchLoader } from '$lib/loaders/amb-search.js';
	import { hasActiveFilters, createEmptyFilters } from '$lib/helpers/educational/searchQueryBuilder.js';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { getConfig } from '$lib/stores/config.svelte.js';
	import { TimelineModel, ProfileModel } from 'applesauce-core/models';
	import { AMBResourceModel, GlobalCalendarEventModel } from '$lib/models';
	import { profileLoader } from '$lib/loaders/profile.js';
	import { getArticlePublished, getTagValue } from 'applesauce-core/helpers';
	import ArticleCard from '$lib/components/article/ArticleCard.svelte';
	import AMBResourceCard from '$lib/components/educational/AMBResourceCard.svelte';
	import CalendarEventCard from '$lib/components/calendar/CalendarEventCard.svelte';
	import CalendarEventDetailsModal from '$lib/components/calendar/CalendarEventDetailsModal.svelte';
	import CommunityFilterDropdown from '$lib/components/feed/CommunityFilterDropdown.svelte';
	import CommunikeyCard from '$lib/components/CommunikeyCard.svelte';
	import LearningContentFilters from '$lib/components/educational/LearningContentFilters.svelte';
	import { SearchIcon } from '$lib/components/icons';
	import { page } from '$app/stores';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { updateQueryParams, parseFeedFilters } from '$lib/helpers/urlParams.js';
	import { useJoinedCommunitiesList } from '$lib/stores/joined-communities-list.svelte.js';
	import { useAllCommunities } from '$lib/stores/all-communities.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import {
		buildContentToCommunityMap,
		filterContentByCommunity,
		getCommunityFilterOptions
	} from '$lib/helpers/communityContent.js';
	import * as m from '$lib/paraglide/messages';

	// State management
	let articles = $state(/** @type {any[]} */ ([]));
	let ambResources = $state(/** @type {any[]} */ ([]));
	let calendarEvents = $state(/** @type {any[]} */ ([]));
	let targetedPubs = $state(/** @type {any[]} */ ([]));
	let authorProfiles = $state(/** @type {Map<string, any>} */ (new Map()));
	let communityProfiles = $state(/** @type {Map<string, any>} */ (new Map()));
	let isLoading = $state(true);
	let isLoadingMore = $state(false);
	let hasMoreArticles = $state(true);
	let hasMoreAMB = $state(true);
	let sortBy = $state('newest');
	let searchQuery = $state('');

	// Selected event for modal
	let selectedEvent = $state(/** @type {any} */ (null));

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

	// Initialize contentType from URL, with validation
	const initialContentType = VALID_CONTENT_TYPES.includes(initialFilters.type) ? initialFilters.type : 'all';
	let contentType = $state(initialContentType); // 'events', 'learning', 'articles', 'communities', 'all'

	// Active user state
	let activeUser = $state(manager.active);
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

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
				complete: () => {
					console.log('🔍 Learning search complete, results:', learningSearchResults.length);
				}
			});
		} else {
			// No active filters, use normal timeline loading
			isLearningSearchActive = false;
			learningSearchResults = [];
		}
	}

	// Batch size for loading
	const BATCH_SIZE = 20;

	console.log('🔍 Discover: Setting up content loading');

	// Step 1: Create stateful loaders
	const articleLoader = articleTimelineLoader(BATCH_SIZE);
	const ambLoader = ambTimelineLoader(BATCH_SIZE);
	const targetedPubsLoader = feedTargetedPublicationsLoader(200);

	// Step 2: Initial load
	articleLoader().subscribe({
		error: (/** @type {any} */ error) => {
			console.error('🔍 Discover: Article loader error:', error);
			isLoading = false;
		}
	});

	ambLoader().subscribe({
		error: (/** @type {any} */ error) => {
			console.error('🔍 Discover: AMB loader error:', error);
			isLoading = false;
		}
	});

	// Load calendar events
	calendarTimelineLoader()().subscribe({
		error: (/** @type {any} */ error) => {
			console.error('🔍 Discover: Calendar loader error:', error);
		}
	});

	// Load targeted publications for community mapping
	targetedPubsLoader().subscribe({
		error: (/** @type {any} */ error) => {
			console.error('🔍 Discover: Targeted publications loader error:', error);
		}
	});

	// Subscribe to targeted publications model
	const targetedPubsModelSub = eventStore
		.model(TimelineModel, { kinds: [30222], '#k': ['30023', '30142', '31922', '31923'] })
		.subscribe((pubs) => {
			targetedPubs = pubs || [];
		});

	// Subscribe to articles
	const articleModelSub = eventStore
		.model(TimelineModel, { kinds: [30023] })
		.subscribe((timeline) => {
			const previousCount = articles.length;
			articles = timeline || [];
			const currentCount = articles.length;

			if (isLoadingMore) {
				const newArticlesReceived = currentCount - previousCount;
				if (newArticlesReceived === 0) {
					hasMoreArticles = false;
				}
			}

			isLoading = false;
		});

	// Subscribe to AMB resources
	const ambModelSub = eventStore.model(AMBResourceModel, []).subscribe((resources) => {
		const previousCount = ambResources.length;
		ambResources = resources || [];
		const currentCount = ambResources.length;

		if (isLoadingMore) {
			const newResourcesReceived = currentCount - previousCount;
			if (newResourcesReceived === 0) {
				hasMoreAMB = false;
			}
		}

		isLoading = false;
	});

	// Subscribe to calendar events
	const calendarModelSub = eventStore
		.model(GlobalCalendarEventModel, [])
		.subscribe((/** @type {any[]} */ events) => {
			calendarEvents = events || [];
			console.log(`🔍 Discover: Loaded ${calendarEvents.length} calendar events`);
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
			console.log(`🔍 Discover: Loading calendar events for community: ${communityFilter}`);

			// 1. Load direct calendar events with #h tag
			communityCalendarSub = eventStore.timeline({
				kinds: [31922, 31923],
				'#h': [communityFilter],
				limit: 50
			}).subscribe();

			// 2. Load targeted publications for this community
			communityTargetedPubsSub = eventStore.timeline({
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

				// Load events by ID
				if (eventIds.size > 0) {
					const timelineLoader = eventStore.timeline({
						ids: Array.from(eventIds)
					});
					// Handle both Observable and Promise returns
					if (timelineLoader && typeof timelineLoader.subscribe === 'function') {
						timelineLoader.subscribe();
					}
				}

				// Load addressable events
				addressableRefs.forEach((ref) => {
					if (eventStore.addressableLoader) {
						const loader = eventStore.addressableLoader({
							kind: ref.kind,
							pubkey: ref.pubkey,
							identifier: ref.dTag
						});

						// Handle both Observable and Promise returns
						if (loader && typeof loader.subscribe === 'function') {
							loader.subscribe();
						}
					}
				});

				console.log(`🔍 Discover: Loaded ${eventIds.size} event IDs and ${addressableRefs.length} addressable refs for community`);
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
		console.log(`🔍 Discover: Loaded ${communities.length} communities`);
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
			}, getConfig().educational?.searchDebounceMs || 300);
		}
	});

	/**
	 * Load more content
	 */
	function loadMoreContent() {
		const hasMore =
			(contentType === 'articles' && hasMoreArticles) ||
			(contentType === 'learning' && hasMoreAMB) ||
			(contentType === 'communities' && hasMoreCommunities) ||
			(contentType === 'all' && (hasMoreArticles || hasMoreAMB));

		if (isLoadingMore || !hasMore) return;

		isLoadingMore = true;

		if (contentType === 'articles' || contentType === 'all') {
			if (hasMoreArticles) {
				articleLoader().subscribe({
					error: (/** @type {any} */ error) => {
						console.error('🔍 Discover: Article pagination error:', error);
					}
				});
			}
		}

		if (contentType === 'learning' || contentType === 'all') {
			if (hasMoreAMB) {
				ambLoader().subscribe({
					error: (/** @type {any} */ error) => {
						console.error('🔍 Discover: AMB pagination error:', error);
					}
				});
			}
		}

		if (contentType === 'communities') {
			// For communities, we just increase the display count
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

		setTimeout(() => {
			if (isLoadingMore) {
				isLoadingMore = false;
			}
		}, 10000);
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

	// Load author profiles
	let profileLoaderSubs = /** @type {any[]} */ ([]);
	let profileModelSubs = /** @type {any[]} */ ([]);
	let profilesMap = new Map();

	$effect(() => {
		profileLoaderSubs.forEach((s) => s.unsubscribe());
		profileModelSubs.forEach((s) => s.unsubscribe());
		profileLoaderSubs = [];
		profileModelSubs = [];

		const articlePubkeys = articles.map((a) => a.pubkey);
		const ambPubkeys = ambResources.map((r) => r.pubkey);
		const eventPubkeys = calendarEvents.map((e) => e.pubkey);
		const communityPubkeys = communities.map((c) => getTagValue(c, 'd') || c.pubkey);
		const authorPubkeys = [...new Set([...articlePubkeys, ...ambPubkeys, ...eventPubkeys, ...communityPubkeys])];

		if (authorPubkeys.length === 0) return;

		authorPubkeys.forEach((pubkey) => {
			const loaderSub = profileLoader({
				kind: 0,
				pubkey,
				relays: getConfig().calendar.defaultRelays
			}).subscribe({
				error: (error) => {
					console.error(`🔍 Discover: Profile loader error for ${pubkey.slice(0, 8)}:`, error);
				}
			});
			profileLoaderSubs.push(loaderSub);

			const modelSub = eventStore.model(ProfileModel, { pubkey }).subscribe((profile) => {
				if (profile) {
					profilesMap.set(pubkey, profile);
					authorProfiles = new Map(profilesMap);
				}
			});
			profileModelSubs.push(modelSub);
		});
	});

	// Load community profiles
	let communityProfileLoaderSubs = /** @type {any[]} */ ([]);
	let communityProfileModelSubs = /** @type {any[]} */ ([]);
	let communityProfilesMap = new Map();

	$effect(() => {
		communityProfileLoaderSubs.forEach((s) => s.unsubscribe());
		communityProfileModelSubs.forEach((s) => s.unsubscribe());
		communityProfileLoaderSubs = [];
		communityProfileModelSubs = [];

		const communityPubkeys = allCommunities.map((c) => c.pubkey);

		if (communityPubkeys.length === 0) return;

		communityPubkeys.forEach((pubkey) => {
			const loaderSub = profileLoader({
				kind: 0,
				pubkey,
				relays: getConfig().calendar.defaultRelays
			}).subscribe({
				error: (error) => {
					console.error(`🔍 Discover: Community profile loader error:`, error);
				}
			});
			communityProfileLoaderSubs.push(loaderSub);

			const modelSub = eventStore.model(ProfileModel, { pubkey }).subscribe((profile) => {
				if (profile) {
					communityProfilesMap.set(pubkey, profile);
					communityProfiles = new Map(communityProfilesMap);
				}
			});
			communityProfileModelSubs.push(modelSub);
		});
	});

	// Cleanup subscriptions
	$effect(() => {
		return () => {
			articleModelSub.unsubscribe();
			ambModelSub.unsubscribe();
			calendarModelSub.unsubscribe();
			targetedPubsModelSub.unsubscribe();
			profileLoaderSubs.forEach((s) => s.unsubscribe());
			profileModelSubs.forEach((s) => s.unsubscribe());
			communityProfileLoaderSubs.forEach((s) => s.unsubscribe());
			communityProfileModelSubs.forEach((s) => s.unsubscribe());
		};
	});

	// Intersection Observer for infinite scroll
	$effect(() => {
		const hasContent = articles.length > 0 || ambResources.length > 0;
		const hasMore = hasMoreArticles || hasMoreAMB;
		if (!hasContent || !hasMore) return;

		const sentinel = document.getElementById('load-more-sentinel');
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
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

	// Combined and filtered content
	const combinedContent = $derived.by(() => {
		/** @type {Array<{type: string, data: any}>} */
		let items = [];

		if (contentType === 'events' || contentType === 'all') {
			items = [
				...items,
				...calendarEvents.map((e) => ({ type: 'event', data: e }))
			];
		}

		if (contentType === 'learning' || contentType === 'all') {
			// When learning filters are active and we're on the learning tab, use search results
			if (contentType === 'learning' && isLearningSearchActive) {
				// Use search results from NIP-50 query
				// Search results are raw events, need to convert to model format
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

		// Note: Communities are handled separately, not in combinedContent
		// They use the CommunikeyCard component directly

		// Apply community filter
		if (communityFilter) {
			items = filterContentByCommunity(
				items,
				communityFilter,
				/** @type {string[]} */ (joinedCommunityPubkeys),
				contentToCommunityMap
			);
		}

		// Apply text search filter (skip for learning tab when NIP-50 search is active)
		if (searchQuery.trim() && !(contentType === 'learning' && isLearningSearchActive)) {
			const query = searchQuery.toLowerCase();
			items = items.filter((item) => {
				const pubkey = item.data.pubkey;
				const profile = authorProfiles.get(pubkey);
				const name = profile?.name?.toLowerCase() || '';
				const displayName = profile?.display_name?.toLowerCase() || '';

				if (item.type === 'article') {
					const title = getTagValue(item.data, 'title')?.toLowerCase() || '';
					const summary = getTagValue(item.data, 'summary')?.toLowerCase() || '';
					return (
						title.includes(query) ||
						summary.includes(query) ||
						name.includes(query) ||
						displayName.includes(query)
					);
				} else if (item.type === 'amb') {
					const resourceName = item.data.name?.toLowerCase() || '';
					const description = item.data.description?.toLowerCase() || '';
					return (
						resourceName.includes(query) ||
						description.includes(query) ||
						name.includes(query) ||
						displayName.includes(query)
					);
				} else if (item.type === 'event') {
					const title = item.data.title?.toLowerCase() || '';
					const summary = item.data.summary?.toLowerCase() || '';
					const locations = item.data.locations?.join(' ').toLowerCase() || '';
					return (
						title.includes(query) ||
						summary.includes(query) ||
						locations.includes(query) ||
						name.includes(query) ||
						displayName.includes(query)
					);
				}
				return false;
			});
		}

		// Apply tag filter
		if (selectedTags.length > 0) {
			items = items.filter((item) => {
				if (item.type === 'article') {
					const articleTags =
						item.data.tags
							?.filter((/** @type {any} */ t) => t[0] === 't')
							.map((/** @type {any} */ t) => t[1].toLowerCase()) || [];
					return selectedTags.some((tag) => articleTags.includes(tag.toLowerCase()));
				} else if (item.type === 'amb') {
					const keywords =
						item.data.keywords?.map((/** @type {string} */ k) => k.toLowerCase()) || [];
					return selectedTags.some((tag) => keywords.includes(tag.toLowerCase()));
				} else if (item.type === 'event') {
					const eventTags =
						item.data.hashtags?.map((/** @type {string} */ t) => t.toLowerCase()) || [];
					return selectedTags.some((tag) => eventTags.includes(tag.toLowerCase()));
				}
				return false;
			});
		}

		// Sort
		const sorted = [...items].sort((a, b) => {
			let aDate, bDate;

			if (a.type === 'article') {
				aDate = getArticlePublished(a.data);
			} else if (a.type === 'amb') {
				aDate = a.data.publishedDate;
			} else {
				aDate = a.data.start;
			}

			if (b.type === 'article') {
				bDate = getArticlePublished(b.data);
			} else if (b.type === 'amb') {
				bDate = b.data.publishedDate;
			} else {
				bDate = b.data.start;
			}

			if (sortBy === 'newest') {
				return bDate - aDate;
			} else if (sortBy === 'oldest') {
				return aDate - bDate;
			}
			return 0;
		});

		return sorted;
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
	 * Handle event click - show modal
	 * @param {any} event
	 */
	function handleEventClick(event) {
		selectedEvent = event;
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
					onclick={() => handleContentTypeChange('all')}
				>
					{m.discover_tab_all()}
				</button>
				<button
					class="tab {contentType === 'events' ? 'tab-active' : ''}"
					onclick={() => handleContentTypeChange('events')}
				>
					{m.discover_tab_events()}
				</button>
				<button
					class="tab {contentType === 'learning' ? 'tab-active' : ''}"
					onclick={() => handleContentTypeChange('learning')}
				>
					{m.discover_tab_learning()}
				</button>
				<button
					class="tab {contentType === 'articles' ? 'tab-active' : ''}"
					onclick={() => handleContentTypeChange('articles')}
				>
					{m.discover_tab_articles()}
				</button>
				<button
					class="tab {contentType === 'communities' ? 'tab-active' : ''}"
					onclick={() => handleContentTypeChange('communities')}
				>
					{m.discover_tab_communities()}
				</button>
			</div>
		</div>
	</div>

	<!-- Unified Filter Section (shown for all content types) -->
	<div class="container mx-auto px-4 py-6">
		<!-- Search Row - shown for all content types -->
		<div class="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
			<!-- Search Input -->
			<div class="flex-1 max-w-xl">
				<div class="join w-full">
					<div class="join-item flex items-center bg-base-100 pl-4">
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
						class="input input-bordered join-item w-full"
						aria-label={m.discover_content_search_aria()}
					/>
					{#if searchQuery}
						<button
							type="button"
							class="btn btn-ghost join-item"
							onclick={() => (searchQuery = '')}
							aria-label={m.discover_content_clear_search()}
						>
							✕
						</button>
					{/if}
				</div>
			</div>

			<!-- Sort (not shown for communities) -->
			{#if contentType !== 'communities'}
				<div class="flex items-center gap-2">
					<label for="sort" class="text-sm font-medium text-base-content">{m.discover_sort_label()}</label>
					<select id="sort" bind:value={sortBy} class="select-bordered select select-sm">
						<option value="newest">{m.discover_sort_newest()}</option>
						<option value="oldest">{m.discover_sort_oldest()}</option>
					</select>
				</div>
			{/if}

			<!-- Community Filter (shown for all except communities tab, only for logged-in users) -->
			{#if activeUser && contentType !== 'communities'}
				<CommunityFilterDropdown
					value={communityFilter}
					joinedCommunities={communityOptions.joined}
					discoverCommunities={communityOptions.discover}
					onchange={handleCommunityFilterChange}
				/>
			{/if}
		</div>

		<!-- Learning Content Filters (SKOS dropdowns - shown only on learning tab) -->
		{#if contentType === 'learning'}
			<div class="mt-4">
				<LearningContentFilters 
					onfilterchange={handleLearningFilterChange}
					isSearching={isLearningSearchActive && learningSearchResults.length === 0}
					searchText={debouncedSearchQuery}
				/>
			</div>
		{/if}

		<!-- Tag Filter (not shown for communities or learning) -->
		{#if contentType !== 'communities' && contentType !== 'learning' && allTags.length > 0}
			<div class="mt-4">
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
			<div class="mt-4 text-center text-sm text-base-content/70">
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
					</div>
				</div>
			{:else}
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
			<!-- Content Grid -->
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each displayedContent as item (item.data.id)}
					{#if item.type === 'article'}
						<ArticleCard
							article={item.data}
							authorProfile={authorProfiles.get(item.data.pubkey)}
						/>
					{:else if item.type === 'amb'}
						<AMBResourceCard
							resource={item.data}
							authorProfile={authorProfiles.get(item.data.pubkey)}
						/>
					{:else if item.type === 'event'}
						<CalendarEventCard
							event={item.data}
							onEventClick={handleEventClick}
						/>
					{/if}
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
				{:else if !hasMoreArticles && !hasMoreAMB}
					<div class="flex justify-center">
						<p class="text-base-content/50">{m.discover_no_more_content()}</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Event Details Modal -->
{#if selectedEvent}
	<CalendarEventDetailsModal
		event={selectedEvent}
		onclose={() => (selectedEvent = null)}
	/>
{/if}
