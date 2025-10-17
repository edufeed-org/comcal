<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { communityCalendarTimelineLoader } from '$lib/loaders.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { calendarStore, loading } from '$lib/stores/calendar-events.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
	import {
		useCalendarEventLoader,
		useCalendarUrlSync
	} from '$lib/stores/calendar-event-loader.svelte.js';

	// Import existing UI components
	import CalendarNavigation from '$lib/components/calendar/CalendarNavigation.svelte';
	import CalendarGrid from '$lib/components/calendar/CalendarGrid.svelte';
	import CalendarEventModal from '$lib/components/calendar/CalendarEventModal.svelte';
	import CalendarDropdown from './CalendarDropdown.svelte';
	import RelaySelector from './RelaySelector.svelte';
	import FollowListSelector from './FollowListSelector.svelte';
	import SearchInput from './SearchInput.svelte';
	import TagSelector from './TagSelector.svelte';
	import SimpleCalendarEventsList from './CalendarEventsList.svelte';
	import AddToCalendarButton from './AddToCalendarButton.svelte';

	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
	 * @typedef {import('$lib/types/calendar.js').CalendarViewMode} CalendarViewMode
	 */

	// Props
	let {
		communityPubkey = '',
		globalMode = false,
		calendar = null,
		authorPubkey = '',
		communityMode = false
	} = $props();

	// Use runes store for reactive state
	let activeUser = $state(manager.active);

	// Calendar view state (local to this component)
	let currentDate = $state(new Date());
	let viewMode = $state(/** @type {CalendarViewMode} */ ('month'));
	let presentationViewMode = $state(/** @type {'calendar' | 'list' | 'map'} */ ('calendar'));

	// Reactive references to store state
	/**
	 * @type {import("$lib/types/calendar.js").CalendarEvent[]}
	 */
	let events = $state([]);
	let error = $derived(calendarStore.error);
	let selectedCalendar = $state(calendarStore.selectedCalendar);
	let missingEvents = $derived(calendarStore.missingEvents);
	let hasMissingEvents = $derived(calendarStore.hasMissingEvents);
	let missingEventsCount = $derived(calendarStore.missingEventsCount);

	// Modal state
	let isEventModalOpen = $state(false);
	let selectedDateForNewEvent = $state(/** @type {Date | null} */ (null));

	// Subscription management (non-loader subscriptions only)
	let userSubscription = $state();
	let calendarSubscription = $state();

	// Community mode specific state
	let resolutionErrors = $state(/** @type {string[]} */ ([]));

	// Initialize event loader composable
	const eventLoaderComposable = useCalendarEventLoader({
		onEventsUpdate: (newEvents) => {
			events = newEvents;
		},
		onLoadingChange: (isLoading) => {
			loading.loading = isLoading;
		},
		onError: (errorMsg) => {
			error = errorMsg;
		},
		onResolutionErrors: (errors) => {
			resolutionErrors = errors;
		}
	});

	// Initialize URL sync composable
	useCalendarUrlSync($page, (mode) => {
		presentationViewMode = mode;
		// If switching to calendar view and viewMode is 'all', switch to 'month'
		if (mode === 'calendar' && viewMode === 'all') {
			viewMode = 'month';
		}
	});

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
	 * Refresh calendar events
	 * @param {string[]} [relays] - Optional relay URLs to use for filtering
	 */
	function handleRefresh(relays) {
		const selectedRelays = relays !== undefined ? relays : calendarStore.selectedRelays;
		const selectedAuthors = calendarStore.getSelectedAuthors();

		if (communityMode) {
			eventLoaderComposable.loadByCommunity(communityPubkey);
		} else if (authorPubkey) {
			eventLoaderComposable.loadByAuthor(authorPubkey, selectedRelays);
		} else if (calendar) {
			eventLoaderComposable.loadByCalendar(calendar);
		} else {
			// Global mode
			eventLoaderComposable.loadGlobal(selectedRelays, selectedAuthors);
		}
	}

	// React to calendar prop changes - enables automatic event reloading when switching calendars
	$effect(() => {
		// Only react when in calendar mode (not author or global mode)
		if (calendar && !authorPubkey && !globalMode) {
			console.log('📅 CalendarView: Calendar prop changed, reloading events:', calendar.title);
			eventLoaderComposable.loadByCalendar(calendar);
		}
	});

	// Sync newly created events from calendarStore to local events array
	$effect(() => {
		// Watch for changes in calendarStore.events
		const storeEvents = calendarStore.events;

		if (storeEvents.length > 0) {
			// Create a Set of current event IDs for deduplication
			const currentEventIds = new Set(events.map((e) => e.id));

			// Find new events that aren't in the local array yet
			const newEvents = storeEvents.filter(
				(storeEvent) => !currentEventIds.has(storeEvent.id)
			);

			if (newEvents.length > 0) {
				console.log(
					'📅 CalendarView: Syncing',
					newEvents.length,
					'new events from store to local array'
				);
				// Merge new events with existing events
				events = [...events, ...newEvents];
			}
		}
	});

	onMount(() => {
		// Bootstrap EventStore with appropriate loader (unless in community mode)
		if (communityMode && communityPubkey) {
			// Bootstrap EventStore with community calendar loader
			communityCalendarTimelineLoader(communityPubkey)().subscribe({
				complete: () => {
					console.log('📅 CalendarView: Community calendar loader bootstrap complete');
				},
				error: (err) => {
					console.warn('📅 CalendarView: Community calendar loader bootstrap error:', err);
				}
			});
		}

		userSubscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});

		// Subscribe to calendar selection changes (only when no calendar prop provided)
		if (!calendar) {
			calendarSubscription = calendarStore.selectedCalendar$.subscribe((cal) => {
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
			eventLoaderComposable.cleanup();
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
		presentationViewMode = newPresentationViewMode;

		// If switching to calendar view and viewMode is 'all', switch to 'month'
		// since 'all' is only available in list view
		if (newPresentationViewMode === 'calendar' && viewMode === 'all') {
			viewMode = 'month';
			console.log('📅 CalendarView: Switched from "all" to "month" for calendar view');
		}

		console.log(
			'📅 CalendarView: Presentation view mode changed to:',
			newPresentationViewMode
		);
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

	// Client-side filtering with tag buttons (OR logic) + text search (AND logic)
	// Events are filtered AFTER loading
	let displayedEvents = $derived.by(() => {
		let filtered = events;
		const selectedTags = calendarStore.selectedTags;
		const searchQuery = calendarStore.searchQuery;

		// Step 1: Apply tag filtering (OR logic)
		if (selectedTags.length > 0) {
			filtered = filtered.filter((event) => {
				// Normalize event hashtags to lowercase for case-insensitive matching
				const normalizedHashtags = (event.hashtags || []).map((tag) =>
					tag.toLowerCase().trim()
				);

				// Check if event has any of the selected tags
				return selectedTags.some((tag) => normalizedHashtags.includes(tag));
			});
			console.log(
				`🏷️ CalendarView: Filtered ${filtered.length}/${events.length} events by tags:`,
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

<div class="overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm">
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
				<!-- Add to Calendar Button (community mode only) -->
				{#if communityMode && communityPubkey}
					<AddToCalendarButton calendarId={communityPubkey} calendarTitle={communityCalendarTitle} />
				{/if}

				<button
					class="btn btn-ghost btn-sm"
					onclick={() => handleRefresh()}
					disabled={loading.loading}
					aria-label="Refresh calendar"
				>
					<svg
						class="h-5 w-5"
						class:animate-spin={loading.loading}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
				</button>

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
						{resolutionErrors.length} referenced event{resolutionErrors.length === 1
							? ''
							: 's'} could not be found or loaded.
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

	<!-- Filters (hidden in community mode) -->
	{#if !communityMode}
		<!-- Relay Selector -->
		<RelaySelector onApplyFilters={handleRelayFilterChange} />

		<!-- Follow List Selector -->
		<FollowListSelector onApplyFilters={handleFollowListFilterChange} />

		<!-- Search Input -->
		<SearchInput onSearchQueryChange={handleSearchQueryChange} />

		<!-- Tag Selector -->
		<TagSelector {events} onTagFilterChange={handleTagFilterChange} />
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
			loading={loading.loading}
			{error}
		/>
	{:else if presentationViewMode === 'map'}
		<!-- Map View (placeholder for future implementation) -->
		<div class="flex flex-col items-center justify-center px-6 py-16 text-center">
			<div class="mb-4 text-base-content/30">
				<svg class="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</div>
			<h3 class="mb-2 text-lg font-medium text-base-content">Map View Coming Soon</h3>
			<p class="text-base-content/60">
				Map view for calendar events will be available in a future update.
			</p>
		</div>
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

	<!-- Missing Events Notification -->
	{#if hasMissingEvents && !loading}
		<div class="bg-base-50 border-t border-base-300 px-6 py-3">
			<div class="flex items-center gap-3 text-sm text-base-content/70">
				<svg class="h-4 w-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
					/>
				</svg>
				<span>
					{missingEventsCount} event{missingEventsCount > 1 ? 's' : ''} could not be loaded
				</span>
				<button
					class="btn text-base-content/50 btn-ghost btn-xs hover:text-base-content"
					onclick={() => {
						console.log('📅 Missing events details:', missingEvents);
						// Could expand to show details modal in the future
					}}
					title="View details in console"
				>
					Details
				</button>
			</div>
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
