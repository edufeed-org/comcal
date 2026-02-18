<script>
  import { SvelteSet } from 'svelte/reactivity';
  import { onMount } from 'svelte';
  import { articleTimelineLoader } from '$lib/loaders/articles.js';
  import { ambTimelineLoader } from '$lib/loaders/amb.js';
  import { feedTargetedPublicationsLoader } from '$lib/loaders/targeted-publications.js';
  import {
    createDateRangeCalendarLoader,
    createPaginatedCalendarLoader
  } from '$lib/loaders/calendar.js';
  import { preWarmRelayCapabilitiesCache } from '$lib/services/relay-capabilities.js';
  import { addressLoader, timedPool } from '$lib/loaders/base.js';
  import { ambSearchLoader } from '$lib/loaders/amb-search.js';
  import {
    hasActiveFilters,
    createEmptyFilters
  } from '$lib/helpers/educational/searchQueryBuilder.js';
  import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
  import { createTimelineLoader } from 'applesauce-loaders/loaders';
  import {
    getEducationalRelays,
    getArticleRelays,
    getCalendarRelays,
    getCommunikeyRelays
  } from '$lib/helpers/relay-helper.js';
  import { TimelineModel } from 'applesauce-core/models';
  import { AMBResourceModel, CalendarEventRangeModel } from '$lib/models';
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
  import EventDateRangeFilter from '$lib/components/calendar/EventDateRangeFilter.svelte';
  import { SearchIcon } from '$lib/components/icons';
  import { timer, debounceTime } from 'rxjs';
  import { takeUntil } from 'rxjs/operators';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
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
  // Use $state.raw() to preserve Symbol-based relay provenance (getSeenRelays)
  let articles = $state.raw(/** @type {any[]} */ ([]));
  let ambResources = $state.raw(/** @type {any[]} */ ([]));
  let calendarEvents = $state.raw(/** @type {any[]} */ ([]));
  let targetedPubs = $state.raw(/** @type {any[]} */ ([]));

  // Trigger counter to force profile hook re-evaluation when $state.raw() arrays are updated
  let profileTrigger = $state(0);

  // Profile loading using useProfileMap hook
  // The getter reads profileTrigger to re-run when data changes (since $state.raw doesn't track)
  const getAuthorProfiles = useProfileMap(() => {
    const _ = profileTrigger; // Establish dependency on trigger
    return [
      ...articles.map((a) => a.pubkey),
      ...ambResources.map((r) => r.pubkey),
      ...calendarEvents.map((e) => e.pubkey)
    ].filter(Boolean);
  });
  let authorProfiles = $derived(getAuthorProfiles());

  const getCommunityProfiles = useProfileMap(() => allCommunities.map((c) => c.pubkey));
  let communityProfiles = $derived(getCommunityProfiles());
  let isLoading = $state(true);
  let isLoadingMore = $state(false);
  let hasMoreArticles = $state(true);
  let hasMoreCalendarEvents = $state(true);

  // Track per-relay exhaustion for educational content pagination.
  // Only stop pagination when ALL educational relays have been exhausted.
  // This fixes the bug where pagination stopped early when one relay returned 0 events
  // while another (e.g., user-added localhost:3334) still had content.
  // IMPORTANT: Use $state.raw() because Svelte 5's $state() proxy breaks Set.prototype.has()
  /** @type {Set<string>} */
  let exhaustedEducationalRelays = $state.raw(new Set());

  // Derived: hasMoreAMB is true if ANY educational relay is not yet exhausted
  const hasMoreAMB = $derived.by(() => {
    const currentRelays = getEducationalRelays();
    return currentRelays.some((r) => !exhaustedEducationalRelays.has(r));
  });

  // Track oldest timestamps PER RELAY for dynamic relay pagination.
  // This fixes the bug where pagination stopped early because the global `until` timestamp
  // excluded events from newly-added relays with different timestamp ranges.
  // Use $state.raw() because Map methods like .get()/.set() don't work through Svelte proxies.
  /** @type {Map<string, number>} */
  let perRelayOldestTimestamp = $state.raw(new Map());

  let sortBy = $state('newest');
  let searchQuery = $state('');

  // Active search query (set when user presses Enter or clicks search button)
  let activeSearchQuery = $state('');

  // Lazy rendering - track which items are visible
  let visibleItemIds = $state(/** @type {Set<string>} */ (new Set()));
  /** @type {IntersectionObserver | undefined} */
  let cardObserver;

  // Learning content filter state (assigned via handleLearningFilterChange but not read directly)
  /** @type {import('$lib/helpers/educational/searchQueryBuilder.js').SearchFilters} */
  let _learningFilters = $state(createEmptyFilters());
  let isLearningSearchActive = $state(false);
  let learningSearchResults = $state(/** @type {import('nostr-tools').Event[]} */ ([]));
  /** @type {import('rxjs').Subscription | null} */
  let currentSearchSubscription = $state(null);

  // Get current locale (kept for future i18n features)
  const _locale = $derived(getLocale());

  // Search input reference for auto-focus
  let searchInputRef = $state(/** @type {HTMLInputElement | null} */ (null));

  // Valid content types
  const VALID_CONTENT_TYPES = ['all', 'events', 'learning', 'articles', 'communities'];

  // Initialize from URL params
  const initialFilters = parseFeedFilters($page.url.searchParams);
  let selectedTags = $state(/** @type {string[]} */ (initialFilters.tags));
  let communityFilter = $state(/** @type {string | null} */ (initialFilters.community));
  let relayFilter = $state(/** @type {string | null} */ (null));

  // Events date range state (default: now to +3 months)
  const DEFAULT_RANGE_SECONDS = 90 * 24 * 60 * 60; // 3 months
  let eventsDateRangeStart = $state(initialFilters.eventStart ?? Math.floor(Date.now() / 1000));
  let eventsDateRangeEnd = $state(
    initialFilters.eventEnd ?? Math.floor(Date.now() / 1000) + DEFAULT_RANGE_SECONDS
  );
  /** @type {import('rxjs').Subscription | undefined} */
  let dateRangeLoaderSub;

  // Initialize contentType from URL, with validation
  const initialContentType = VALID_CONTENT_TYPES.includes(initialFilters.type)
    ? initialFilters.type
    : 'all';
  let contentType = $state(initialContentType); // 'events', 'learning', 'articles', 'communities', 'all'

  // Relay filter: map current tab to relay category
  const tabRelayCategory = $derived(
    contentType === 'events'
      ? 'calendar'
      : contentType === 'learning'
        ? 'educational'
        : contentType === 'articles'
          ? 'longform'
          : null
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
          visibleItemIds = new SvelteSet(visibleItemIds);
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

  // Communities state for the Communities tab - derived from allCommunities
  const communities = $derived(allCommunities || []);
  let hasMoreCommunities = $state(true);
  let displayedCommunitiesCount = $state(20);

  // Get joined community pubkeys for filtering
  const joinedCommunityPubkeys = $derived(
    joinedCommunities.map((rel) => getTagValue(rel, 'd')).filter(Boolean)
  );

  // Build content-to-community map from targeted publications
  const contentToCommunityMap = $derived(buildContentToCommunityMap(targetedPubs));

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

    // Clear search when switching tabs (search is tab-specific)
    searchQuery = '';
    activeSearchQuery = '';

    // Update URL - use null for 'all' to keep URL clean
    updateQueryParams($page.url.searchParams, { type: newType === 'all' ? null : newType });

    // Reset learning filters when switching away from learning tab
    if (newType !== 'learning') {
      _learningFilters = createEmptyFilters();
      isLearningSearchActive = false;
      learningSearchResults = [];
      if (currentSearchSubscription) {
        currentSearchSubscription.unsubscribe();
        currentSearchSubscription = null;
      }
    }
  }

  /**
   * Handle events date range filter changes
   * @param {{ start: number, end: number }} range
   */
  function handleEventsDateRangeChange(range) {
    eventsDateRangeStart = range.start;
    eventsDateRangeEnd = range.end;
    hasMoreCalendarEvents = true; // Reset "has more" state

    // Update URL params
    updateQueryParams($page.url.searchParams, {
      eventStart: String(range.start),
      eventEnd: String(range.end)
    });

    // Cancel previous subscription and reload with new range
    // Use full NIP-52 date filter parameters
    dateRangeLoaderSub?.unsubscribe();
    const loader = createDateRangeCalendarLoader({
      startAfter: range.start,
      startBefore: range.end,
      endAfter: range.start // Include events that are still ongoing
    });
    dateRangeLoaderSub = loader().subscribe({
      error: (err) => console.error('🔍 Discover: Date range loader error:', err)
    });
  }

  /**
   * Handle learning content filter changes
   * @param {import('$lib/helpers/educational/searchQueryBuilder.js').SearchFilters} filters
   */
  function handleLearningFilterChange(filters) {
    _learningFilters = filters;

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
  const CALENDAR_BATCH_SIZE = 20; // Events per pagination batch
  const BATCH_TIMEOUT = 4_000; // Safety timeout per batch (timedPool is 2s + buffer)

  // Step 1: Create stateful loaders
  const articleLoader = articleTimelineLoader(BATCH_SIZE);
  const ambLoader = ambTimelineLoader(BATCH_SIZE);
  // Calendar events use date range loader (not stateful pagination)
  const targetedPubsLoader = feedTargetedPublicationsLoader(200);

  // Step 2: Initial load (subscriptions captured for cleanup on destroy)
  const initialArticleSub = articleLoader().subscribe({
    complete: () => {
      isLoading = false;
    },
    error: (/** @type {any} */ error) => {
      console.error('🔍 Discover: Article loader error:', error);
      isLoading = false;
    }
  });

  const initialAmbSub = ambLoader().subscribe({
    complete: () => {
      isLoading = false;
    },
    error: (/** @type {any} */ error) => {
      console.error('🔍 Discover: AMB loader error:', error);
      isLoading = false;
    }
  });

  // Pre-warm relay capabilities cache for calendar relays
  // This ensures pagination doesn't wait 2-3s for NIP-52 detection on each scroll
  preWarmRelayCapabilitiesCache(getCalendarRelays());

  // Initial calendar load - load events within the default date range
  // Uses createDateRangeCalendarLoader with full NIP-52 filter support
  const initialCalendarLoader = createDateRangeCalendarLoader({
    startAfter: eventsDateRangeStart,
    startBefore: eventsDateRangeEnd,
    endAfter: eventsDateRangeStart // Include events that are still ongoing
  });
  const initialCalendarSub = initialCalendarLoader().subscribe({
    complete: () => {
      isLoading = false;
    },
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
  const initialEducationalRelays = new SvelteSet(getEducationalRelays());
  const initialArticleRelays = new SvelteSet(getArticleRelays());
  const initialCalendarRelays = new SvelteSet(getCalendarRelays());
  const initialCommunikeyRelays = new SvelteSet(getCommunikeyRelays());

  $effect(() => {
    /** @type {import('rxjs').Subscription[]} */
    const supplementalSubs = [];

    const currentEducational = getEducationalRelays();
    const newEducational = currentEducational.filter((r) => !initialEducationalRelays.has(r));
    if (newEducational.length > 0) {
      newEducational.forEach((r) => initialEducationalRelays.add(r));
      const loader = createTimelineLoader(
        timedPool,
        newEducational,
        { kinds: [30142] },
        { eventStore, limit: BATCH_SIZE }
      );
      supplementalSubs.push(loader().subscribe());
    }

    const currentArticle = getArticleRelays();
    const newArticle = currentArticle.filter((r) => !initialArticleRelays.has(r));
    if (newArticle.length > 0) {
      newArticle.forEach((r) => initialArticleRelays.add(r));
      const loader = createTimelineLoader(
        timedPool,
        newArticle,
        { kinds: [30023] },
        { eventStore, limit: BATCH_SIZE }
      );
      supplementalSubs.push(loader().subscribe());
    }

    const currentCalendar = getCalendarRelays();
    const newCalendar = currentCalendar.filter((r) => !initialCalendarRelays.has(r));
    if (newCalendar.length > 0) {
      newCalendar.forEach((r) => initialCalendarRelays.add(r));
      const loader = createTimelineLoader(
        timedPool,
        newCalendar,
        { kinds: [31922, 31923], limit: 40 },
        { eventStore }
      );
      supplementalSubs.push(loader().subscribe());
    }

    const currentCommunikey = getCommunikeyRelays();
    const newCommunikey = currentCommunikey.filter((r) => !initialCommunikeyRelays.has(r));
    if (newCommunikey.length > 0) {
      newCommunikey.forEach((r) => initialCommunikeyRelays.add(r));
      const loader = createTimelineLoader(
        timedPool,
        newCommunikey,
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
      profileTrigger++; // Trigger profile loading for new articles
    });

  // Subscribe to AMB resources (debounced via RxJS)
  const ambModelSub = /** @type {import('rxjs').Observable<any[]>} */ (
    eventStore.model(AMBResourceModel, [])
  )
    .pipe(debounceTime(100))
    .subscribe((resources) => {
      ambResources = resources || [];
      isLoading = false;
      profileTrigger++; // Trigger profile loading for new resources

      // Track per-relay oldest timestamps for pagination.
      // This uses getSeenRelays() to determine which relay each event came from.
      if (resources && resources.length > 0) {
        const newMap = new Map(perRelayOldestTimestamp); // eslint-disable-line svelte/prefer-svelte-reactivity
        let mapUpdated = false;

        for (const resource of resources) {
          const event = resource.event || resource;
          const ts = event?.created_at;
          if (!ts) continue;

          // Get which relay(s) this event was seen on
          const seenRelays = getSeenRelays(event);
          if (!seenRelays || seenRelays.size === 0) continue;

          for (const relay of seenRelays) {
            const existing = newMap.get(relay);
            if (existing === undefined || ts < existing) {
              newMap.set(relay, ts);
              mapUpdated = true;
            }
          }
        }

        if (mapUpdated) {
          perRelayOldestTimestamp = newMap; // Reassign to trigger reactivity
        }
      }
    });

  // Subscribe to calendar events with date range filtering (reactive)
  // Re-subscribes when date range changes to filter events appropriately
  // Note: Plain let (not $state) to avoid infinite loops in $effect
  /** @type {import('rxjs').Subscription | undefined} */
  let calendarModelSub;

  $effect(() => {
    calendarModelSub?.unsubscribe();
    calendarModelSub = /** @type {import('rxjs').Observable<any[]>} */ (
      eventStore.model(CalendarEventRangeModel, eventsDateRangeStart, eventsDateRangeEnd)
    )
      .pipe(debounceTime(100))
      .subscribe((events) => {
        calendarEvents = events || [];
        isLoading = false;
        profileTrigger++; // Trigger profile loading for new events
      });

    return () => calendarModelSub?.unsubscribe();
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
      communityCalendarSub = eventStore
        .model(TimelineModel, {
          kinds: [31922, 31923],
          '#h': [communityFilter],
          limit: 50
        })
        .subscribe();

      // 2. Subscribe to targeted publications for this community
      communityTargetedPubsSub = eventStore
        .model(TimelineModel, {
          kinds: [30222],
          '#p': [communityFilter],
          '#k': ['31922', '31923'],
          limit: 100
        })
        .subscribe();

      // 3. Watch targeted publications and load referenced calendar events
      communityReferencedEventsSub = eventStore
        .model(TimelineModel, {
          kinds: [30222],
          '#p': [communityFilter],
          '#k': ['31922', '31923'],
          limit: 100
        })
        .subscribe((shareEvents) => {
          const eventIds = /** @type {SvelteSet<string>} */ (new SvelteSet());
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
            // Subscription is intentionally not tracked - side effect only; cleaned up when
            // communityReferencedEventsSub is unsubscribed and effect re-runs
            eventStore
              .model(TimelineModel, {
                ids: Array.from(eventIds)
              })
              .subscribe();
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

  // Auto-focus search input on mount
  onMount(() => {
    if (searchInputRef) {
      searchInputRef.focus();
    }
  });

  /**
   * Execute search - triggers when user presses Enter or clicks search button
   */
  function executeSearch() {
    activeSearchQuery = searchQuery.trim();
  }

  /**
   * Handle Enter key in search input
   * @param {KeyboardEvent} event
   */
  function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      executeSearch();
    }
  }

  /**
   * Clear search query and active search
   */
  function clearSearch() {
    searchQuery = '';
    activeSearchQuery = '';
  }

  // Track previous search query to avoid unnecessary re-triggers
  let previousActiveSearchQuery = '';

  // Trigger learning search when activeSearchQuery changes (on learning tab)
  // This directly calls handleLearningFilterChange instead of relying on
  // LearningContentFilters component's $effect propagation
  $effect(() => {
    if (contentType === 'learning' && activeSearchQuery !== previousActiveSearchQuery) {
      previousActiveSearchQuery = activeSearchQuery;
      // Build filters with current search text and any selected SKOS filters
      const filters = {
        searchText: activeSearchQuery,
        learningResourceType: _learningFilters.learningResourceType || [],
        about: _learningFilters.about || [],
        audience: _learningFilters.audience || []
      };
      handleLearningFilterChange(filters);
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

    if (isLoadingMore || !hasMore) {
      return;
    }

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
        const calendarCountBefore = calendarEvents.length;

        // Get the highest start timestamp from current events to paginate forward
        const lastStartTimestamp =
          calendarEvents.length > 0
            ? Math.max(...calendarEvents.map((e) => e.start || 0))
            : Math.floor(Date.now() / 1000);

        const paginatedLoader = createPaginatedCalendarLoader(lastStartTimestamp, {
          limit: CALENDAR_BATCH_SIZE
        });

        paginatedLoader()
          .pipe(takeUntil(timer(BATCH_TIMEOUT)))
          .subscribe({
            next: () => {
              count++;
            },
            complete: () => {
              if (count === 0) {
                hasMoreCalendarEvents = false;
                onLoaderDone();
              } else {
                // Wait for model debounce + Svelte reactivity to settle
                setTimeout(() => {
                  if (calendarEvents.length <= calendarCountBefore) hasMoreCalendarEvents = false;
                  onLoaderDone();
                }, 500);
              }
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
        articleLoader()
          .pipe(takeUntil(timer(BATCH_TIMEOUT)))
          .subscribe({
            next: () => {
              count++;
            },
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
        // Get non-exhausted relays for pagination
        const currentRelays = getEducationalRelays();
        const activeRelays = currentRelays.filter((r) => !exhaustedEducationalRelays.has(r));

        if (activeRelays.length === 0) {
          // All relays exhausted, nothing to do
        } else {
          // Query each non-exhausted relay individually to track per-relay exhaustion.
          // Use per-relay timestamps: only apply `until` filter if we've seen events from that relay.
          // This fixes the bug where pagination stopped early because a global `until` timestamp
          // excluded events from relays with different (newer) timestamp ranges.
          let relaysPending = activeRelays.length;
          pendingLoaders++;

          for (const relay of activeRelays) {
            let relayCount = 0;
            let relayOldestTimestamp = Infinity;
            /** @type {Set<string>} */
            const batchEventIds = new Set(); // eslint-disable-line svelte/prefer-svelte-reactivity

            /** @type {import('nostr-tools').Filter} */
            const paginationFilter = { kinds: [30142] };

            // Use this relay's specific oldest timestamp (if we've seen events from it)
            // Subtract 1 to exclude events AT that timestamp (already fetched in previous batch)
            const relayTimestamp = perRelayOldestTimestamp.get(relay);
            if (relayTimestamp !== undefined) {
              paginationFilter.until = relayTimestamp - 1;
            }
            // If no timestamp for this relay yet, fetch without `until` to get its newest events

            const relayLoader = createTimelineLoader(timedPool, [relay], paginationFilter, {
              eventStore,
              limit: BATCH_SIZE
            });

            relayLoader()
              .pipe(takeUntil(timer(BATCH_TIMEOUT)))
              .subscribe({
                next: (/** @type {any} */ event) => {
                  relayCount++;
                  if (event?.id) batchEventIds.add(event.id);
                  // Track this relay's oldest timestamp for future pagination
                  const ts = event?.created_at;
                  if (ts && ts < relayOldestTimestamp) {
                    relayOldestTimestamp = ts;
                  }
                },
                complete: () => {
                  // Update per-relay timestamp if we received events with older timestamps
                  if (relayOldestTimestamp !== Infinity) {
                    const newMap = new Map(perRelayOldestTimestamp); // eslint-disable-line svelte/prefer-svelte-reactivity
                    const existing = newMap.get(relay);
                    if (existing === undefined || relayOldestTimestamp < existing) {
                      newMap.set(relay, relayOldestTimestamp);
                      perRelayOldestTimestamp = newMap; // Reassign to trigger reactivity
                    }
                  }

                  if (relayCount === 0) {
                    // Mark this specific relay as exhausted
                    exhaustedEducationalRelays = new Set([...exhaustedEducationalRelays, relay]);
                  }

                  relaysPending--;
                  if (relaysPending === 0) {
                    // All relays have completed - debounce model update before checking hasMore
                    setTimeout(() => {
                      onLoaderDone();
                    }, 500);
                  }
                },
                error: (/** @type {any} */ error) => {
                  console.error('AMB pagination error for relay:', relay, error);
                  relaysPending--;
                  if (relaysPending === 0) {
                    onLoaderDone();
                  }
                }
              });
          }
        }
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
    if (activeSearchQuery.trim()) {
      const query = activeSearchQuery.toLowerCase();
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
    if (activeSearchQuery) {
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

      // Unsubscribe date range loader subscription
      dateRangeLoaderSub?.unsubscribe();

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

    if (!hasContent || !hasMore || isLoading) {
      return;
    }

    const sentinel = document.getElementById('load-more-sentinel');
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMoreContent();
        }
      },
      { root: null, rootMargin: '200px', threshold: 0.1 }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  });

  // Get all unique tags
  const allTags = $derived.by(() => {
    const tags = new SvelteSet();

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
  }

  /**
   * Check if an item matches selected tags
   * @param {{type: string, data: any}} item
   * @param {string[]} tags
   * @returns {boolean}
   */
  function matchesTagFilter(item, tags) {
    if (item.type === 'article') {
      const articleTags =
        item.data.tags
          ?.filter((/** @type {any} */ t) => t[0] === 't')
          .map((/** @type {any} */ t) => t[1].toLowerCase()) || [];
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
        const filteredAmbResources = ambResources.filter((r) =>
          searchResultIds.has(r.event?.id || r.id)
        );
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
    if (!activeSearchQuery.trim() || (contentType === 'learning' && isLearningSearchActive)) {
      return relayFilteredItems;
    }
    const query = activeSearchQuery.toLowerCase();
    return relayFilteredItems.filter((item) => matchesTextSearch(item, query, authorProfiles));
  });

  // Step 5: Apply tag filter (only runs when selected tags change)
  const tagFilteredItems = $derived.by(() => {
    if (selectedTags.length === 0) return searchFilteredItems;
    return searchFilteredItems.filter((item) => matchesTagFilter(item, selectedTags));
  });

  // Step 6: Sort (only runs when filtered items or sort order changes)
  // Events tab defaults to 'oldest' (soonest first) - this is the expected behavior for calendar views
  const effectiveSortBy = $derived(contentType === 'events' ? 'oldest' : sortBy);

  const combinedContent = $derived.by(() => {
    return [...tagFilteredItems].sort((a, b) => {
      const aDate = getItemTimestamp(a);
      const bDate = getItemTimestamp(b);
      return effectiveSortBy === 'newest' ? bDate - aDate : aDate - bDate;
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
      goto(resolve(`/calendar/event/${naddr}`));
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
      <div class="tabs-boxed tabs justify-center bg-transparent py-4">
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
  <div class="container mx-auto space-y-4 px-4 py-6">
    <!-- Row 1: Search Input with Button -->
    <div class="flex w-full gap-2">
      <div class="relative flex-1">
        <div class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
          {#if contentType === 'learning' && isLearningSearchActive && learningSearchResults.length === 0}
            <span class="loading loading-sm loading-spinner text-primary"></span>
          {:else}
            <SearchIcon class_="h-5 w-5 text-base-content/50" />
          {/if}
        </div>
        <input
          bind:this={searchInputRef}
          type="text"
          placeholder={m.discover_content_search_placeholder()}
          bind:value={searchQuery}
          onkeydown={handleSearchKeydown}
          class="input-bordered input w-full pr-10 pl-9"
          aria-label={m.discover_content_search_aria()}
        />
        {#if searchQuery}
          <button
            type="button"
            class="btn absolute top-1/2 right-2 btn-circle -translate-y-1/2 btn-ghost btn-sm"
            onclick={clearSearch}
            aria-label={m.discover_content_clear_search()}
          >
            ✕
          </button>
        {/if}
      </div>
      <button type="button" class="btn btn-primary" onclick={executeSearch}>
        <SearchIcon class_="h-5 w-5" />
        <span class="sr-only sm:not-sr-only">{m.discover_search_button()}</span>
      </button>
    </div>

    <!-- Row 2: All dropdown filters in a unified row -->
    <div class="flex flex-wrap items-end gap-4">
      <!-- Sort (not shown for communities) -->
      {#if contentType !== 'communities'}
        <div class="form-control w-full sm:w-auto sm:min-w-[160px]">
          <label for="sort" class="label">
            <span class="label-text font-medium">{m.discover_sort_label()}</span>
          </label>
          <select id="sort" bind:value={sortBy} class="select-bordered select w-full">
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
            onchange={(v) => {
              relayFilter = v;
            }}
            settingsCategory={tabRelayCategory}
          />
        </div>
      {/if}

      <!-- Events Date Range Filter (shown only on events tab) -->
      {#if contentType === 'events'}
        <div class="w-full sm:w-auto">
          <EventDateRangeFilter
            start={eventsDateRangeStart}
            end={eventsDateRangeEnd}
            onrangechange={handleEventsDateRangeChange}
          />
        </div>
      {/if}

      <!-- Learning Content SKOS Filters (shown only on learning tab) -->
      {#if contentType === 'learning'}
        <div class="w-full sm:min-w-[200px] sm:flex-1">
          <LearningContentFilters
            onfilterchange={handleLearningFilterChange}
            isSearching={isLearningSearchActive && learningSearchResults.length === 0}
            searchText={activeSearchQuery}
          />
        </div>
      {/if}
    </div>

    <!-- Tag Filter (not shown for communities or learning) -->
    {#if contentType !== 'communities' && contentType !== 'learning' && allTags.length > 0}
      <div>
        <div class="mb-2 text-sm font-medium text-base-content">{m.discover_filter_by_topic()}</div>
        <div class="flex flex-wrap gap-2">
          {#each allTags.slice(0, 20) as tag (tag)}
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
                class="btn mt-6 gap-2 btn-primary"
                onclick={() => modalStore.openModal('createCommunity')}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
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
              class="btn gap-2 btn-lg btn-primary"
              onclick={() => modalStore.openModal('createCommunity')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
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
            <CommunikeyCard pubkey={community.pubkey} showJoinButton={true} />
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
          <div class="mt-8 flex justify-center py-8">
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
        {:else if (contentType === 'events' && !hasMoreCalendarEvents) || (contentType === 'learning' && !hasMoreAMB && !isLearningSearchActive) || (contentType === 'articles' && !hasMoreArticles) || (contentType === 'all' && !hasMoreArticles && !hasMoreAMB && !hasMoreCalendarEvents)}
          <div class="flex justify-center">
            <p class="text-base-content/50">{m.discover_no_more_content()}</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
