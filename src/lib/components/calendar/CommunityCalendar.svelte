<!--
  CommunityCalendar Component
  Main calendar component integrating all calendar functionality for a community
-->

<script>
	import { useCalendarEvents, useGlobalCalendarEvents } from '$lib/stores/calendar-store.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';
	import CalendarNavigation from './CalendarNavigation.svelte';
	import CalendarGrid from './CalendarGrid.svelte';
	import CalendarEventModal from './CalendarEventModal.svelte';

	/**
	 * @typedef {import('../../types/calendar.js').CalendarEvent} CalendarEvent
	 * @typedef {import('../../types/calendar.js').CalendarViewMode} CalendarViewMode
	 * @typedef {'all' | 'communikey' | 'joined-only'} FilterMode
	 */

	let { communityPubkey = '', globalMode = false } = $props();

	// Get appropriate calendar store based on mode
	const calendarStore = globalMode
		? useGlobalCalendarEvents()
		: useCalendarEvents(communityPubkey);

	// Debug: Inspect store changes
	// $inspect(calendarStore.viewState);
	// $inspect(calendarStore.events);

	// Modal state
	let isEventModalOpen = $state(false);
	let selectedDateForNewEvent = $state(/** @type {Date | null} */ (null));

	// Calendar store data (accessed directly for reactivity)

	/**
	 * Handle navigation to previous period
	 */
	function handlePrevious() {
		console.log('🔄 handlePrevious called');
		calendarStore.navigatePrevious();
		console.log('✅ navigatePrevious completed');
	}

	/**
	 * Handle navigation to next period
	 */
	function handleNext() {
		console.log('🔄 handleNext called');
		calendarStore.navigateNext();
		console.log('✅ navigateNext completed');
	}

	/**
	 * Handle navigation to today
	 */
	function handleToday() {
		console.log('🔄 handleToday called');
		calendarStore.navigateToToday();
		console.log('✅ navigateToToday completed');
	}

	/**
	 * Handle view mode change
	 * @param {CalendarViewMode} newViewMode
	 */
	function handleViewModeChange(newViewMode) {
		console.log('🔄 handleViewModeChange called with:', newViewMode);
		calendarStore.setViewMode(newViewMode);
		console.log('✅ setViewMode completed');
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
		// For now, just select the event
		// In the future, this could open an event details modal
		calendarStore.selectEvent(event);
		console.log('Event clicked:', event);
	}

	/**
	 * Handle create event button click
	 */
	function handleCreateEvent() {
		selectedDateForNewEvent = calendarStore.viewState.currentDate;
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
</script>

<div class="bg-base-100 rounded-lg shadow-sm border border-base-300 overflow-hidden">
	<!-- Calendar Header -->
	<div class="bg-base-200 border-b border-base-300 px-6 py-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold text-base-content">
				{globalMode ? 'Global Calendar' : 'Community Calendar'}
			</h2>
			<div class="flex items-center gap-3">
				<button
					class="btn btn-ghost btn-sm"
					onclick={handleRefresh}
					disabled={calendarStore.loading}
					aria-label="Refresh calendar"
				>
					<svg
						class="w-5 h-5"
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
					<button
						class="btn btn-primary btn-sm gap-2"
						onclick={handleCreateEvent}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
						</svg>
						Create Event
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Error Display -->
	{#if calendarStore.error}
		<div class="alert alert-error border-b border-error/20 px-6 py-3 rounded-none">
			<div class="flex items-center gap-3">
				<svg class="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span class="flex-1 text-sm">{calendarStore.error}</span>
				<button
					class="btn btn-ghost btn-xs"
					onclick={() => calendarStore.error = null}
					aria-label="Dismiss error"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<!-- Calendar Navigation -->
	<CalendarNavigation
		currentDate={calendarStore.viewState.currentDate}
		viewMode={calendarStore.viewState.viewMode}
		onPrevious={handlePrevious}
		onNext={handleNext}
		onToday={handleToday}
		onViewModeChange={handleViewModeChange}
	/>

	<!-- Loading State -->
	{#if calendarStore.loading && calendarStore.events.length === 0}
		<div class="flex flex-col items-center justify-center py-16">
			<div class="mb-4">
				<svg class="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</div>
			<p class="text-base-content/60">Loading calendar events...</p>
		</div>
	{:else}
		<!-- Calendar Grid -->
		<CalendarGrid
			currentDate={calendarStore.viewState.currentDate}
			viewMode={calendarStore.viewState.viewMode}
			groupedEvents={calendarStore.groupedEvents}
			onEventClick={handleEventClick}
			onDateClick={handleDateClick}
		/>

		<!-- Empty State -->
		{#if calendarStore.events.length === 0 && !calendarStore.loading}
			<div class="flex flex-col items-center justify-center py-16 px-6 text-center">
				<div class="mb-4 text-base-content/30">
					<svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
				</div>
				<h3 class="text-lg font-medium text-base-content mb-2">
					{globalMode ? 'No calendar events found' : 'No events yet'}
				</h3>
				<p class="text-base-content/60 mb-6 max-w-md">
					{#if globalMode}
						No calendar events found from connected relays. Check back later for new events.
					{:else}
						This community doesn't have any calendar events yet. Be the first to create one!
					{/if}
				</p>
				{#if !globalMode && manager.active}
					<button
						class="btn btn-primary"
						onclick={handleCreateEvent}
					>
						Create First Event
					</button>
				{/if}
			</div>
		{/if}
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
