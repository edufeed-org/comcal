<!--
  CommunityCalendar Component
  Main calendar component integrating all calendar functionality for a community
-->

<script>
	import { useCalendarSelection } from '$lib/stores/calendar-selection.svelte.js';
	import { useCalendarManagement } from '$lib/stores/calendar-management-store.svelte.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';
	import { eventStore, pool, relays } from '$lib/store.svelte';
	import { CalendarEventRSVPsModel } from 'applesauce-core/models';
	import { createTimelineLoader } from 'applesauce-loaders/loaders';
	import { addressLoader } from '$lib/loaders.js';
	import { getCalendarEventTitle, getCalendarEventStart, getCalendarEventEnd, getCalendarEventImage } from 'applesauce-core/helpers/calendar-event';
	import { isEventInDateRange, groupEventsByDate, getWeekDates } from '$lib/helpers/calendar.js';
	import { merge, EMPTY } from 'rxjs';
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

	// Reactive calendar selection state
	let selectedCalendarId = $derived(calendarSelectionStore.selectedCalendarId);
	let isGlobalMode = $derived(calendarSelectionStore.isGlobalMode);

	// Direct reactive state for calendar events (no singleton dependency)
	let events = $state(/** @type {CalendarEvent[]} */ ([]));
	let loading = $state(false);
	let error = $state(/** @type {string | null} */ (null));

	// Calendar view state
	let viewState = $state(/** @type {any} */ ({
		currentDate: new Date(),
		viewMode: /** @type {CalendarViewMode} */ ('month'),
		selectedEvent: undefined,
		isCreating: false,
		eventType: /** @type {any} */ ('date')
	}));

	// Subscription management
	/** @type {import('rxjs').Subscription | null} */
	let currentSubscription = null;

	// Helper function to create global calendar timeline loader
	function createGlobalCalendarLoader() {
		return createTimelineLoader(
			pool,
			relays,
			{
				kinds: [31922, 31923], // NIP-52 calendar events
				limit: 250
			},
			{ eventStore }
		);
	}

	// Helper function to create user-specific calendar timeline loader
	function createUserCalendarLoader(/** @type {string} */ userPubkey) {
		return createTimelineLoader(
			pool,
			relays,
			{
				kinds: [31922, 31923],
				authors: [userPubkey],
				limit: 250
			},
			{ eventStore }
		);
	}

	// Helper function to create specific calendar timeline loader
	function createSpecificCalendarLoader(/** @type {string[]} */ eventReferences) {
		// Parse "kind:pubkey:d" strings into AddressPointer objects
		const pointers = (eventReferences || [])
			.map((/** @type {string} */ ref) => {
				const [kindStr, pubkey, identifier] = (ref || '').split(':');
				const kind = Number(kindStr);
				if (!kind || !pubkey || !identifier) return null;
				return { kind, pubkey, identifier };
			})
			.filter((/** @type {any} */ p) => !!p);

		// Return an observable factory that merges address loader streams
		return () => {
			if (pointers.length === 0) {
				console.warn('📅 CommunityCalendar: No valid event address pointers for selected calendar');
				return EMPTY;
			}
			const streams = pointers.map((/** @type {any} */ pointer) => addressLoader(pointer));
			return merge(...streams);
		};
	}

	// Helper function to convert NDK event to CalendarEvent format
	function convertToCalendarEvent(event) {
		// Use applesauce helper functions as the single source of truth for date parsing
		const startTimestamp = getCalendarEventStart(event);
		const endTimestamp = getCalendarEventEnd(event);

		// Ensure we have valid timestamps - fallback to current time if missing
		const validStartTimestamp = startTimestamp || Math.floor(Date.now() / 1000);

		// Extract d-tag identifier for addressable reference building and management ops
		const dTag = Array.isArray(event.tags)
			? (event.tags.find((t) => t && t[0] === 'd')?.[1] || undefined)
			: undefined;

		// console.log('📅 CommunityCalendar: Converting event using applesauce helpers:', {
		// 	eventId: event.id,
		// 	kind: event.kind,
		// 	startTimestamp: validStartTimestamp,
		// 	endTimestamp: endTimestamp,
		// 	title: getCalendarEventTitle(event)
		// });

		return {
			id: event.id,
			pubkey: event.pubkey,
			kind: /** @type {import('../../types/calendar.js').CalendarEventKind} */ (event.kind),
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

	// Main effect for loading calendar events with direct subscription management
	$effect(() => {
		const currentSelection = selectedCalendarId;
		const currentGlobalMode = isGlobalMode;
		const currentActiveUser = manager.active;

		console.log('📅 CommunityCalendar: Effect triggered with:', {
			selectedCalendarId: currentSelection,
			isGlobalMode: currentGlobalMode,
			activeUser: currentActiveUser?.pubkey,
			timestamp: new Date().toISOString()
		});

		// Cleanup previous subscription
		if (currentSubscription) {
			currentSubscription.unsubscribe();
			currentSubscription = null;
		}

		// Clear existing events when switching
		events = [];
		loading = true;
		error = null;

		// Get appropriate timeline loader based on current selection
		let timelineLoader = null;

		if (currentGlobalMode) {
			// Global calendar - all events
			console.log('📅 CommunityCalendar: Using global calendar loader');
			timelineLoader = createGlobalCalendarLoader();
		} else if (currentActiveUser && currentSelection === currentActiveUser.pubkey) {
			// My Events - all events created by the user
			console.log('📅 CommunityCalendar: Using user events loader for:', currentActiveUser.pubkey);
			timelineLoader = createUserCalendarLoader(currentActiveUser.pubkey);
		} else if (currentActiveUser && currentSelection) {
			// Specific calendar - get event references from calendar management store
			console.log('📅 CommunityCalendar: Looking for specific calendar:', currentSelection);

			const calendarManagementStore = useCalendarManagement(currentActiveUser.pubkey);

			// Check if calendar management store is still loading
			if (calendarManagementStore.loading) {
				console.log('📅 CommunityCalendar: Calendar management store is loading, using global loader temporarily');
				timelineLoader = createGlobalCalendarLoader();
			} else {
				// Find the selected calendar
				const selectedCalendar = calendarManagementStore.calendars.find(cal => cal.id === currentSelection);

				if (selectedCalendar) {
					if (selectedCalendar.eventReferences && selectedCalendar.eventReferences.length > 0) {
						console.log('📅 CommunityCalendar: Found calendar with event references:', selectedCalendar.eventReferences);
						timelineLoader = createSpecificCalendarLoader(selectedCalendar.eventReferences);
					} else {
						console.log('📅 CommunityCalendar: Found calendar but no event references, showing empty calendar');
						timelineLoader = createSpecificCalendarLoader([]); // Show empty calendar
					}
				} else {
					console.log('📅 CommunityCalendar: Calendar not found, using global loader');
					timelineLoader = createGlobalCalendarLoader();
				}
			}
		} else {
			// Fallback to global if no active user
			console.log('📅 CommunityCalendar: No active user, using global loader');
			timelineLoader = createGlobalCalendarLoader();
		}

		// Subscribe to the timeline loader with throttling to prevent overwhelming the main thread
		let eventBuffer = /** @type {any[]} */ ([]);
		let processingTimeout = /** @type {number | null} */ (null);

		const processEventBuffer = () => {
			if (eventBuffer.length === 0) return;

			// Process events in smaller batches
			const batchSize = 10;
			const batch = eventBuffer.splice(0, batchSize);
			
			batch.forEach(event => {
				// Convert to our CalendarEvent format
				const calendarEvent = convertToCalendarEvent(event);

				// Add to events array with deduplication
				const existingIndex = events.findIndex((e) => e.id === calendarEvent.id);
				if (existingIndex === -1) {
					events = [...events, calendarEvent].sort((a, b) => a.createdAt - b.createdAt);
				}
			});

			// Mark loading as complete after first batch
			if (loading && events.length > 0) {
				loading = false;
			}

			// Continue processing remaining events
			if (eventBuffer.length > 0) {
				processingTimeout = setTimeout(processEventBuffer, 16); // ~60fps
			}
		};

		currentSubscription = timelineLoader().subscribe({
			next: /** @param {any} event */ (event) => {
				// Buffer events instead of processing immediately
				eventBuffer.push(event);
				
				// Start processing if not already running
				if (!processingTimeout) {
					processingTimeout = setTimeout(processEventBuffer, 16);
				}
			},
			error: /** @param {any} err */ (err) => {
				console.error('📅 CommunityCalendar: TimelineLoader error:', err);
				error = 'Failed to load calendar events';
				loading = false;
			},
			complete: () => {
				console.log('📅 CommunityCalendar: TimelineLoader subscription complete');
				loading = false;
			}
		});

		// Return cleanup function
		return () => {
			if (currentSubscription) {
				currentSubscription.unsubscribe();
				currentSubscription = null;
			}
		};
	});

	// RSVP data management - reactive Map to store RSVP data for events
	let eventRSVPs = $state(new Map());

	// Load RSVPs for calendar events using established pattern
	$effect(() => {
		// Get all events from direct state
		const currentEvents = events;

		// Find events that don't have RSVP data loaded yet
		const eventsNeedingRSVPs = currentEvents.filter(/** @param {any} event */ (event) =>
			event.id && !eventRSVPs.has(event.id)
		);

		// Load RSVPs for new events
		eventsNeedingRSVPs.forEach(/** @param {any} event */ (event) => {
			if (event.id && event.originalEvent) {
				// Use the established pattern with eventStore.model for RSVP loading
				const rsvpsObservable = eventStore.model(CalendarEventRSVPsModel, event.originalEvent);
				const subscription = rsvpsObservable.subscribe(/** @param {any} rsvps */ (rsvps) => {
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

	// Computed state for current view events
	let currentMonthEvents = $state(/** @type {CalendarEvent[]} */ ([]));
	let currentWeekEvents = $state(/** @type {CalendarEvent[]} */ ([]));
	let currentDayEvents = $state(/** @type {CalendarEvent[]} */ ([]));
	let groupedEvents = $state(/** @type {Map<string, CalendarEvent[]>} */ (new Map()));

	// Effect to update computed view events when events or view state changes
	$effect(() => {
		const { currentDate, viewMode } = viewState;
		const filteredEvents = events; // Use loaded events

		// Update current view events based on view mode
		switch (viewMode) {
			case 'month':
				// Create UTC date range for the month view with padding
				const startOfMonth = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), 1));
				const endOfMonth = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
				// Add padding days for better UX
				startOfMonth.setUTCDate(startOfMonth.getUTCDate() - 7);
				endOfMonth.setUTCDate(endOfMonth.getUTCDate() + 7);
				currentMonthEvents = filteredEvents.filter((event) =>
					isEventInDateRange(event, startOfMonth, endOfMonth)
				);
				break;

			case 'week':
				// Use configured week start day for consistent week calculation
				const weekDates = getWeekDates(currentDate);
				// Convert to UTC dates for consistent comparison
				const startOfWeek = new Date(Date.UTC(
					weekDates[0].getFullYear(),
					weekDates[0].getMonth(),
					weekDates[0].getDate()
				));
				const endOfWeek = new Date(Date.UTC(
					weekDates[weekDates.length - 1].getFullYear(),
					weekDates[weekDates.length - 1].getMonth(),
					weekDates[weekDates.length - 1].getDate() + 1 // End of last day
				));
				// Add padding days
				startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 3);
				endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 3);
				currentWeekEvents = filteredEvents.filter((event) =>
					isEventInDateRange(event, startOfWeek, endOfWeek)
				);
				break;

			case 'day':
				// Create UTC date range for the selected day
				// dayStart: beginning of the selected day
				// dayEnd: beginning of the next day (exclusive upper bound)
				const dayStart = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
				const dayEnd = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1));

				currentDayEvents = filteredEvents.filter((event) =>
					isEventInDateRange(event, dayStart, dayEnd)
				);
				break;
		}
	});

	// Effect to update grouped events when current view events change
	$effect(() => {
		const currentEvents = getCurrentViewEvents();
		groupedEvents = groupEventsByDate(currentEvents || []);
	});

	// Helper function for getting current view events
	function getCurrentViewEvents() {
		switch (viewState.viewMode) {
			case 'month':
				return currentMonthEvents;
			case 'week':
				return currentWeekEvents;
			case 'day':
				return currentDayEvents;
			default:
				return events || [];
		}
	}

	/**
	 * Handle navigation to previous period
	 */
	function handlePrevious() {
		const { currentDate, viewMode } = viewState;
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

		viewState.currentDate = newDate;
	}

	/**
	 * Handle navigation to next period
	 */
	function handleNext() {
		const { currentDate, viewMode } = viewState;
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

		viewState.currentDate = newDate;
	}

	/**
	 * Handle navigation to today
	 */
	function handleToday() {
		const newDate = new Date();
		viewState.currentDate = newDate;
	}

	/**
	 * Handle view mode change
	 * @param {CalendarViewMode} newViewMode
	 */
	function handleViewModeChange(newViewMode) {
		const previousMode = viewState.viewMode;
		viewState.viewMode = newViewMode;

		// When switching TO day view, ensure loading is false since we're just filtering
		if (previousMode !== newViewMode && newViewMode === 'day') {
			loading = false;
			error = null;
		}
	}

	/**
	 * Handle date click in calendar grid
	 * @param {Date} date
	 */
	function handleDateClick(date) {
		// Navigate to the clicked date and switch to day mode
		viewState.currentDate = new Date(date);
		viewState.viewMode = 'day';
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
		selectedDateForNewEvent = viewState.currentDate;
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
		// Force refresh by triggering the main effect
		loading = true;
		error = null;
		// The main $effect will automatically re-run due to the loading state change
	}

	/**
	 * Handle refresh button click
	 */
	function handleRefresh() {
		// Force refresh by triggering the main effect
		loading = true;
		error = null;
		// The main $effect will automatically re-run due to the loading state change
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
		currentDate={viewState.currentDate}
		viewMode={viewState.viewMode}
		onPrevious={handlePrevious}
		onNext={handleNext}
		onToday={handleToday}
		onViewModeChange={handleViewModeChange}
	/>

	<!-- Always show Calendar Grid immediately - no blocking loading state -->
	<CalendarGrid
		currentDate={viewState.currentDate}
		viewMode={viewState.viewMode}
		groupedEvents={groupedEvents}
		onEventClick={handleEventClick}
		onDateClick={handleDateClick}
	/>

	<!-- Show subtle loading indicator in header when initially loading -->
	{#if loading && events.length === 0}
		<div class="text-sm text-base-content/60 px-6 py-2 text-center">
			Loading calendar events...
		</div>
	{/if}

	<!-- Empty State - only show when no events and not loading -->
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
