<script>
  import { SvelteMap, SvelteDate, SvelteSet } from 'svelte/reactivity';
  import { onMount } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import {
    communityCalendarTimelineLoader,
    createDateRangeCalendarLoader,
    createRelayFilteredCalendarLoader,
    calendarEventReferencesLoader
  } from '$lib/loaders/calendar.js';
  import { createTimelineLoader } from 'applesauce-loaders/loaders';
  import { timedPool } from '$lib/loaders/base.js';
  import { getViewDateRange } from '$lib/helpers/calendar.js';
  import { getCalendarRelays } from '$lib/helpers/relay-helper.js';
  import { relayUpdateSignal } from '$lib/services/app-relay-service.svelte.js';
  import { modalStore } from '$lib/stores/modal.svelte.js';
  import { calendarFilters } from '$lib/stores/calendar-filters.svelte.js';
  import { manager, useActiveUser } from '$lib/stores/accounts.svelte';
  import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
  import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
  import { GlobalCalendarEventModel } from '$lib/models/global-calendar-event.js';
  import { PersonalCalendarEventsModel, CalendarEventRangeModel } from '$lib/models';
  import {
    createUrlSyncHandler,
    syncInitialUrlState,
    useCalendarEventLoader
  } from '$lib/loaders/calendar-event-loader.svelte.js';
  import { validateCalendarEvent } from '$lib/helpers/eventValidation.js';
  import * as m from '$lib/paraglide/messages';

  // Import existing UI components
  import CalendarNavigation from '$lib/components/calendar/CalendarNavigation.svelte';
  import CalendarGrid from '$lib/components/calendar/CalendarGrid.svelte';
  import CalendarDropdown from './CalendarDropdown.svelte';
  import CalendarFilterSidebar from './CalendarFilterSidebar.svelte';
  import SimpleCalendarEventsList from './CalendarEventsList.svelte';
  import AddToCalendarButton from './AddToCalendarButton.svelte';
  import CalendarMapView from './CalendarMapView.svelte';
  import CompactCommunityHeader from '$lib/components/community/layout/CompactCommunityHeader.svelte';
  import FloatingActionButton from './FloatingActionButton.svelte';

  /**
   * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
   * @typedef {import('$lib/types/calendar.js').CalendarViewMode} CalendarViewMode
   */

  // Props
  let {
    communityPubkey = '',
    globalMode = false,
    calendar = null,
    rawCalendar = null,
    authorPubkey = '',
    communityMode = false,
    communityProfile = null
  } = $props();

  // Use reactive getter for active user to ensure proper reactivity on login/logout
  const getActiveUser = useActiveUser();
  let activeUser = $derived(getActiveUser());

  // Calendar view state (local to this component)
  let currentDate = $state(new Date());
  let viewMode = $state(/** @type {CalendarViewMode} */ ('month'));
  let presentationViewMode = $state(/** @type {'calendar' | 'list' | 'map'} */ ('calendar'));

  // Sidebar state
  let sidebarExpanded = $state(false); // Desktop sidebar collapsed by default
  let drawerOpen = $state(false); // Mobile drawer open state

  // Local component state (loader/model pattern)
  /**
   * @type {import("$lib/types/calendar.js").CalendarEvent[]}
   */
  let allCalendarEvents = $state([]);
  let processedEvents = $state(
    /** @type {import("$lib/types/calendar.js").CalendarEvent[]} */ ([])
  );
  let relayFilteredEventIds = $state(/** @type {string[]} */ ([]));
  let relayFilterActive = $state(false);
  let loading = $state(false);
  let processing = $state(false); // New state for background processing
  let error = $state(/** @type {string | null} */ (null));
  let _selectedCalendar = $state(calendarFilters.selectedCalendar);

  // Validation cache to avoid re-validating same events
  const validationCache = new SvelteMap();
  let processingTimeout = /** @type {ReturnType<typeof setTimeout> | null} */ (null);

  // Subscription management for loaders and models
  // Using plain let (not $state) for subscriptions to avoid infinite loops in $effect
  /** @type {import('rxjs').Subscription | undefined} */
  let calendarSubscription;
  /** @type {import('rxjs').Subscription | undefined} */
  let loaderSubscription;
  /** @type {import('rxjs').Subscription | undefined} */
  let modelSubscription;

  // Date range loading subscription (for global/author modes)
  /** @type {import('rxjs').Subscription | undefined} */
  let dateRangeLoaderSub;

  // Community mode specific state
  let resolutionErrors = $state(/** @type {string[]} */ ([]));

  // Guard to prevent effect from running before mount
  let mounted = $state(false);

  // Reactive check for relay availability - effects will wait until relays are configured
  // This resolves the race condition where effects run before config is initialized
  let relaysReady = $derived(getCalendarRelays().length > 0);

  // Track initial relays at component mount for supplemental loading pattern
  // When user override relays (kind 30002) arrive asynchronously, we detect and query them
  const initialCalendarRelays = new SvelteSet(getCalendarRelays());

  // Track previous community pubkey to detect actual changes
  let previousCommunityPubkey = $state('');

  // Initialize event loader composable for community mode
  const communityEventLoader = useCalendarEventLoader({
    onEventsUpdate: (events) => {
      console.log('📅 CalendarView: Community events updated:', events.length);
      allCalendarEvents = events;
    },
    onLoadingChange: (isLoading) => {
      loading = isLoading;
    },
    onError: (errorMsg) => {
      error = errorMsg;
    }
  });

  // Watch for communityPubkey changes and reload events
  $effect(() => {
    if (mounted && communityMode && communityPubkey) {
      // Only reload if the community actually changed
      if (communityPubkey !== previousCommunityPubkey) {
        console.log(
          '📅 CalendarView: Community changed from',
          previousCommunityPubkey,
          'to:',
          communityPubkey
        );
        previousCommunityPubkey = communityPubkey;
        // Use the event loader composable for community mode
        communityEventLoader.loadByCommunity(communityPubkey);
      }
    }
  });

  // Date range loading for globalMode/authorMode - reacts to currentDate and viewMode changes
  // This effect loads events for the visible date range using the calendar-relay's
  // special filter syntax (#start_after, #start_before) with fallback for other relays
  $effect(() => {
    // Subscribe to relay update signal via Svelte store auto-subscription ($storeName)
    // This ensures the effect re-runs when user relay overrides are loaded
    const _relaySignal = $relayUpdateSignal;

    // Debug: trace effect execution
    console.log(
      '📅 CalendarView: Main effect running - globalMode:',
      globalMode,
      'authorPubkey:',
      authorPubkey,
      'relaysReady:',
      relaysReady,
      'relaySignal:',
      _relaySignal
    );

    // Only run for globalMode or authorPubkey modes
    if (!globalMode && !authorPubkey) {
      console.log('📅 CalendarView: Skipping - not globalMode or authorPubkey');
      return;
    }
    // Skip if in community mode or using a specific calendar
    if (communityMode || calendar) {
      console.log('📅 CalendarView: Skipping - communityMode or calendar');
      return;
    }
    // Wait for relays to be configured (resolves race condition with async config)
    if (!relaysReady) {
      console.log('📅 CalendarView: Waiting for relay config...');
      return;
    }

    // Clean up previous date range subscription
    dateRangeLoaderSub?.unsubscribe();

    // Get authors filter - use authorPubkey if set, otherwise use filter state
    const authors = authorPubkey ? [authorPubkey] : calendarFilters.getSelectedAuthors();

    if (viewMode === 'all') {
      // 'all' view mode: No date filtering, use standard loader
      console.log('📅 CalendarView: Loading all events (no date filter)');
      const relays = calendarFilters.selectedRelays;
      const loader = createRelayFilteredCalendarLoader(relays, { authors });
      dateRangeLoaderSub = loader().subscribe({
        error: (/** @type {any} */ err) => {
          console.error('📅 CalendarView: All events loader error:', err);
        },
        complete: () => {
          console.log('📅 CalendarView: All events loader complete');
        }
      });
    } else {
      // Date-filtered view: Use date range loader with NIP-52 filter syntax
      const { start, end } = getViewDateRange(currentDate, viewMode);

      console.log(
        '📅 CalendarView: Loading events for date range:',
        new Date(start * 1000).toISOString(),
        'to',
        new Date(end * 1000).toISOString()
      );

      const loader = createDateRangeCalendarLoader(
        {
          startAfter: start,
          startBefore: end,
          endAfter: start // Include events still ongoing
        },
        { authors }
      );
      dateRangeLoaderSub = loader().subscribe({
        error: (/** @type {any} */ err) => {
          console.error('📅 CalendarView: Date range loader error:', err);
        },
        complete: () => {
          console.log('📅 CalendarView: Date range loader complete');
        }
      });
    }

    return () => {
      dateRangeLoaderSub?.unsubscribe();
    };
  });

  // Supplemental relay loading: when user override relays (kind 30002) arrive after
  // initial mount, this effect detects the new relays and queries them.
  // This pattern ensures we don't miss events from user-configured relays that
  // weren't available at initial load time.
  $effect(() => {
    // Subscribe to relay update signal to trigger re-runs when user overrides arrive
    // Svelte 5 doesn't auto-track reactive reads inside helper functions, so we need
    // this explicit subscription to know when userOverrideCache changes
    const _relaySignal = $relayUpdateSignal;

    // Only run for globalMode or authorPubkey modes (not community or specific calendar)
    if (!globalMode && !authorPubkey) return;
    if (communityMode || calendar) return;

    const currentRelays = getCalendarRelays();
    const newRelays = currentRelays.filter((r) => !initialCalendarRelays.has(r));

    if (newRelays.length === 0) return;

    console.log('📅 CalendarView: Supplemental relay loading - new relays detected:', newRelays);

    // Add new relays to tracking set so we don't re-query them
    newRelays.forEach((r) => initialCalendarRelays.add(r));

    // Create a loader for just the new relays
    const loader = createTimelineLoader(
      timedPool,
      newRelays,
      { kinds: [31922, 31923], limit: 40 },
      { eventStore }
    );

    const sub = loader().subscribe({
      error: (/** @type {any} */ err) => {
        console.error('📅 CalendarView: Supplemental relay loader error:', err);
      },
      complete: () => {
        console.log('📅 CalendarView: Supplemental relay loader complete');
      }
    });

    return () => sub.unsubscribe();
  });

  // Reactive model subscription for globalMode/authorMode - reacts to date range changes
  // This effect uses CalendarEventRangeModel for date-filtered views (month/week/day)
  // and GlobalCalendarEventModel for 'all' view mode
  $effect(() => {
    // Only handle globalMode or authorPubkey modes
    if (!globalMode && !authorPubkey) return;
    // Skip if in community mode - that's handled by communityEventLoader
    if (communityMode) return;
    // Skip if using a specific calendar - that's handled by loadEvents()
    if (calendar) return;
    // Wait for relays to be configured
    if (!relaysReady) return;

    // Get authors filter
    const authors = authorPubkey ? [authorPubkey] : calendarFilters.getSelectedAuthors();

    // Clean up previous model subscription
    modelSubscription?.unsubscribe();

    if (viewMode === 'all') {
      // 'all' view: No date filtering, use GlobalCalendarEventModel
      modelSubscription = eventStore
        .model(GlobalCalendarEventModel, authors)
        .subscribe((/** @type {any} */ calendarEvents) => {
          allCalendarEvents = calendarEvents;
          loading = false;
        });
    } else {
      // Date-filtered view: Use CalendarEventRangeModel
      const { start, end } = getViewDateRange(currentDate, viewMode);
      console.log(
        '📅 CalendarView: Model subscription for date range:',
        new Date(start * 1000).toISOString(),
        'to',
        new Date(end * 1000).toISOString()
      );
      modelSubscription = eventStore
        .model(CalendarEventRangeModel, start, end, authors)
        .subscribe((/** @type {any} */ calendarEvents) => {
          allCalendarEvents = calendarEvents;
          loading = false;
        });
    }

    return () => modelSubscription?.unsubscribe();
  });

  // Sync initial URL state on mount
  syncInitialUrlState(
    $page.url.searchParams,
    (/** @type {'calendar' | 'list' | 'map'} */ mode) => {
      presentationViewMode = mode;
    },
    (/** @type {CalendarViewMode} */ mode) => {
      viewMode = mode;
    }
  );

  // Set up navigation listener - runs after every navigation
  afterNavigate(
    createUrlSyncHandler(
      (/** @type {'calendar' | 'list' | 'map'} */ mode) => {
        presentationViewMode = mode;
      },
      (/** @type {CalendarViewMode} */ mode) => {
        viewMode = mode;
      }
    )
  );

  // Get community profile for calendar title (when in communityMode)
  let getCommunityProfile = $derived.by(() => {
    if (communityMode && communityPubkey) {
      return useUserProfile(communityPubkey);
    }
    return null;
  });

  let communityProfileData = $derived.by(() => {
    if (getCommunityProfile) {
      return getCommunityProfile();
    }
    return null;
  });

  let communityCalendarTitle = $derived.by(() => {
    if (!communityProfileData) return 'Community Calendar';
    const displayName = communityProfileData.name || communityProfileData.display_name || '';
    return displayName ? `${displayName} Calendar` : 'Community Calendar';
  });

  /**
   * Load calendar events using direct loader/model pattern
   */
  function loadEvents() {
    // Clean up existing subscriptions
    loaderSubscription?.unsubscribe();
    modelSubscription?.unsubscribe();

    loading = true;
    allCalendarEvents = [];
    error = null;
    resolutionErrors = [];

    if (communityMode && communityPubkey) {
      // Community mode: Use the event loader composable
      console.log(
        '📅 CalendarView: Loading community calendar events using composable for:',
        communityPubkey
      );
      communityEventLoader.loadByCommunity(communityPubkey);
    } else if (globalMode || authorPubkey) {
      // Global mode or Author mode: Loading is handled by the reactive $effect
      // The $effect uses createDateRangeCalendarLoader for proper NIP-52 date filtering
      // and CalendarEventRangeModel for reactive model subscriptions
      console.log(
        '📅 CalendarView: Global/Author mode - loader managed by reactive $effect',
        globalMode ? 'globalMode' : `authorPubkey: ${authorPubkey}`
      );

      // Reset relay filter state
      const relays = calendarFilters.selectedRelays;
      relayFilterActive = relays.length > 0;
      relayFilteredEventIds = [];

      // Note: The actual loader and model subscriptions are managed by the reactive $effects
      // which will run after mount and react to currentDate/viewMode changes
    } else if (calendar && rawCalendar) {
      // Calendar mode: Load events from specific calendar
      console.log('📅 CalendarView: Loading events for calendar:', calendar.id);

      // 1. Loader: Fetch calendar's referenced events from relays → EventStore
      loaderSubscription = calendarEventReferencesLoader(rawCalendar)().subscribe({
        next: (/** @type {any} */ event) => {
          console.log('📅 CalendarView: Loaded calendar event:', event);
        },
        error: (/** @type {any} */ err) => {
          console.error('📅 CalendarView: Calendar event references loader error:', err);
          error = err.message || 'Failed to load calendar events';
          loading = false;
        },
        complete: () => {
          console.log('📅 CalendarView: Calendar event references loader complete');
          // Note: Don't set loading = false here since the model subscription
          // will handle that when events are processed
        }
      });

      // 2. Model: Use applesauce's CalendarEventsModel with raw calendar Event
      // CalendarEventsModel expects a raw Nostr Event, not a transformed CalendarEvent
      // It returns raw Nostr events, so we need to transform them
      modelSubscription = eventStore
        .model(PersonalCalendarEventsModel, rawCalendar)
        .subscribe((/** @type {any} */ calendarEvents) => {
          console.log('📅 CalendarView: Received', calendarEvents, 'calendar events');
          allCalendarEvents = calendarEvents;
          loading = false;
        });
    } else {
      // No valid loading mode
      console.warn('📅 CalendarView: No valid loading mode specified');
      loading = false;
    }
  }

  /**
   * Refresh calendar events
   * @param {string[]} [relays] - Optional relay filters to apply
   */
  function handleRefresh(relays) {
    console.log('📅 CalendarView: Refreshing calendar events');
    if (relays) {
      calendarFilters.selectedRelays = relays;
    }
    loadEvents();
  }

  onMount(() => {
    console.log(
      '🎬 CalendarView: onMount - activeUser on mount:',
      activeUser?.pubkey?.substring(0, 8)
    );

    // Set mounted flag to allow effects to run
    mounted = true;

    // Bootstrap EventStore with appropriate loader (unless in community mode)
    if (communityMode && communityPubkey) {
      // Bootstrap EventStore with community calendar loader
      communityCalendarTimelineLoader(communityPubkey)().subscribe({
        complete: () => {
          console.log('📅 CalendarView: Community calendar loader bootstrap complete');
        },
        error: (/** @type {any} */ err) => {
          console.warn('📅 CalendarView: Community calendar loader bootstrap error:', err);
        }
      });
    }

    // Subscribe to calendar selection changes (only when no calendar prop provided)
    if (!calendar) {
      calendarSubscription = calendarFilters.selectedCalendar$.subscribe((cal) => {
        _selectedCalendar = cal;
        console.log('📅 CalendarView: selectedCalendar changed to:', cal?.id);
      });
    }

    // Load events on mount based on initial state
    handleRefresh();

    // Cleanup subscriptions on unmount
    return () => {
      calendarSubscription?.unsubscribe();
      loaderSubscription?.unsubscribe();
      modelSubscription?.unsubscribe();
      dateRangeLoaderSub?.unsubscribe();
      communityEventLoader.cleanup();
    };
  });

  function handlePrevious() {
    const newDate = new SvelteDate(currentDate);
    switch (viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
    }
    currentDate = newDate;
  }

  function handleNext() {
    const newDate = new SvelteDate(currentDate);
    switch (viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
    }
    currentDate = newDate;
  }

  function handleToday() {
    currentDate = new Date();
  }

  /**
   * @param {CalendarViewMode} newViewMode
   */
  function handleViewModeChange(newViewMode) {
    viewMode = newViewMode;
  }

  /**
   * @param {'calendar' | 'list' | 'map'} newPresentationViewMode
   */
  function handlePresentationViewModeChange(newPresentationViewMode) {
    // NOTE: This function is no longer called from CalendarNavigation
    // All state updates now flow through URL → useCalendarUrlSync → callbacks
    // Keeping this function for backwards compatibility with other potential callers
    presentationViewMode = newPresentationViewMode;
    console.log('📅 CalendarView: Presentation view mode changed to:', newPresentationViewMode);
  }

  /**
   * @param {Date} date
   */
  function handleDateClick(date) {
    currentDate = new Date(date);
    viewMode = 'day';
  }

  /**
   * @param {CalendarEvent} event
   */
  function handleEventClick(event) {
    modalStore.openModal('eventDetails', { event });
    console.log('📅 CalendarView: Event clicked, opening details modal:', event.title);
  }

  /**
   * Handle relay filter changes
   * @param {string[]} relays
   */
  function handleRelayFilterChange(relays) {
    console.log('📅 CalendarView: Relay filters changed:', relays);
    // Trigger a refresh with the new relay filters, passing them directly
    handleRefresh(relays);
  }

  /**
   * Handle tag filter changes
   * @param {string[]} tags
   */
  function handleTagFilterChange(tags) {
    console.log('🏷️ CalendarView: Tag filters changed:', tags);
    // Tag filtering is client-side, so no refresh needed
    // The displayedEvents derived state will automatically update
  }

  /**
   * Handle search query changes
   * @param {string} query
   */
  function handleSearchQueryChange(query) {
    console.log('🔍 CalendarView: Search query changed:', query);
    // Search filtering is client-side, so no refresh needed
    // The displayedEvents derived state will automatically update
  }

  /**
   * Handle follow list filter changes
   * @param {string[]} listIds
   */
  function handleFollowListFilterChange(listIds) {
    console.log('👥 CalendarView: Follow list filters changed:', listIds);
    // Trigger a refresh with the new author filters
    handleRefresh();
  }

  // Create derived state for proper reactivity tracking
  let selectedTags = $derived(calendarFilters.selectedTags);
  let searchQuery = $derived(calendarFilters.searchQuery);

  /**
   * Process events in chunks to avoid blocking the UI
   * @param {import("$lib/types/calendar.js").CalendarEvent[]} events
   */
  function processEventsInChunks(events) {
    // Clear any existing processing timeout
    if (processingTimeout) {
      clearTimeout(processingTimeout);
    }

    // UI is immediately responsive - set loading to false
    loading = false;
    processing = true;

    // Process events in chunks
    const CHUNK_SIZE = 20;
    let currentIndex = 0;
    const validatedEvents = /** @type {import("$lib/types/calendar.js").CalendarEvent[]} */ ([]);

    function processNextChunk() {
      const end = Math.min(currentIndex + CHUNK_SIZE, events.length);

      for (let i = currentIndex; i < end; i++) {
        const event = events[i];

        // Check cache first
        if (!validationCache.has(event.id)) {
          const isValid = validateCalendarEvent(event.originalEvent || event);
          validationCache.set(event.id, isValid);
        }

        if (validationCache.get(event.id)) {
          validatedEvents.push(event);
        }
      }

      // Update processed events
      processedEvents = [...validatedEvents];

      currentIndex = end;

      if (currentIndex < events.length) {
        // Schedule next chunk
        processingTimeout = setTimeout(processNextChunk, 0);
      } else {
        // Processing complete
        processing = false;
      }
    }

    // Start processing
    processNextChunk();
  }

  // Derived state: Apply relay filtering via intersection
  let events = $derived.by(() => {
    if (relayFilterActive && relayFilteredEventIds.length > 0) {
      // Filter: only show events from selected relays
      const filtered = allCalendarEvents.filter((e) => relayFilteredEventIds.includes(e.id));
      console.log(
        `🔗 CalendarView: Filtered ${filtered.length}/${allCalendarEvents.length} events by relay (${relayFilteredEventIds.length} IDs tracked)`
      );
      return filtered;
    }
    // No relay filter: show all events
    return allCalendarEvents;
  });

  // Watch for changes to events and trigger chunked processing
  $effect(() => {
    if (events.length > 0) {
      processEventsInChunks(events);
    } else {
      processedEvents = [];
      processing = false;
    }
  });

  // Use processed events for validation (now cached and processed in chunks)
  let validEvents = $derived(processedEvents);

  // Client-side filtering with tag buttons (OR logic) + text search (AND logic)
  // Events are filtered AFTER loading and validation
  let displayedEvents = $derived.by(() => {
    let filtered = validEvents; // Start with validated events

    // Step 1: Apply tag filtering (OR logic)
    if (selectedTags.length > 0) {
      filtered = filtered.filter((event) => {
        // Normalize event hashtags to lowercase for case-insensitive matching
        const normalizedHashtags = (event.hashtags || []).map((/** @type {any} */ tag) =>
          tag.toLowerCase().trim()
        );

        // Check if event has any of the selected tags
        return selectedTags.some((/** @type {any} */ tag) => normalizedHashtags.includes(tag));
      });
      console.log(
        `🏷️ CalendarView: Filtered ${filtered.length}/${validEvents.length} events by tags:`,
        selectedTags
      );
    }

    // Step 2: Apply text search (AND logic with tags)
    const query = searchQuery.trim();
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter((event) => {
        // Search in title
        const titleMatch = event.title?.toLowerCase().includes(lowerQuery);

        // Search in tags
        const tagMatch = event.hashtags?.some((tag) => tag.toLowerCase().includes(lowerQuery));

        return titleMatch || tagMatch;
      });
      console.log(
        `🔍 CalendarView: Filtered ${filtered.length} events by search query: "${query}"`
      );
    }

    return filtered;
  });
</script>

<!-- Main layout with flex for sidebar + content -->
<div class="flex w-full max-w-full">
  <!-- Filter Sidebar (only if not community mode) -->
  {#if !communityMode}
    <CalendarFilterSidebar
      bind:isExpanded={sidebarExpanded}
      bind:isDrawerOpen={drawerOpen}
      {validEvents}
      onRelayFilterChange={handleRelayFilterChange}
      onFollowListFilterChange={handleFollowListFilterChange}
      onSearchQueryChange={handleSearchQueryChange}
      onTagFilterChange={handleTagFilterChange}
    />
  {/if}

  <!-- Main content area -->
  <div
    class="min-w-0 flex-1 overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm"
  >
    <!-- Community Context Header (community mode only) -->
    {#if communityMode && communityProfile && communityPubkey}
      <CompactCommunityHeader {communityProfile} {communityPubkey} />
    {/if}

    <!-- Calendar Header -->
    <div class="border-b border-base-300 bg-base-200 px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          {#if communityMode}
            <h2 class="text-lg font-semibold text-base-content">
              {m.calendar_view_community_calendar()}
            </h2>
          {:else}
            <CalendarDropdown currentCalendar={calendar} />
          {/if}
        </div>
        <div class="flex items-center gap-3">
          <!-- Add to Calendar Button (community mode only) -->
          {#if communityMode && communityPubkey}
            <AddToCalendarButton
              calendarId={communityPubkey}
              calendarTitle={communityCalendarTitle}
            />
          {/if}
        </div>
      </div>
    </div>

    <!-- Error Display -->
    {#if error}
      <div class="alert rounded-none border-b border-error/20 px-6 py-3 alert-error">
        <div class="flex items-center gap-3">
          <svg class="h-5 w-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span class="flex-1 text-sm">{error}</span>
          <button
            class="btn btn-ghost btn-xs"
            onclick={() => (error = null)}
            aria-label={m.calendar_view_dismiss_error()}
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- Resolution Errors Display (community mode) -->
    {#if communityMode && resolutionErrors.length > 0}
      <div class="alert rounded-none border-b border-warning/20 px-6 py-3 alert-warning">
        <div class="flex items-start gap-3">
          <svg
            class="mt-0.5 h-5 w-5 text-warning"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <div class="flex-1">
            <h4 class="mb-1 text-sm font-medium">{m.calendar_view_resolution_error_title()}</h4>
            <p class="mb-2 text-xs text-base-content/70">
              {m.calendar_view_resolution_error_desc({
                count: resolutionErrors.length,
                plural: resolutionErrors.length === 1 ? '' : 's',
                n: resolutionErrors.length
              })}
            </p>
            <details class="text-xs">
              <summary class="cursor-pointer hover:text-base-content"
                >{m.calendar_view_show_details()}</summary
              >
              <ul class="mt-2 space-y-1">
                {#each resolutionErrors as errorMsg, index (index)}
                  <li class="text-base-content/60">• {errorMsg}</li>
                {/each}
              </ul>
            </details>
          </div>
          <button
            class="btn btn-ghost btn-xs"
            onclick={() => (resolutionErrors = [])}
            aria-label={m.calendar_view_dismiss_resolution()}
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- Calendar Navigation -->
    <CalendarNavigation
      {currentDate}
      {viewMode}
      {presentationViewMode}
      {communityMode}
      onPrevious={handlePrevious}
      onNext={handleNext}
      onToday={handleToday}
      onViewModeChange={handleViewModeChange}
      onPresentationViewModeChange={handlePresentationViewModeChange}
      onFilterButtonClick={() => {
        drawerOpen = true;
      }}
    />

    <!-- Content based on presentation view mode -->
    {#if presentationViewMode === 'calendar'}
      <!-- Calendar Grid -->
      <CalendarGrid
        {currentDate}
        {viewMode}
        events={displayedEvents}
        onEventClick={handleEventClick}
        onDateClick={handleDateClick}
      />
    {:else if presentationViewMode === 'list'}
      <!-- List View -->
      <SimpleCalendarEventsList
        events={displayedEvents}
        {viewMode}
        {currentDate}
        {loading}
        {error}
      />
    {:else if presentationViewMode === 'map'}
      <!-- Map View -->
      <CalendarMapView events={displayedEvents} {viewMode} {currentDate} />
    {/if}

    <!-- Loading indicator with progress -->
    {#if loading}
      <div class="border-b border-base-300 px-6 py-3 text-center">
        <div class="flex items-center justify-center gap-3">
          <div class="loading loading-sm loading-spinner"></div>
          <div class="text-sm text-base-content/70">
            {#if events.length === 0}
              {m.calendar_view_loading_events()}
            {:else}
              {m.calendar_view_loading_more({ count: events.length })}
            {/if}
          </div>
        </div>
      </div>
    {:else if processing}
      <div class="border-b border-base-300 px-6 py-3 text-center">
        <div class="flex items-center justify-center gap-3">
          <div class="loading loading-sm loading-spinner"></div>
          <div class="text-sm text-base-content/70">
            {m.calendar_view_processing({ valid: validEvents.length, total: events.length })}
          </div>
        </div>
      </div>
    {/if}

    <!-- Empty State -->
    {#if events.length === 0 && !loading}
      <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div class="mb-4 text-base-content/30">
          <svg class="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 class="mb-2 text-lg font-medium text-base-content">
          {globalMode
            ? m.calendar_view_empty_global_title()
            : m.calendar_view_empty_community_title()}
        </h3>
        <p class="mb-6 max-w-md text-base-content/60">
          {#if globalMode}
            {m.calendar_view_empty_global_desc()}
          {:else}
            {m.calendar_view_empty_community_desc()}
          {/if}
        </p>
      </div>
    {/if}
  </div>
</div>

<!-- Floating Action Button for community calendars -->
{#if communityMode && manager.active}
  <FloatingActionButton {communityPubkey} />
{/if}
