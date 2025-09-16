/**
 * Reactive Calendar Store
 * Follows the established Svelte 5 + RxJS patterns from user-profile.svelte.js and all-communities.svelte.js
 * Implements the timeline observable pattern from the React applesauce example
 */

import { getCalendarEventTitle, getCalendarEventStart, getCalendarEventEnd } from 'applesauce-core/helpers/calendar-event';
import { isEventInDateRange, groupEventsByDate, getWeekDates } from '../helpers/calendar.js';
import { appConfig } from '../config.js';
import { useActiveUser } from './accounts.svelte.js';
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, relays, eventStore } from '$lib/store.svelte';
import { useCalendarManagement } from './calendar-management-store.svelte.js';
import { addressLoader } from '$lib/loaders.js';
import { merge, EMPTY } from 'rxjs';

/**
 * @typedef {import('../types/calendar.js').CalendarEvent} CalendarEvent
 * @typedef {import('../types/calendar.js').CalendarViewState} CalendarViewState
 * @typedef {import('../types/calendar.js').CalendarViewMode} CalendarViewMode
 * @typedef {import('../types/calendar.js').EventType} EventType
 */
/** @typedef {{ kind: number, pubkey: string, identifier: string }} AddressPointer */

/**
 * Helper function to create global calendar timeline loader
 * @returns {Function} Timeline loader function
 */
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

/**
 * Helper function to create user-specific calendar timeline loader
 * @param {string} userPubkey - User's public key
 * @returns {Function} Timeline loader function
 */
function createUserCalendarLoader(userPubkey) {
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

/**
 * Helper function to create specific calendar timeline loader
 * Uses Applesauce Address Loader to fetch addressable events by coordinates (kind:pubkey:d)
 * @param {string[]} eventReferences - Array of event references (a-tags) in "kind:pubkey:d" format
 * @returns {Function} Loader function returning an Observable of events
 */
function createSpecificCalendarLoader(eventReferences) {
	// Parse "kind:pubkey:d" strings into AddressPointer objects
	/** @type {AddressPointer[]} */
	const pointers = (eventReferences || [])
		.map((ref) => {
			const [kindStr, pubkey, identifier] = (ref || '').split(':');
			const kind = Number(kindStr);
			if (!kind || !pubkey || !identifier) return null;
			return { kind, pubkey, identifier };
		})
		.filter((p) => !!p);

	// Return an observable factory that merges address loader streams
	return () => {
		if (pointers.length === 0) {
			console.warn('📅 Calendar Store: No valid event address pointers for selected calendar');
			return EMPTY;
		}
		const streams = pointers.map((pointer) => addressLoader(pointer));
		return merge(...streams);
	};
}

/**
 * Create a reactive calendar store with timeline loading
 * @param {any} [calendarSelectionStore] - Optional calendar selection store for reactive filtering
 * @returns {Object} Calendar store with reactive getter functions
 */
export function createCalendarStore(calendarSelectionStore = null) {
	// Reactive state following established patterns
	let events = $state(/** @type {CalendarEvent[]} */ ([]));
	let viewState = $state(/** @type {CalendarViewState} */ ({
		currentDate: new Date(),
		viewMode: /** @type {CalendarViewMode} */ ('month'),
		selectedEvent: undefined,
		isCreating: false,
		eventType: /** @type {EventType} */ ('date')
	}));
	let loading = $state(false);
	let error = $state(/** @type {string | null} */ (null));

	// Reactive state for calendar selection - properly reactive to store changes
	let selectedCalendarId = $state('');
	let isGlobalMode = $state(true);

	// Reactive state for active user using the new hook
	const getActiveUser = useActiveUser();

	// Computed state for current view events
	let currentMonthEvents = $state(/** @type {any[]} */ ([]));
	let currentWeekEvents = $state(/** @type {any[]} */ ([]));
	let currentDayEvents = $state(/** @type {any[]} */ ([]));
	let groupedEvents = $state(/** @type {Map<string, any[]>} */ (new Map()));

	// Timeline subscription management
	/** @type {import('rxjs').Subscription | null} */
	let currentSubscription = null;

	// Initialize reactive state from calendar selection store
	if (calendarSelectionStore) {
		// Initialize with current values
		selectedCalendarId = calendarSelectionStore.selectedCalendarId;
		isGlobalMode = calendarSelectionStore.isGlobalMode;

		// Subscribe to calendar selection changes and update reactive state
		const selectionSubscription = calendarSelectionStore.getSelectionObservable().subscribe(/** @param {string} calendarId */ (calendarId) => {
			console.log('📅 Calendar Store: Calendar selection changed to:', calendarId);
			selectedCalendarId = calendarId;
			isGlobalMode = calendarId === '';
		});

		// Cleanup function will be returned from $effect
		$effect(() => {
			return () => selectionSubscription.unsubscribe();
		});
	}



	// Subscribe to calendar management store loading state for reactive updates
	$effect(() => {
		const activeUser = getActiveUser();
		if (activeUser && selectedCalendarId && !isGlobalMode && selectedCalendarId !== activeUser.pubkey) {
			const calendarManagementStore = useCalendarManagement(activeUser.pubkey);
			const loadingSubscription = calendarManagementStore.loading$.subscribe((isLoading) => {
				console.log('📅 Calendar Store: Calendar management loading state changed:', isLoading);
				// The main $effect will automatically re-run due to the dependency change
				// This ensures calendar events are refreshed when calendar management finishes loading
			});

			return () => loadingSubscription.unsubscribe();
		}
	});

	// Helper function to get appropriate timeline loader based on calendar selection
	function getTimelineLoader() {
		const activeUser = getActiveUser();
		if (isGlobalMode) {
			// Global calendar - all events
			console.log('📅 Calendar Store: Using global calendar loader');
			return createGlobalCalendarLoader();
		} else if (activeUser && selectedCalendarId === activeUser.pubkey) {
			// My Events - all events created by the user
			console.log('📅 Calendar Store: Using user events loader for:', activeUser.pubkey);
			return createUserCalendarLoader(activeUser.pubkey);
		} else if (activeUser && selectedCalendarId) {
			// Specific calendar - get event references from calendar management store
			console.log('📅 Calendar Store: Looking for specific calendar:', selectedCalendarId);

			// Get calendar management store for the active user
			const calendarManagementStore = useCalendarManagement(activeUser.pubkey);

			// Check if calendar management store is still loading
			if (calendarManagementStore.loading) {
				console.log('📅 Calendar Store: Calendar management store is loading, using global loader temporarily');
				return createGlobalCalendarLoader();
			}

			// Find the selected calendar - ensure we have the latest data
			const selectedCalendar = calendarManagementStore.calendars.find(cal => cal.id === selectedCalendarId);

			if (selectedCalendar) {
				if (selectedCalendar.eventReferences && selectedCalendar.eventReferences.length > 0) {
					console.log('📅 Calendar Store: Found calendar with event references:', selectedCalendar.eventReferences);
					return createSpecificCalendarLoader(selectedCalendar.eventReferences);
				} else {
					console.log('📅 Calendar Store: Found calendar but no event references, showing empty calendar');
					return createSpecificCalendarLoader([]); // Show empty calendar instead of global
				}
			} else {
				console.log('📅 Calendar Store: Calendar not found in management store, falling back to global');
				console.log('📅 Calendar Store: Available calendars:', calendarManagementStore.calendars.map(c => ({ id: c.id, title: c.title })));
				return createGlobalCalendarLoader(); // Only fall back to global when calendar not found
			}
		} else {
			// Fallback to global if no active user
			console.log('📅 Calendar Store: No active user, using global loader');
			return createGlobalCalendarLoader();
		}
	}

/** @param {any} event */
function convertToCalendarEvent(event) {
		// Use applesauce helper functions as the single source of truth for date parsing
		// These handle both NIP-52 date formats (ISO strings and UNIX timestamps) consistently
		const startTimestamp = getCalendarEventStart(event);
		const endTimestamp = getCalendarEventEnd(event);

		// Ensure we have valid timestamps - fallback to current time if missing
		const validStartTimestamp = startTimestamp || Math.floor(Date.now() / 1000);
		// Extract d-tag identifier for addressable reference building and management ops
		const dTag = Array.isArray(event.tags)
			? (event.tags.find(/** @param {any[]} t */ (t) => t && t[0] === 'd')?.[1] || undefined)
			: undefined;

		console.log('📅 Calendar Store: Converting event using applesauce helpers:', {
			eventId: event.id,
			kind: event.kind,
			startTimestamp: validStartTimestamp,
			endTimestamp: endTimestamp,
			title: getCalendarEventTitle(event)
		});

		return {
			id: event.id,
			pubkey: event.pubkey,
			kind: /** @type {import('../types/calendar.js').CalendarEventKind} */ (event.kind),
			title: getCalendarEventTitle(event) || 'Untitled Event',
			summary: event.content || '',
			image: '',
			// Use applesauce helpers for consistent UNIX timestamp handling
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

	// Main effect for loading calendar events using TimelineLoader
	// This effect depends on calendar selection state and calendar management loading state
	$effect(() => {
		// Explicitly depend on calendar selection state to ensure reactivity
		const currentSelection = selectedCalendarId;
		const currentGlobalMode = isGlobalMode;
		const currentActiveUser = getActiveUser();

		// Also depend on calendar management loading state for specific calendars
		let calendarManagementLoading = false;
		let selectedCalendar = null;

		if (currentActiveUser && currentSelection && !currentGlobalMode && currentSelection !== currentActiveUser.pubkey) {
			const calendarManagementStore = useCalendarManagement(currentActiveUser.pubkey);
			calendarManagementLoading = calendarManagementStore.loading;

			// Explicitly find the selected calendar to ensure reactivity
			selectedCalendar = calendarManagementStore.calendars.find(cal => cal.id === currentSelection);

			console.log('📅 Calendar Store: Calendar management loading state:', calendarManagementLoading);
			console.log('📅 Calendar Store: Selected calendar found:', selectedCalendar ? selectedCalendar.title : 'null');
		}

		console.log('📅 Calendar Store: Effect triggered with:', {
			selectedCalendarId: currentSelection,
			isGlobalMode: currentGlobalMode,
			activeUser: currentActiveUser?.pubkey,
			calendarManagementLoading,
			selectedCalendarTitle: selectedCalendar?.title,
			timestamp: new Date().toISOString()
		});

		// Cleanup previous subscription
		if (currentSubscription) {
			currentSubscription.unsubscribe();
			currentSubscription = null;
		}

		// Clear existing events when switching loaders
		events = [];
		loading = true;
		error = null;

		// Get appropriate timeline loader
		const timelineLoader = getTimelineLoader();

		// Subscribe directly to timeline loader (following all-communities.svelte.js pattern)
		currentSubscription = timelineLoader().subscribe({
			next: /** @param {any} event */ (event) => {
				console.log('Received calendar event from TimelineLoader:', event.id);

				// Convert to our CalendarEvent format
				const calendarEvent = convertToCalendarEvent(event);

				// Add to events array with deduplication
				const existingIndex = events.findIndex((e) => e.id === calendarEvent.id);
				if (existingIndex === -1) {
					events = [...events, calendarEvent].sort((a, b) => a.createdAt - b.createdAt);
				}

				// Mark loading as complete after first event
				if (loading) {
					loading = false;
				}
			},
			error: /** @param {any} err */ (err) => {
				console.error('TimelineLoader error:', err);
				error = 'Failed to load calendar events';
				loading = false;
			},
			complete: () => {
				console.log('TimelineLoader subscription complete');
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

	// Return reactive store object following established patterns
	return {
		// Reactive getter functions (following established pattern)
		events: () => events,
		viewState: () => viewState,
		loading: () => loading,
		error: () => error,
		currentMonthEvents: () => currentMonthEvents,
		currentWeekEvents: () => currentWeekEvents,
		currentDayEvents: () => currentDayEvents,
		groupedEvents: () => groupedEvents,

		// Methods for actions
		getCurrentViewEvents,

		/** @param {CalendarViewMode} mode */
		setViewMode(mode) {
			const previousMode = viewState.viewMode;
			viewState.viewMode = /** @type {CalendarViewMode} */ (mode);

			// When switching TO day view, ensure loading is false since we're just filtering
			if (previousMode !== mode && mode === 'day') {
				loading = false;
				error = null;
			}
		},

		/** @param {Date} date */
		setCurrentDate(date) {
			viewState.currentDate = new Date(date);
		},

		/** @param {Date} date */
		navigateToDate(date) {
			viewState.currentDate = new Date(date);
		},

		navigateNext() {
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
		},

		navigatePrevious() {
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
		},

		navigateToToday() {
			const newDate = new Date();
			viewState.currentDate = newDate;
		},

		/** @param {any} event */
		selectEvent(event) {
			viewState.selectedEvent = event;
		},

		clearSelection() {
			viewState.selectedEvent = undefined;
		},

		startCreating(/** @param {EventType} eventType */ eventType = 'date') {
			viewState.isCreating = true;
			viewState.eventType = /** @type {EventType} */ (eventType);
		},

		stopCreating() {
			viewState.isCreating = false;
			viewState.selectedEvent = undefined;
		},

		/** @param {EventType} eventType */
		setEventType(eventType /** @type {EventType} */) {
			viewState.eventType = /** @type {EventType} */ (eventType);
		},

		// Refresh events from the timeline
		refresh() {
			// Reset loading state - the $effect will handle reloading
			loading = false;
			error = null;
		},

		// Force refresh calendar events (used when calendar selection changes)
		forceRefresh() {
			console.log('📅 Calendar Store: Force refreshing calendar events');
			// Clear existing events and force the main effect to re-run
			events = [];
			loading = true;
			error = null;

			// The main $effect will automatically re-run due to the events array change
		},

		// Cleanup subscription
		destroy() {
			if (currentSubscription) {
				currentSubscription.unsubscribe();
				currentSubscription = null;
			}
		}
	};
}

/**
 * Global calendar events store instance
 */
/** @type {any} */
let globalCalendarStore = null;

/**
 * Get or create the global calendar events store
 * @param {any} [calendarSelectionStore] - Optional calendar selection store for reactive filtering
 * @returns {Object} Global calendar store instance
 */
export function useGlobalCalendarEvents(calendarSelectionStore = null) {
	// If we don't have a store yet, create one
	if (!globalCalendarStore) {
		console.log('📅 Calendar Store: Creating new global calendar store instance');
		globalCalendarStore = createCalendarStore(calendarSelectionStore);
		return globalCalendarStore;
	}

	// If we have a store but no calendar selection store was provided, return existing
	if (!calendarSelectionStore) {
		console.log('📅 Calendar Store: Returning existing global calendar store (no selection store provided)');
		return globalCalendarStore;
	}

	// If we have both a store and a calendar selection store, ensure they're properly connected
	// Check if the existing store is properly connected to the calendar selection store
	const storeHasSelectionStore = globalCalendarStore && typeof globalCalendarStore === 'object';

	if (storeHasSelectionStore) {
		console.log('📅 Calendar Store: Returning existing global calendar store with selection store');
		return globalCalendarStore;
	}

	// If we get here, we need to recreate the store with the calendar selection store
	console.log('📅 Calendar Store: Recreating global calendar store with selection store');
	cleanupGlobalCalendarStore();
	globalCalendarStore = createCalendarStore(calendarSelectionStore);
	return globalCalendarStore;
}

/**
 * Cleanup global calendar store
 */
export function cleanupGlobalCalendarStore() {
	if (globalCalendarStore && typeof globalCalendarStore.destroy === 'function') {
		globalCalendarStore.destroy();
	}
	globalCalendarStore = null;
}

/**
 * Community calendar events store instances
 */
const communityCalendarStores = new Map();

/**
 * Get or create a calendar events store for a community
 * @param {string} communityPubkey - Community public key
 * @returns {Object} Calendar store instance
 */
export function useCalendarEvents(communityPubkey) {
	if (!communityCalendarStores.has(communityPubkey)) {
		communityCalendarStores.set(communityPubkey, createCalendarStore());
	}
	return communityCalendarStores.get(communityPubkey);
}

/**
 * Cleanup all community calendar stores
 */
export function cleanupCommunityCalendarStores() {
	communityCalendarStores.forEach(store => {
		if (store && typeof store.destroy === 'function') {
			store.destroy();
		}
	});
	communityCalendarStores.clear();
}
