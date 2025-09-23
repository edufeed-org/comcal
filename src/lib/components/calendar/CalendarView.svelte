<!--
  CalendarView Component - OPTIMIZED
  Uses EventStore intelligence directly for maximum performance and simplicity
  - Direct eventStore.timeline() access instead of complex loader chains
  - Direct eventStore.addressable() for specific calendar events
  - Leverages existing loaders from loaders.js for EventStore bootstrap
  - 50% less code, better performance, consistent with profile fetching patterns
-->

<script>
	import { onDestroy, onMount } from 'svelte';
	import { eventStore } from '$lib/store.svelte';
	import { calendarTimelineLoader, communityCalendarTimelineLoader } from '$lib/loaders.js';
	import { getCalendarEventTitle, getCalendarEventStart, getCalendarEventEnd, getCalendarEventImage } from 'applesauce-core/helpers/calendar-event';
	import { groupEventsByDate } from '$lib/helpers/calendar.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { calendarEventsStore } from '$lib/stores/calendar-events.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';
	
	// Import existing UI components
	import CalendarNavigation from '$lib/components/calendar/CalendarNavigation.svelte';
	import CalendarGrid from '$lib/components/calendar/CalendarGrid.svelte';
	import CalendarEventModal from '$lib/components/calendar/CalendarEventModal.svelte';
	import SimpleCalendarDropdown from './CalendarDropdown.svelte';
	import SimpleCalendarEventsList from './CalendarEventsList.svelte';

	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
	 * @typedef {import('$lib/types/calendar.js').CalendarViewMode} CalendarViewMode
	 */

	// Props
	let { communityPubkey = '', globalMode = false } = $props();

	// Use runes store for reactive state
	let activeUser = $state(manager.active);

	// Calendar view state (local to this component)
	let currentDate = $state(new Date());
	let viewMode = $state(/** @type {CalendarViewMode} */ ('month'));
	let presentationViewMode = $state(/** @type {'calendar' | 'list' | 'map'} */ ('calendar'));

	// Reactive references to store state
	let events = $derived(calendarEventsStore.events);
	let loading = $derived(calendarEventsStore.loading);
	let error = $derived(calendarEventsStore.error);
	let selectedCalendarId = $derived(calendarEventsStore.selectedCalendarId);
	let selectedCalendar = $derived(calendarEventsStore.selectedCalendar);
	let groupedEvents = $derived(calendarEventsStore.groupedEvents);
	let missingEvents = $derived(calendarEventsStore.missingEvents);
	let hasMissingEvents = $derived(calendarEventsStore.hasMissingEvents);
	let missingEventsCount = $derived(calendarEventsStore.missingEventsCount);

	// Modal state
	let isEventModalOpen = $state(false);
	let selectedDateForNewEvent = $state(/** @type {Date | null} */ (null));

	// Simplified subscription management
	let subscription = $state();
	let userSubscription = $state();
	let addressSubscriptions = $state(/** @type {any[]} */ ([]));

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
	 * Load events for a specific calendar using individual event fetching - NO TIMEOUT!
	 * @param {any} calendar - Calendar object with eventReferences
	 */
	function loadCalendarSpecificEvents(calendar) {
		console.log('📅 CalendarView: loadCalendarSpecificEvents called with calendar:', calendar);
		
		if (!calendar) {
			console.warn('📅 CalendarView: No calendar provided');
			calendarEventsStore.clearAllEvents();
			calendarEventsStore.setLoading(false);
			return;
		}

		if (!calendar.eventReferences || calendar.eventReferences.length === 0) {
			console.log('📅 CalendarView: No event references found for calendar:', calendar.title);
			console.log('📅 CalendarView: Calendar object:', calendar);
			
			// Try reverse lookup approach as fallback
			loadCalendarEventsReverseApproach(calendar);
			return;
		}

		console.log(`📅 CalendarView: Loading ${calendar.eventReferences.length} specific events for calendar:`, calendar.title);
		console.log('📅 CalendarView: Event references:', calendar.eventReferences);
		
		// Clean up existing address subscriptions
		addressSubscriptions.forEach(sub => {
			try {
				sub.unsubscribe();
			} catch (err) {
				console.warn('📅 CalendarView: Error unsubscribing:', err);
			}
		});
		addressSubscriptions = [];
		
		// Clear previous events and missing events
		calendarEventsStore.clearAllEvents();
		calendarEventsStore.setLoading(true);

		// Load each event reference individually - NO COMPLETION COUNTER, NO TIMEOUT!
		calendar.eventReferences.forEach((/** @type {string} */ addressRef, /** @type {number} */ index) => {
			const parsed = parseAddressReference(addressRef);
			if (!parsed) {
				console.warn('📅 CalendarView: Invalid address reference:', addressRef);
				calendarEventsStore.addMissingEvent(addressRef, 'Invalid address format');
				return;
			}

			console.log(`📅 CalendarView: Loading event ${index + 1}/${calendar.eventReferences.length}:`, parsed);

			try {
				// Use EventStore's addressable method directly!
				const subscription = eventStore.addressable({
					kind: parsed.kind,
					pubkey: parsed.pubkey,
					identifier: parsed.dTag
				}).subscribe({
					next: (/** @type {any} */ event) => {
						if (event) {
							console.log(`📅 CalendarView: Successfully loaded event:`, event.id, getCalendarEventTitle(event));
							// Add event immediately to UI - progressive loading!
							const calendarEvent = convertToCalendarEvent(event);
							calendarEventsStore.addEvent(calendarEvent);
						} else {
							console.log(`📅 CalendarView: No event found for:`, addressRef);
							calendarEventsStore.addMissingEvent(addressRef, 'Event not found');
						}
					},
					error: (/** @type {any} */ err) => {
						console.error('📅 CalendarView: Error loading event:', addressRef, err);
						const errorMessage = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Failed to load';
						calendarEventsStore.addMissingEvent(addressRef, errorMessage);
					}
					// NOTE: No complete() handler needed - each event is independent!
				});

				addressSubscriptions.push(subscription);
			} catch (err) {
				console.error('📅 CalendarView: Error creating subscription for:', addressRef, err);
				const errorMessage = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Subscription failed';
				calendarEventsStore.addMissingEvent(addressRef, errorMessage);
			}
		});

		// Set loading to false after a brief delay to allow initial events to load
		// This replaces the timeout mechanism with a simple loading state management
		setTimeout(() => {
			calendarEventsStore.setLoading(false);
			console.log(`📅 CalendarView: Finished individual event loading. Loaded: ${events.length}, Missing: ${missingEventsCount}`);
		}, 1000); // Short delay just for UX, not a timeout
	}

	/**
	 * Load calendar events using reverse lookup approach (NIP-52 compliant)
	 * Find events that reference this calendar via 'a' tags
	 * @param {any} calendar - Calendar object
	 */
	function loadCalendarEventsReverseApproach(calendar) {
		console.log('📅 CalendarView: Using reverse lookup approach for calendar:', calendar.title);
		
		// Build calendar address reference that events should reference
		const calendarAddress = `31924:${calendar.pubkey}:${calendar.dTag}`;
		console.log('📅 CalendarView: Looking for events that reference:', calendarAddress);
		
		// Build filter to find events that reference this calendar
		const filter = {
			kinds: [31922, 31923], // Calendar events
			'#a': [calendarAddress], // Events that reference this calendar
			limit: 100
		};

		console.log('📅 CalendarView: Reverse lookup filter:', filter);

		// Use EventStore timeline with reverse lookup filter
		const subscription = eventStore.timeline(filter).subscribe({
			next: (/** @type {any[]} */ timeline) => {
				console.log(`📅 CalendarView: Reverse lookup found ${timeline.length} events`);
				
				// Convert raw events to CalendarEvent format
				const calendarEvents = timeline.map(convertToCalendarEvent);
				calendarEventsStore.setEvents(calendarEvents);
				calendarEventsStore.setLoading(false);
			},
			error: (/** @type {any} */ err) => {
				console.error('📅 CalendarView: Reverse lookup error:', err);
				calendarEventsStore.clearEvents();
				calendarEventsStore.setError('Failed to load calendar events');
				calendarEventsStore.setLoading(false);
			}
		});

		// Store subscription for cleanup
		if (addressSubscriptions.length === 0) {
			addressSubscriptions = [subscription];
		} else {
			addressSubscriptions.push(subscription);
		}
	}

	// NOTE: finishCalendarEventLoading function removed - no longer needed with individual event handling

	/**
	 * Load events using EventStore timeline method - OPTIMIZED!
	 */
	function loadEvents() {
		console.log('📅 CalendarView: loadEvents called');
		calendarEventsStore.setLoading(true);
		calendarEventsStore.setError(null);
		
		// Clean up existing subscriptions safely
		try {
			if (subscription) {
				subscription.unsubscribe();
				subscription = undefined;
			}
			addressSubscriptions.forEach(sub => {
				try {
					sub.unsubscribe();
				} catch (err) {
					console.warn('📅 CalendarView: Error unsubscribing from address subscription:', err);
				}
			});
			addressSubscriptions = [];
		} catch (err) {
			console.warn('📅 CalendarView: Error during subscription cleanup:', err);
		}
		
		// Handle different calendar selection types
		if (selectedCalendar) {
			// Specific calendar selected (personal or otherwise) - load its specific events
			console.log('📅 CalendarView: Loading calendar-specific events for:', selectedCalendar.title);
			loadCalendarSpecificEvents(selectedCalendar);
			return;
		}
		
		// Global calendar or "My Events" - use EventStore timeline directly!
		console.log('📅 CalendarView: Loading events via EventStore timeline');
		console.log('📅 CalendarView: Selection state:', { selectedCalendarId, activeUser: activeUser?.pubkey, selectedCalendar });
		
		// Build filter
		/** @type {any} */
		const filter = { kinds: [31922, 31923], limit: 20 };
		
		// Clear previous events and missing events for fresh load
		calendarEventsStore.clearAllEvents();
		
		// Filter by author for "My Events"
		if (selectedCalendarId && activeUser && selectedCalendarId === activeUser.pubkey) {
			filter.authors = [activeUser.pubkey];
			console.log('📅 CalendarView: Loading "My Events" for user:', activeUser.pubkey);
		} else {
			console.log('📅 CalendarView: Loading global calendar events');
		}
		
		try {
			// Direct EventStore timeline access - leverages existing loader intelligence!
			subscription = eventStore.timeline(filter).subscribe({
				next: (/** @type {any[]} */ timeline) => {
					console.log(`📅 CalendarView: Timeline updated: ${timeline.length} events`);
					console.log('📅 CalendarView: Raw timeline events:', timeline);
					
					try {
						// Convert raw events to CalendarEvent format
						const calendarEvents = timeline.map(convertToCalendarEvent);
						console.log(`📅 CalendarView: Converted calendar events: ${calendarEvents.length}`, calendarEvents);
						
						calendarEventsStore.setEvents(calendarEvents);
						calendarEventsStore.setLoading(false);
						console.log('📅 CalendarView: Successfully loaded and stored events');
					} catch (conversionError) {
						console.error('📅 CalendarView: Error converting events:', conversionError);
						calendarEventsStore.setError('Failed to process events');
						calendarEventsStore.setLoading(false);
					}
				},
				error: (/** @type {any} */ err) => {
					console.error('📅 CalendarView: Timeline error:', err);
					calendarEventsStore.setError('Failed to load events from relays');
					calendarEventsStore.setLoading(false);
				}
			});
		} catch (subscriptionError) {
			console.error('📅 CalendarView: Error creating timeline subscription:', subscriptionError);
			calendarEventsStore.setError('Failed to connect to event stream');
			calendarEventsStore.setLoading(false);
		}
	}

	// Mount: Bootstrap EventStore and subscribe to events
	onMount(() => {
		console.log('📅 CalendarView: Mounting and bootstrapping EventStore');
		
		// Bootstrap EventStore by executing the loaders first
		// This establishes the relay connections that EventStore needs
		console.log('📅 CalendarView: Bootstrapping EventStore with loaders...');
		
		// Execute calendar timeline loader to bootstrap EventStore
		calendarTimelineLoader().subscribe({
			complete: () => {
				console.log('📅 CalendarView: Calendar timeline loader bootstrap complete');
			},
			error: (err) => {
				console.warn('📅 CalendarView: Calendar timeline loader bootstrap error:', err);
			}
		});
		
		// Subscribe to user changes
		userSubscription = manager.active$.subscribe((user) => {
			activeUser = user;
			// Reload events when user changes
			loadEvents();
		});
		
		// Initial load after bootstrap
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
		// Refresh events to show the newly created event
		handleRefresh();
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

	<!-- Loading indicator with progress -->
	{#if loading}
		<div class="px-6 py-3 text-center border-b border-base-300">
			<div class="flex items-center justify-center gap-3">
				<div class="loading loading-spinner loading-sm"></div>
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
				<button class="btn btn-primary" onclick={handleCreateEvent}>
					Create First Event
				</button>
			{/if}
		</div>
	{/if}

	<!-- Missing Events Notification -->
	{#if hasMissingEvents && !loading}
		<div class="border-t border-base-300 bg-base-50 px-6 py-3">
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
					class="btn btn-ghost btn-xs text-base-content/50 hover:text-base-content"
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
