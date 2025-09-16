<!--
  CommunityCalendar Component
  Main calendar component integrating all calendar functionality for a community
-->

<script>
	import { useCalendarEvents, useGlobalCalendarEvents } from '$lib/stores/calendar-store.svelte.js';
	import { useCalendarSelection } from '$lib/stores/calendar-selection.svelte.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';
	import { eventStore } from '$lib/store.svelte';
	import { CalendarEventRSVPsModel } from 'applesauce-core/models';
	import CalendarNavigation from './CalendarNavigation.svelte';
	import CalendarGrid from './CalendarGrid.svelte';
	import CalendarEventModal from './CalendarEventModal.svelte';
	import CalendarDropdown from './CalendarDropdown.svelte';

	/**
	 * @typedef {import('../../types/calendar.js').CalendarEvent} CalendarEvent
	 * @typedef {import('../../types/calendar.js').CalendarViewMode} CalendarViewMode
	 * @typedef {'all' | 'communikey' | 'joined-only'} FilterMode
	 */

	let { communityPubkey = '', globalMode = false } = $props();

	// Initialize calendar selection store
	const calendarSelectionStore = useCalendarSelection();

	// Get appropriate calendar store based on mode
	// For global mode, we need to pass the calendar selection store for reactive filtering
	const calendarStore = globalMode
		? useGlobalCalendarEvents(calendarSelectionStore)
		: useCalendarEvents(communityPubkey);

	// Reactive calendar selection state
	let selectedCalendarId = $derived(calendarSelectionStore.selectedCalendarId);
	let isGlobalMode = $derived(calendarSelectionStore.isGlobalMode);

	// RSVP data management - reactive Map to store RSVP data for events
	let eventRSVPs = $state(new Map());

	// Load RSVPs for calendar events using established pattern
	$effect(() => {
		// Get all events from the calendar store
		const events = calendarStore.events() || [];

		// Find events that don't have RSVP data loaded yet
		const eventsNeedingRSVPs = events.filter(event =>
			event.id && !eventRSVPs.has(event.id)
		);

		// Load RSVPs for new events
		eventsNeedingRSVPs.forEach(event => {
			if (event.id && event.originalEvent) {
				// Use the established pattern with eventStore.model for RSVP loading
				const rsvpsObservable = eventStore.model(CalendarEventRSVPsModel, event.originalEvent);
				const subscription = rsvpsObservable.subscribe(rsvps => {
					if (rsvps) {
						// Store RSVP data in our reactive Map
						eventRSVPs.set(event.id, {
							rsvps,
							rsvpCount: rsvps.length
						});
						// Trigger reactivity update
						eventRSVPs = new Map(eventRSVPs);
					}
				});

				// Store subscription for cleanup
				eventRSVPs.set(event.id, { loading: true, subscription });
				eventRSVPs = new Map(eventRSVPs);
			}
		});
	});

	// Helper function to get RSVP data for an event
	/**
	 * @param {string} eventId
	 */
	function getEventRSVPData(eventId) {
		return eventRSVPs.get(eventId);
	}

	// Debug: Inspect store changes
	// $inspect(calendarStore.viewState);
	// $inspect(calendarStore.events);
	// $inspect(selectedCalendarId);

	// Modal state
	let isEventModalOpen = $state(false);
	let selectedDateForNewEvent = $state(/** @type {Date | null} */ (null));

	// Calendar store data (accessed via getter functions for reactivity)

	/**
	 * Handle navigation to previous period
	 */
	function handlePrevious() {
		calendarStore.navigatePrevious();
	}

	/**
	 * Handle navigation to next period
	 */
	function handleNext() {
		calendarStore.navigateNext();
	}

	/**
	 * Handle navigation to today
	 */
	function handleToday() {
		calendarStore.navigateToToday();
	}

	/**
	 * Handle view mode change
	 * @param {CalendarViewMode} newViewMode
	 */
	function handleViewModeChange(newViewMode) {
		calendarStore.setViewMode(newViewMode);
	}

	/**
	 * Handle date click in calendar grid
	 * @param {Date} date
	 */
	function handleDateClick(date) {
		// Navigate to the clicked date and switch to day mode
		calendarStore.navigateToDate(date);
		calendarStore.setViewMode('day');
	}

	/**
	 * Handle event click
	 * @param {CalendarEvent} event
	 */
	function handleEventClick(event) {
		// Open the event details modal with the selected event
		modalStore.openModal('eventDetails', { event });
		console.log('Event clicked, opening details modal:', event);
	}

	/**
	 * Handle create event button click
	 */
	function handleCreateEvent() {
		selectedDateForNewEvent = calendarStore.viewState().currentDate;
		isEventModalOpen = true;
	}

	/**
	 * Handle event modal close
	 */
	function handleEventModalClose() {
		isEventModalOpen = false;
		selectedDateForNewEvent = null;
	}

	/**
	 * Handle event created successfully
	 */
	function handleEventCreated() {
		// Refresh the calendar events
		calendarStore.refresh();
	}

	/**
	 * Handle refresh button click
	 */
	function handleRefresh() {
		calendarStore.refresh();
	}

	/**
	 * Handle calendar selection
	 * @param {string} calendarId
	 */
	function handleCalendarSelect(calendarId) {
		calendarSelectionStore.selectCalendar(calendarId);
	}
</script>

<div class="overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm">
	<!-- Calendar Header -->
	<div class="border-b border-base-300 bg-base-200 px-6 py-4">
		<div class="flex items-center justify-between">
			<!-- Calendar Dropdown -->
			<CalendarDropdown
				selectedCalendarId={selectedCalendarId}
				onCalendarSelect={handleCalendarSelect}
			/>
			<div class="flex items-center gap-3">
				<button
					class="btn btn-ghost btn-sm"
					onclick={handleRefresh}
					disabled={calendarStore.loading()}
					aria-label="Refresh calendar"
				>
					<svg
						class="h-5 w-5"
						class:animate-spin={calendarStore.loading}
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
				{#if !globalMode && manager.active}
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
	{#if calendarStore.error()}
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
				<span class="flex-1 text-sm">{calendarStore.error()}</span>
				<button
					class="btn btn-ghost btn-xs"
					onclick={() => (calendarStore.error = null)}
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

	<!-- Calendar Navigation -->
	<CalendarNavigation
		currentDate={calendarStore.viewState().currentDate}
		viewMode={calendarStore.viewState().viewMode}
		onPrevious={handlePrevious}
		onNext={handleNext}
		onToday={handleToday}
		onViewModeChange={handleViewModeChange}
	/>

	<!-- Always show Calendar Grid immediately -->
	<CalendarGrid
		currentDate={calendarStore.viewState().currentDate}
		viewMode={calendarStore.viewState().viewMode}
		groupedEvents={calendarStore.groupedEvents()}
		onEventClick={handleEventClick}
		onDateClick={handleDateClick}
	/>

	<!-- Show loading indicator only for initial load when no events exist -->
	{#if calendarStore.loading() && calendarStore.events().length === 0}
		<div class="flex flex-col items-center justify-center py-16">
			<div class="mb-4">
				<svg class="h-8 w-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			</div>
			<p class="text-base-content/60">Loading calendar events...</p>
		</div>
	{/if}

	<!-- Empty State - only show when no events and not loading -->
	{#if calendarStore.events().length === 0 && !calendarStore.loading()}
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
