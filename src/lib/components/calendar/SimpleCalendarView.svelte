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
	import { addressLoader } from '$lib/loaders.js';
	import { getCalendarEventTitle, getCalendarEventStart, getCalendarEventEnd, getCalendarEventImage } from 'applesauce-core/helpers/calendar-event';
	import { groupEventsByDate } from '$lib/helpers/calendar.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';
	
	// Import existing UI components
	import CalendarNavigation from '$lib/components/calendar/CalendarNavigation.svelte';
	import CalendarGrid from '$lib/components/calendar/CalendarGrid.svelte';
	import CalendarEventModal from '$lib/components/calendar/CalendarEventModal.svelte';
	import SimpleCalendarDropdown from './SimpleCalendarDropdown.svelte';
	import SimpleCalendarEventsList from './SimpleCalendarEventsList.svelte';

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
	
	// Calendar selection state
	let selectedCalendarId = $state('');
	let selectedCalendar = $state(/** @type {any} */ (null));
	let activeUser = $state(manager.active);

	// Calendar view state
	let currentDate = $state(new Date());
	let viewMode = $state(/** @type {CalendarViewMode} */ ('month'));
	let presentationViewMode = $state(/** @type {'calendar' | 'list' | 'map'} */ ('calendar'));
	let groupedEvents = $state(/** @type {Map<string, CalendarEvent[]>} */ (new Map()));

	// Modal state
	let isEventModalOpen = $state(false);
	let selectedDateForNewEvent = $state(/** @type {Date | null} */ (null));

	// Timeline loader and subscription
	let subscription = $state();
	let timelineLoader = $state();
	let userSubscription = $state();
	let addressSubscriptions = $state(/** @type {any[]} */ ([]));

	/**
	 * Create calendar timeline loader following the simple pattern
	 * @param {string} [calendarId] - Optional calendar ID to filter events
	 */
	function createCalendarLoader(calendarId = '') {
		/** @type {any} */
		let filter = { kinds: [31922, 31923], limit: 100 };
		
		// Filter by author for "My Events"
		if (calendarId && activeUser && calendarId === activeUser.pubkey) {
			filter.authors = [activeUser.pubkey];
		}
		
		return createTimelineLoader(pool, relays, filter, { eventStore });
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
			? (event.tags.find((/** @type {any} */ t) => t && t[0] === 'd')?.[1] || undefined)
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

	/**
	 * Parse address reference string into components
	 * @param {string} addressRef - Address reference like "31922:pubkey:d-tag"
	 * @returns {{kind: number, pubkey: string, dTag: string} | null}
	 */
	function parseAddressReference(addressRef) {
		try {
			const parts = addressRef.split(':');
			if (parts.length !== 3) return null;
			
			const [kindStr, pubkey, dTag] = parts;
			const kind = parseInt(kindStr, 10);
			
			if (isNaN(kind) || !pubkey || !dTag) return null;
			
			return { kind, pubkey, dTag };
		} catch (error) {
			console.error('📅 SimpleCalendarView: Error parsing address reference:', addressRef, error);
			return null;
		}
	}

	/**
	 * Load events for a specific calendar using address loader
	 * @param {any} calendar - Calendar object with eventReferences
	 */
	function loadCalendarSpecificEvents(calendar) {
		if (!calendar || !calendar.eventReferences || calendar.eventReferences.length === 0) {
			console.log('📅 SimpleCalendarView: No event references found for calendar:', calendar);
			events = [];
			groupedEvents = new Map();
			loading = false;
			return;
		}

		console.log(`📅 SimpleCalendarView: Loading ${calendar.eventReferences.length} specific events for calendar:`, calendar.title);
		
		// Clean up existing address subscriptions
		addressSubscriptions.forEach(sub => sub.unsubscribe());
		addressSubscriptions = [];
		
		/** @type {any[]} */
		const loadedEvents = [];
		let completedLoads = 0;
		const totalLoads = calendar.eventReferences.length;

		// Load each event reference using address loader
		calendar.eventReferences.forEach((/** @type {string} */ addressRef, /** @type {number} */ index) => {
			const parsed = parseAddressReference(addressRef);
			if (!parsed) {
				console.warn('📅 SimpleCalendarView: Invalid address reference:', addressRef);
				completedLoads++;
				if (completedLoads === totalLoads) {
					finishCalendarEventLoading(loadedEvents);
				}
				return;
			}

			console.log(`📅 SimpleCalendarView: Loading event ${index + 1}/${totalLoads}:`, parsed);

			// Use address loader to fetch the specific event
			const subscription = addressLoader({
				kind: parsed.kind,
				pubkey: parsed.pubkey,
				identifier: parsed.dTag,
				relays
			}).subscribe({
				next: (event) => {
					if (event) {
						console.log(`📅 SimpleCalendarView: Loaded event:`, event.id, getCalendarEventTitle(event));
						loadedEvents.push(event);
					}
				},
				complete: () => {
					completedLoads++;
					console.log(`📅 SimpleCalendarView: Completed loading event ${completedLoads}/${totalLoads}`);
					
					if (completedLoads === totalLoads) {
						finishCalendarEventLoading(loadedEvents);
					}
				},
				error: (/** @type {any} */ err) => {
					console.error('📅 SimpleCalendarView: Error loading event:', addressRef, err);
					completedLoads++;
					
					if (completedLoads === totalLoads) {
						finishCalendarEventLoading(loadedEvents);
					}
				}
			});

			addressSubscriptions.push(subscription);
		});
	}

	/**
	 * Finish loading calendar-specific events
	 * @param {any[]} loadedEvents - Array of loaded events
	 */
	function finishCalendarEventLoading(loadedEvents) {
		console.log(`📅 SimpleCalendarView: Finished loading calendar events: ${loadedEvents.length} events`);
		
		// Convert to CalendarEvent format
		const calendarEvents = loadedEvents.map(convertToCalendarEvent);
		events = calendarEvents;
		
		// Update grouped events for calendar grid
		groupedEvents = groupEventsByDate(calendarEvents);
		
		loading = false;
	}

	/**
	 * Load events based on selected calendar
	 */
	function loadEvents() {
		loading = true;
		error = null;
		
		// Clean up existing subscriptions
		if (subscription) {
			subscription.unsubscribe();
		}
		addressSubscriptions.forEach(sub => sub.unsubscribe());
		addressSubscriptions = [];
		
		// Handle different calendar selection types
		if (selectedCalendarId && activeUser && selectedCalendarId !== activeUser.pubkey && selectedCalendar) {
			// Custom calendar selected - load specific events using address loader
			console.log('📅 SimpleCalendarView: Loading calendar-specific events for:', selectedCalendar.title);
			loadCalendarSpecificEvents(selectedCalendar);
			return;
		}
		
		// Global calendar or "My Events" - use timeline loader
		console.log('📅 SimpleCalendarView: Loading events via timeline loader');
		
		// Create timeline loader based on selected calendar
		timelineLoader = createCalendarLoader(selectedCalendarId);
		
		// Build filter for timeline model
		/** @type {any} */
		let filter = { kinds: [31922, 31923], limit: 100 };
		
		// Filter by author for "My Events"
		if (selectedCalendarId && activeUser && selectedCalendarId === activeUser.pubkey) {
			filter.authors = [activeUser.pubkey];
		}
		
		// Execute timeline loader to fetch from relays
		timelineLoader().subscribe({
			complete: () => {
				console.log('📅 SimpleCalendarView: Timeline loader completed, subscribing to event store');
				
				// Subscribe to event store to get the loaded events
				subscription = eventStore
					.model(TimelineModel, filter)
					.subscribe((timeline) => {
						console.log(`📅 SimpleCalendarView: Timeline updated: ${timeline.length} events`);
						
						// Convert raw events to CalendarEvent format
						const calendarEvents = timeline.map(convertToCalendarEvent);
						events = calendarEvents;
						
						// Update grouped events for calendar grid
						groupedEvents = groupEventsByDate(calendarEvents);
						
						loading = false;
					});
			},
			error: (/** @type {any} */ err) => {
				console.error('📅 SimpleCalendarView: Timeline loader error:', err);
				error = 'Failed to load events';
				loading = false;
			}
		});
	}

	// Mount: Subscribe to events and user changes
	onMount(() => {
		console.log('📅 SimpleCalendarView: Mounting and subscribing to events');
		
		// Subscribe to user changes
		userSubscription = manager.active$.subscribe((user) => {
			activeUser = user;
			// Reload events when user changes
			loadEvents();
		});
		
		// Initial load
		loadEvents();
	});

	onDestroy(() => {
		if (subscription) {
			subscription.unsubscribe();
		}
		if (userSubscription) {
			userSubscription.unsubscribe();
		}
		// Clean up address subscriptions
		addressSubscriptions.forEach(sub => sub.unsubscribe());
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
			error: (/** @type {any} */ err) => {
				console.error('📅 SimpleCalendarView: Load more error:', err);
				error = 'Failed to load more events';
				loading = false;
			}
		});
	}
	
	/**
	 * Handle calendar selection from dropdown
	 * @param {string} calendarId
	 */
	function handleCalendarSelect(calendarId) {
		selectedCalendarId = calendarId;
		console.log('📅 SimpleCalendarView: Calendar selected:', calendarId);
		loadEvents();
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
	 * Handle presentation view mode change
	 * @param {'calendar' | 'list' | 'map'} newPresentationViewMode
	 */
	function handlePresentationViewModeChange(newPresentationViewMode) {
		presentationViewMode = newPresentationViewMode;
		console.log('📅 SimpleCalendarView: Presentation view mode changed to:', newPresentationViewMode);
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
		loadEvents();
	}
	
	// Reactive display title based on selected calendar
	let displayTitle = $derived.by(() => {
		if (!selectedCalendarId) {
			return globalMode ? 'Global Calendar' : 'Community Calendar';
		}
		
		if (activeUser && selectedCalendarId === activeUser.pubkey) {
			return 'My Events';
		}
		
		// TODO: Get calendar title from calendar data
		return 'Custom Calendar';
	});
</script>

<div class="overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm">
	<!-- Calendar Header -->
	<div class="border-b border-base-300 bg-base-200 px-6 py-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<SimpleCalendarDropdown 
					bind:selectedCalendarId={selectedCalendarId}
					bind:selectedCalendar={selectedCalendar}
					onCalendarSelect={handleCalendarSelect}
				/>
			</div>
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
		{presentationViewMode}
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
			{groupedEvents}
			onEventClick={handleEventClick}
			onDateClick={handleDateClick}
		/>
	{:else if presentationViewMode === 'list'}
		<!-- List View -->
		<div class="p-6">
			<SimpleCalendarEventsList
				{events}
				{loading}
				{error}
				showLoadMore={true}
				onLoadMore={loadMore}
			/>
		</div>
	{:else if presentationViewMode === 'map'}
		<!-- Map View (placeholder for future implementation) -->
		<div class="flex flex-col items-center justify-center px-6 py-16 text-center">
			<div class="mb-4 text-base-content/30">
				<svg class="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			</div>
			<h3 class="mb-2 text-lg font-medium text-base-content">Map View Coming Soon</h3>
			<p class="text-base-content/60">Map view for calendar events will be available in a future update.</p>
		</div>
	{/if}

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
