<!--
  SimpleCalendarView Component
  Simplified calendar using the direct timeline loader approach from calendar-simple
  Maintains same design but with much simpler data flow
-->

<script>
	import { onDestroy, onMount } from 'svelte';
	import { TimelineModel } from 'applesauce-core/models';
	import { createTimelineLoader } from 'applesauce-loaders/loaders';
	import { pool, relays, eventStore } from '$lib/store.svelte';
	import { getCalendarEventTitle, getCalendarEventStart, getCalendarEventEnd, getCalendarEventImage } from 'applesauce-core/helpers/calendar-event';
	import { groupEventsByDate } from '$lib/helpers/calendar.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';
	
	// Import existing UI components
	import CalendarNavigation from '$lib/components/calendar/CalendarNavigation.svelte';
	import CalendarGrid from '$lib/components/calendar/CalendarGrid.svelte';
	import CalendarEventModal from '$lib/components/calendar/CalendarEventModal.svelte';

	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
	 * @typedef {import('$lib/types/calendar.js').CalendarViewMode} CalendarViewMode
	 */

	// Props
	let { communityPubkey = '', globalMode = false } = $props();

	// Simple reactive state using Svelte 5 runes
	let events = $state(/** @type {CalendarEvent[]} */ ([]));
	let loading = $state(false);
	let error = $state(/** @type {string | null} */ (null));

	// Calendar view state
	let currentDate = $state(new Date());
	let viewMode = $state(/** @type {CalendarViewMode} */ ('month'));
	let groupedEvents = $state(/** @type {Map<string, CalendarEvent[]>} */ (new Map()));

	// Modal state
	let isEventModalOpen = $state(false);
	let selectedDateForNewEvent = $state(/** @type {Date | null} */ (null));

	// Timeline loader and subscription
	let subscription = $state();
	let timelineLoader = $state();

	/**
	 * Create calendar timeline loader following the simple pattern
	 */
	function createCalendarLoader() {
		return createTimelineLoader(
			pool,
			relays,
			{ kinds: [31922, 31923], limit: 100 },
			{ eventStore }
		);
	}

	/**
	 * Convert raw event to CalendarEvent format
	 * @param {any} event
	 * @returns {CalendarEvent}
	 */
	function convertToCalendarEvent(event) {
		const startTimestamp = getCalendarEventStart(event);
		const endTimestamp = getCalendarEventEnd(event);
		const validStartTimestamp = startTimestamp || Math.floor(Date.now() / 1000);

		const dTag = Array.isArray(event.tags)
			? (event.tags.find((t) => t && t[0] === 'd')?.[1] || undefined)
			: undefined;

		return {
			id: event.id,
			pubkey: event.pubkey,
			kind: /** @type {import('$lib/types/calendar.js').CalendarEventKind} */ (event.kind),
			title: getCalendarEventTitle(event) || 'Untitled Event',
			summary: event.content || '',
			image: getCalendarEventImage(event) || '',
			start: validStartTimestamp,
			end: endTimestamp,
			startTimezone: undefined,
			endTimezone: undefined,
			locations: [],
			participants: [],
			hashtags: [],
			references: [],
			geohash: undefined,
			communityPubkey: '',
			createdAt: event.created_at,
			dTag,
			originalEvent: event
		};
	}

	// Initialize loader
	timelineLoader = createCalendarLoader();

	// Mount: Subscribe to events using the simple pattern
	onMount(() => {
		console.log('📅 SimpleCalendarView: Mounting and subscribing to events');
		
		subscription = eventStore
			.model(TimelineModel, { kinds: [31922, 31923], limit: 100 })
			.subscribe((timeline) => {
				console.log(`📅 SimpleCalendarView: Timeline updated: ${timeline.length} events`);
				
				// Convert raw events to CalendarEvent format
				const calendarEvents = timeline.map(convertToCalendarEvent);
				events = calendarEvents;
				
				// Update grouped events for calendar grid
				groupedEvents = groupEventsByDate(calendarEvents);
				
				loading = false;
			});
	});

	onDestroy(() => {
		if (subscription) {
			subscription.unsubscribe();
		}
	});

	/**
	 * Load more events
	 */
	function loadMore() {
		if (loading) return;
		
		loading = true;
		console.log('📅 SimpleCalendarView: Loading more events');
		
		timelineLoader().subscribe({
			complete: () => {
				loading = false;
				console.log('📅 SimpleCalendarView: Load more completed');
			},
			error: (err) => {
				console.error('📅 SimpleCalendarView: Load more error:', err);
				error = 'Failed to load more events';
				loading = false;
			}
		});
	}

	/**
	 * Handle navigation to previous period
	 */
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

	/**
	 * Handle navigation to next period
	 */
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

	/**
	 * Handle navigation to today
	 */
	function handleToday() {
		currentDate = new Date();
	}

	/**
	 * Handle view mode change
	 * @param {CalendarViewMode} newViewMode
	 */
	function handleViewModeChange(newViewMode) {
		viewMode = newViewMode;
	}

	/**
	 * Handle date click in calendar grid
	 * @param {Date} date
	 */
	function handleDateClick(date) {
		currentDate = new Date(date);
		viewMode = 'day';
	}

	/**
	 * Handle event click
	 * @param {CalendarEvent} event
	 */
	function handleEventClick(event) {
		modalStore.openModal('eventDetails', { event });
		console.log('📅 SimpleCalendarView: Event clicked, opening details modal:', event.title);
	}

	/**
	 * Handle create event button click
	 */
	function handleCreateEvent() {
		selectedDateForNewEvent = currentDate;
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
		// Refresh events by triggering load more
		loadMore();
	}

	/**
	 * Handle refresh button click
	 */
	function handleRefresh() {
		loadMore();
	}
</script>

<div class="overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm">
	<!-- Calendar Header -->
	<div class="border-b border-base-300 bg-base-200 px-6 py-4">
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-semibold text-base-content">
				{globalMode ? 'Global Calendar' : 'Community Calendar'}
			</h1>
			<div class="flex items-center gap-3">
				<button
					class="btn btn-ghost btn-sm"
					onclick={handleRefresh}
					disabled={loading}
					aria-label="Refresh calendar"
				>
					<svg
						class="h-5 w-5"
						class:animate-spin={loading}
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
				
				<button
					class="btn btn-outline btn-sm"
					onclick={loadMore}
					disabled={loading}
				>
					{#if loading}
						<span class="loading loading-spinner loading-sm"></span>
						Loading...
					{:else}
						Load More
					{/if}
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

	<!-- Calendar Navigation -->
	<CalendarNavigation
		{currentDate}
		{viewMode}
		onPrevious={handlePrevious}
		onNext={handleNext}
		onToday={handleToday}
		onViewModeChange={handleViewModeChange}
	/>

	<!-- Calendar Grid -->
	<CalendarGrid
		{currentDate}
		{viewMode}
		{groupedEvents}
		onEventClick={handleEventClick}
		onDateClick={handleDateClick}
	/>

	<!-- Loading indicator -->
	{#if loading && events.length === 0}
		<div class="text-sm text-base-content/60 px-6 py-2 text-center">
			Loading calendar events...
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
				<button class="btn btn-primary" onclick={handleCreateEvent}>
					Create First Event
				</button>
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
