<script>
	import { onMount, onDestroy } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		communityCalendarTimelineLoader,
		createRelayFilteredCalendarLoader,
		calendarEventReferencesLoader
	} from '$lib/loaders/calendar.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { calendarFilters } from '$lib/stores/calendar-filters.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { CommunityCalendarEventModel } from '$lib/models/community-calendar-event.js';
	import { GlobalCalendarEventModel } from '$lib/models/global-calendar-event.js';
	import { PersonalCalendarEventsModel } from '$lib/models';
	import { createUrlSyncHandler, syncInitialUrlState, useCalendarEventLoader } from '$lib/loaders';
	import { validateCalendarEvent } from '$lib/helpers/eventValidation.js';

	// Import existing UI components
	import CalendarNavigation from '$lib/components/calendar/CalendarNavigation.svelte';
	import CalendarGrid from '$lib/components/calendar/CalendarGrid.svelte';
	import CalendarEventModal from '$lib/components/calendar/CalendarEventModal.svelte';
	import CalendarDropdown from './CalendarDropdown.svelte';
	import CalendarFilterSidebar from './CalendarFilterSidebar.svelte';
	import SimpleCalendarEventsList from './CalendarEventsList.svelte';
	import AddToCalendarButton from './AddToCalendarButton.svelte';
	import CalendarMapView from './CalendarMapView.svelte';

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
		communityMode = false
	} = $props();

	// Use runes store for reactive state
	let activeUser = $state(manager.active);

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
	let selectedCalendar = $state(calendarFilters.selectedCalendar);

	// Validation cache to avoid re-validating same events
	const validationCache = new Map();
	let processingTimeout = /** @type {ReturnType<typeof setTimeout> | null} */ (null);

	// Modal state
	let isEventModalOpen = $state(false);
	let selectedDateForNewEvent = $state(/** @type {Date | null} */ (null));

	// Subscription management for loaders and models
	let userSubscription = $state();
	let calendarSubscription = $state();
	let loaderSubscription = $state();
	let modelSubscription = $state();

	// Community mode specific state
	let resolutionErrors = $state(/** @type {string[]} */ ([]));

	// Guard to prevent effect from running before mount
	let mounted = $state(false);

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
				console.log('📅 CalendarView: Community changed from', previousCommunityPubkey, 'to:', communityPubkey);
				previousCommunityPubkey = communityPubkey;
				// Use the event loader composable for community mode
				communityEventLoader.loadByCommunity(communityPubkey);
			}
		}
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
	afterNavigate(createUrlSyncHandler(
		(/** @type {'calendar' | 'list' | 'map'} */ mode) => {
			presentationViewMode = mode;
		},
		(/** @type {CalendarViewMode} */ mode) => {
			viewMode = mode;
		}
	));

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
			console.log('📅 CalendarView: Loading community calendar events using composable for:', communityPubkey);
			communityEventLoader.loadByCommunity(communityPubkey);
		} else if (globalMode) {
			// Global mode: Load all events from relays
			console.log('📅 CalendarView: Loading global calendar events');
			const relays = calendarFilters.selectedRelays;
			const authors = calendarFilters.getSelectedAuthors();

			// Track if relay filter is active
			relayFilterActive = relays.length > 0;
			relayFilteredEventIds = [];

			// Temporary array to collect IDs during loader subscription
			const trackedIds = /** @type {string[]} */ ([]);

			// 1. Loader: Fetch from relays → EventStore
			loaderSubscription = createRelayFilteredCalendarLoader(relays, authors)().subscribe({
				next: (/** @type {any} */ event) => {
					// Track event IDs from selected relays
					if (relayFilterActive) {
						trackedIds.push(event.id);
						// Trigger reactivity by reassigning
						relayFilteredEventIds = [...trackedIds];
						console.log(
							'📅 CalendarView: Tracked event from relay:',
							event.id,
							`(${trackedIds.length} total)`
						);
					}
				},
				error: (/** @type {any} */ err) => {
					console.error('📅 CalendarView: Global calendar loader error:', err);
					error = err.message || 'Failed to load calendar events';
					loading = false;
				}
			});

			// 2. Model: Transform and provide reactive updates from EventStore
			modelSubscription = eventStore
				.model(GlobalCalendarEventModel, authors)
				.subscribe((/** @type {any} */ calendarEvents) => {
					allCalendarEvents = calendarEvents;
					loading = false;
				});
		} else if (authorPubkey) {
			// Author mode: Load events by specific author
			console.log('📅 CalendarView: Loading calendar events for author:', authorPubkey);
			const relays = calendarFilters.selectedRelays;

			// Track if relay filter is active
			relayFilterActive = relays.length > 0;
			relayFilteredEventIds = [];

			// Temporary array to collect IDs during loader subscription
			const trackedIds = /** @type {string[]} */ ([]);

			// 1. Loader: Fetch from relays → EventStore
			loaderSubscription = createRelayFilteredCalendarLoader(relays, [authorPubkey])().subscribe({
				next: (/** @type {any} */ event) => {
					// Track event IDs from selected relays
					if (relayFilterActive) {
						trackedIds.push(event.id);
						// Trigger reactivity by reassigning
						relayFilteredEventIds = [...trackedIds];
					}
				},
				error: (/** @type {any} */ err) => {
					console.error('📅 CalendarView: Author calendar loader error:', err);
					error = err.message || 'Failed to load calendar events';
					loading = false;
				}
			});

			// 2. Model: Transform and provide reactive updates from EventStore
			modelSubscription = eventStore
				.model(GlobalCalendarEventModel, [authorPubkey])
				.subscribe((/** @type {any} */ calendarEvents) => {
					console.log('📅 CalendarView: Received', calendarEvents.length, 'author calendar events');
					allCalendarEvents = calendarEvents;
					loading = false;
				});
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

		userSubscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});

		// Subscribe to calendar selection changes (only when no calendar prop provided)
		if (!calendar) {
			calendarSubscription = calendarFilters.selectedCalendar$.subscribe((cal) => {
				selectedCalendar = cal;
				console.log('📅 CalendarView: selectedCalendar changed to:', cal?.id);
			});
		}

		// Load events on mount based on initial state
		handleRefresh();

		// Cleanup subscriptions on unmount
		return () => {
			userSubscription?.unsubscribe();
			calendarSubscription?.unsubscribe();
			loaderSubscription?.unsubscribe();
			modelSubscription?.unsubscribe();
			communityEventLoader.cleanup();
		};
	});

	function handlePrevious() {
		const newDate = new Date(currentDate);
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
		const newDate = new Date(currentDate);
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

	function handleCreateEvent() {
		selectedDateForNewEvent = currentDate;
		isEventModalOpen = true;
	}

	function handleEventModalClose() {
		isEventModalOpen = false;
		selectedDateForNewEvent = null;
	}

	function handleEventCreated() {
		// Refresh events to show the newly created event
		handleRefresh();
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
				console.log(`📅 CalendarView: Processed ${validatedEvents.length}/${events.length} events`);
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
	<div class="flex-1 min-w-0 overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm">
		<!-- Calendar Header -->
		<div class="border-b border-base-300 bg-base-200 px-6 py-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				{#if communityMode}
					<h2 class="text-lg font-semibold text-base-content">Community Calendar</h2>
				{:else}
					<CalendarDropdown currentCalendar={calendar} />
				{/if}
			</div>
			<div class="flex items-center gap-3">
				{#if !globalMode && !calendar && manager.active}
					<button class="btn gap-2 btn-sm btn-primary" onclick={handleCreateEvent}>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6v6m0 0v6m0-6h6m-6 0H6"
							/>
						</svg>
						Create Event
					</button>
				{/if}

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
		<div class="alert rounded-none border-b alert-error border-error/20 px-6 py-3">
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
					aria-label="Dismiss error"
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
		<div class="alert rounded-none border-b alert-warning border-warning/20 px-6 py-3">
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
					<h4 class="mb-1 text-sm font-medium">Some calendar events could not be loaded</h4>
					<p class="mb-2 text-xs text-base-content/70">
						{resolutionErrors.length} referenced event{resolutionErrors.length === 1 ? '' : 's'} could
						not be found or loaded.
					</p>
					<details class="text-xs">
						<summary class="cursor-pointer hover:text-base-content">Show details</summary>
						<ul class="mt-2 space-y-1">
							{#each resolutionErrors as errorMsg}
								<li class="text-base-content/60">• {errorMsg}</li>
							{/each}
						</ul>
					</details>
				</div>
				<button
					class="btn btn-ghost btn-xs"
					onclick={() => (resolutionErrors = [])}
					aria-label="Dismiss resolution errors"
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
		onFilterButtonClick={() => { drawerOpen = true; }}
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
		<SimpleCalendarEventsList events={displayedEvents} {viewMode} {currentDate} {loading} {error} />
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
						Loading calendar events...
					{:else}
						Loading more events... ({events.length} loaded)
					{/if}
				</div>
			</div>
		</div>
	{:else if processing}
		<div class="border-b border-base-300 px-6 py-3 text-center">
			<div class="flex items-center justify-center gap-3">
				<div class="loading loading-sm loading-spinner"></div>
				<div class="text-sm text-base-content/70">
					Processing events... ({validEvents.length}/{events.length})
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
				{globalMode ? 'No calendar events found' : 'No events yet'}
			</h3>
			<p class="mb-6 max-w-md text-base-content/60">
				{#if globalMode}
					No calendar events found from connected relays. Check back later for new events.
				{:else}
					This community doesn't have any calendar events yet. Be the first to create one!
				{/if}
			</p>
			{#if !globalMode && manager.active}
				<button class="btn btn-primary" onclick={handleCreateEvent}> Create First Event </button>
			{/if}
		</div>
	{/if}

		<!-- Event Creation Modal -->
		<CalendarEventModal
			isOpen={isEventModalOpen}
			{communityPubkey}
			selectedDate={selectedDateForNewEvent}
			onClose={handleEventModalClose}
			onEventCreated={handleEventCreated}
		/>
	</div>
</div>
