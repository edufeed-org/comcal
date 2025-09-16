/**
 * Unified Calendar Store
 * Single reactive store for managing calendar events with configurable filtering
 * Supports both global and community-specific calendar views
 * Follows established reactivity patterns using $state and $effect
 */

import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, relays, eventStore } from '$lib/store.svelte';
import { getCalendarEventTitle, getCalendarEventStart, getCalendarEventEnd } from 'applesauce-core/helpers/calendar-event';
import { isEventInDateRange, groupEventsByDate, getWeekDates } from '../helpers/calendar.js';
import { appConfig } from '../config.js';
import { manager } from '../accounts.svelte.js';
import { useCalendarManagement } from './calendar-management-store.svelte.js';

/**
 * @typedef {import('../types/calendar.js').CalendarEvent} CalendarEvent
 * @typedef {import('../types/calendar.js').CalendarViewState} CalendarViewState
 * @typedef {import('../types/calendar.js').CalendarStore} CalendarStore
 * @typedef {import('../types/calendar.js').CalendarViewMode} CalendarViewMode
 * @typedef {import('../types/calendar.js').EventType} EventType
 */

/**
 * Create a calendar store with configurable filtering
 * @param {any} filterConfig - Nostr filter configuration
 * @param {string} [calendarId] - Optional calendar ID to filter by
 * @param {any} [calendarSelectionStore] - Optional calendar selection store for reactive filtering
 * @returns {CalendarStore} Calendar store with reactive state
 */
export function createCalendarStore(filterConfig, calendarId = '', calendarSelectionStore = null) {
	// Current calendar filter state - reactive to selection store if provided
	let currentCalendarId = $state(calendarId);

	// Subscribe to calendar selection store for reactive filtering
	let selectionSubscription = null;
	if (calendarSelectionStore) {
		// Initialize with current selection
		currentCalendarId = calendarSelectionStore.selectedCalendarId;

		selectionSubscription = calendarSelectionStore.getSelectionObservable().subscribe((selectedId) => {
			console.log('📅 Calendar Store: Selection changed to:', selectedId);
			currentCalendarId = selectedId;

			// When selection changes, refresh the event loading strategy
			refreshEventLoading();
		});
	}
	// Single reactive object to maintain proper reactivity
	let store = $state({
		events: /** @type {CalendarEvent[]} */ ([]),
		viewState: /** @type {CalendarViewState} */ ({
			currentDate: new Date(),
			viewMode: /** @type {CalendarViewMode} */ ('month'),
			selectedEvent: undefined,
			isCreating: false,
			eventType: /** @type {EventType} */ ('date')
		}),
		loading: false,
		error: /** @type {string | null} */ (null)
	});

	// Helper function to filter events by calendar
	function filterEventsByCalendar(events, filterCriteria = currentCalendarId) {
		if (!filterCriteria || filterCriteria === '') {
			// No calendar filter - return all events (Global Calendar)
			return events;
		}

		const activeUser = manager.active;
		if (!activeUser) {
			// If no user is logged in, fall back to global view
			return events;
		}

		// Check if filterCriteria is the active user's pubkey (My Events)
		if (filterCriteria === activeUser.pubkey) {
			console.log('📅 Calendar Store: Filtering for My Events (user pubkey):', filterCriteria);
			return events.filter(event => event.pubkey === activeUser.pubkey);
		}

		// Otherwise, treat as calendar ID - strict calendar filtering
		const calendarManagement = useCalendarManagement(activeUser.pubkey);
		const selectedCalendar = calendarManagement.calendars.find(cal => cal.id === filterCriteria);

		if (!selectedCalendar) {
			// Calendar not loaded yet or not found - return empty array
			// The reactive system will re-run this filter when calendar data loads
			console.log('📅 Calendar Store: Calendar not loaded yet or not found:', filterCriteria, 'calendars loaded:', calendarManagement.calendars.length);
			return [];
		}

		// Ensure calendar events are loaded before filtering
		loadCalendarEventsIfNeeded(selectedCalendar);

		// Filter events that are explicitly referenced in the selected calendar
		const filteredEvents = events.filter((event) => {
			// Check if this event is referenced in the calendar's eventReferences
			const eventReference = `${event.kind}:${event.pubkey}:${event.dTag || ''}`;
			const isInCalendar = selectedCalendar.eventReferences.includes(eventReference);

			console.log('📅 Calendar Store: Event', event.title, 'in calendar?', isInCalendar, 'reference:', eventReference);
			return isInCalendar;
		});

		console.log('📅 Calendar Store: Filtered', filteredEvents.length, 'events for calendar:', selectedCalendar.title);
		return filteredEvents;
	}

	// Helper function to load calendar events if they're not already loaded
	function loadCalendarEventsIfNeeded(selectedCalendar) {
		// Parse a-tag references to create filters for missing events
		const eventFilters = parseCalendarEventReferences(selectedCalendar.eventReferences);

		if (eventFilters.length === 0) {
			return; // No specific events to load
		}

		// Check which events are already loaded
		/** @type {string[]} */
		const missingEventIds = [];
		/** @type {Array<{kind: number, author: string, dTag: string}>} */
		const missingFilters = [];

		eventFilters.forEach(/** @param {{kind: number, author: string, dTag: string}} filter */ filter => {
			const existingEvents = store.events.filter(/** @param {CalendarEvent} event */ event =>
				event.kind === filter.kind &&
				event.pubkey === filter.author &&
				event.dTag === filter.dTag
			);

			if (existingEvents.length === 0) {
				// Event not loaded yet, add to missing list
				missingEventIds.push(`${filter.kind}:${filter.author}:${filter.dTag}`);
				missingFilters.push(filter);
			}
		});

		if (missingFilters.length > 0) {
			console.log('📅 Calendar Store: Loading missing calendar events:', missingEventIds);
			loadSpecificEvents(missingFilters);
		}
	}

	// Parse calendar a-tag references into filter objects
	function parseCalendarEventReferences(eventReferences) {
		/** @type {Array<{kind: number, author: string, dTag: string}>} */
		const filters = [];

		eventReferences.forEach(/** @param {string} ref */ ref => {
			// Parse a-tag format: "kind:pubkey:d-tag"
			const parts = ref.split(':');
			if (parts.length >= 3) {
				const kind = parseInt(parts[0]);
				const pubkey = parts[1];
				const dTag = parts.slice(2).join(':'); // Handle d-tags that might contain colons

				if (kind === 31922 || kind === 31923) {
					filters.push({
						kind,
						author: pubkey,
						dTag
					});
				}
			}
		});

		return filters;
	}

	// Load specific events using targeted filters
	function loadSpecificEvents(eventFilters /** @type {Array<{kind: number, author: string, dTag: string}>} */) {
		// Group filters by kind for efficient querying
		/** @type {Record<number, {kinds: number[], authors: string[], '#d': string[]}>} */
		const filtersByKind = {};
		eventFilters.forEach(/** @param {{kind: number, author: string, dTag: string}} filter */ filter => {
			if (!filtersByKind[filter.kind]) {
				filtersByKind[filter.kind] = {
					kinds: [filter.kind],
					authors: [],
					'#d': []
				};
			}
			filtersByKind[filter.kind].authors.push(filter.author);
			filtersByKind[filter.kind]['#d'].push(filter.dTag);
		});

		// Create timeline loaders for each kind
		Object.values(filtersByKind).forEach(/** @param {{kinds: number[], authors: string[], '#d': string[]}} filter */ filter => {
			const timelineLoader = createTimelineLoader(
				pool,
				relays,
				filter,
				{ eventStore }
			);

			const subscription = timelineLoader()
				.pipe(
					map(/** @param {any} event */ event => convertNDKEventToCalendarEvent(event)),
					catchError(/** @param {any} error */ error => {
						console.error('Error loading specific calendar event:', error);
						return of(null);
					})
				)
				.subscribe(/** @param {CalendarEvent | null} event */ event => {
					if (event) {
						// Check if event already exists to avoid duplicates
						const exists = store.events.some(e => e.id === event.id);
						if (!exists) {
							console.log('📅 Calendar Store: Adding calendar-specific event:', event.title);
							store.events = [...store.events, event];
						}
					}
				});

			// Clean up subscription after a short delay
			setTimeout(() => subscription.unsubscribe(), 10000);
		});
	}

	// Derived state for computed properties - now properly reactive without manual triggers
	let currentMonthEvents = $derived(() => {
		const { currentDate, viewMode } = store.viewState;
		if (viewMode !== 'month') return filterEventsByCalendar(store.events || []);

		// Use consistent local timezone dates for month range
		const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
		const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

		return filterEventsByCalendar(store.events || []).filter((event /** @type {CalendarEvent} */) =>
			isEventInDateRange(event, startOfMonth, endOfMonth)
		);
	});

	let currentWeekEvents = $derived(() => {
		const { currentDate, viewMode } = store.viewState;
		if (viewMode !== 'week') return filterEventsByCalendar(store.events || []);

		// Use configured week start day for consistent week calculation
		const weekDates = getWeekDates(currentDate);
		const startOfWeek = weekDates[0];
		const endOfWeek = weekDates[weekDates.length - 1];

		return filterEventsByCalendar(store.events || []).filter((event /** @type {CalendarEvent} */) =>
			isEventInDateRange(event, startOfWeek, endOfWeek)
		);
	});

	let currentDayEvents = $derived(() => {
		const { currentDate, viewMode } = store.viewState;
		if (viewMode !== 'day') return filterEventsByCalendar(store.events || []);

		// Use consistent local timezone dates for day range
		const startOfDay = new Date(currentDate);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(currentDate);
		endOfDay.setHours(23, 59, 59, 999);

		return filterEventsByCalendar(store.events || []).filter((event /** @type {CalendarEvent} */) =>
			isEventInDateRange(event, startOfDay, endOfDay)
		);
	});

	let groupedEvents = $derived(() => {
		const currentEvents = getCurrentViewEvents();
		return groupEventsByDate(currentEvents || []);
	});

	// Create timeline loader for calendar events
	let timelineLoader = null;
	/** @type {import('rxjs').Subscription | null} */
	let subscription = null;

	// Initialize timeline loader and subscription
	function initializeLoader() {
		// Clean up existing subscription
		if (subscription) {
			subscription.unsubscribe();
		}

		// Create timeline loader with provided filter configuration
		timelineLoader = createTimelineLoader(
			pool,
			relays,
			filterConfig,
			{ eventStore }
		);

		subscription = timelineLoader()
			.pipe(
				map(/** @param {any} event */ event => convertNDKEventToCalendarEvent(event)),
				catchError(/** @param {any} error */ error => {
					console.error('Error loading calendar event:', error);
					store.error = error.message || 'Failed to load calendar events';
					return of(null);
				})
			)
				.subscribe(/** @param {CalendarEvent | null} event */ event => {
					if (event) {
						// Check if event already exists to avoid duplicates
						const exists = store.events.some(/** @param {CalendarEvent} e */ e => e.id === event.id);
						if (!exists) {
							console.log('📅 Calendar Store: Adding new event:', event.title);
							store.events = [...store.events, event];
							// console.log('📅 Calendar Store: Events count now:', store.events.length);
						}
					}
					store.loading = false;
					store.error = null;
				});
	}

	// Initialize loader based on current selection
	if (calendarSelectionStore && calendarSelectionStore.selectedCalendarId) {
		// Pre-selected calendar - load specific events immediately
		console.log('📅 Calendar Store: Initializing with pre-selected calendar:', calendarSelectionStore.selectedCalendarId);
		refreshEventLoading();
	} else {
		// No selection - load global events
		console.log('📅 Calendar Store: Initializing with global calendar view');
		initializeLoader();
	}

	// Function to refresh event loading strategy based on current selection
	function refreshEventLoading() {
		console.log('📅 Calendar Store: Refreshing event loading for selection:', currentCalendarId);

		// DON'T clear existing events or set loading=true - let UI show immediately
		// store.events = []; // REMOVED - keep existing events visible
		// store.loading = true; // REMOVED - don't block UI
		store.error = null;

		// Clean up existing subscription
		if (subscription) {
			subscription.unsubscribe();
		}

		// Determine loading strategy based on current selection
		if (!currentCalendarId || currentCalendarId === '') {
			// Global view - load all events
			console.log('📅 Calendar Store: Loading global events');
			initializeLoader();
		} else {
			// Specific calendar selected - load only that calendar's events
			const activeUser = manager.active;
			if (activeUser) {
				const calendarManagement = useCalendarManagement(activeUser.pubkey);
				const selectedCalendar = calendarManagement.calendars.find(cal => cal.id === currentCalendarId);

				if (selectedCalendar && selectedCalendar.eventReferences.length > 0) {
					console.log('📅 Calendar Store: Loading events for calendar:', selectedCalendar.title);
					loadCalendarSpecificEvents(selectedCalendar);
				} else {
					console.log('📅 Calendar Store: Calendar not found or empty, keeping existing events');
					// Don't set loading=false here - let existing events remain visible
				}
			} else {
				console.log('📅 Calendar Store: No active user, keeping existing events');
				// Don't set loading=false here - let existing events remain visible
			}
		}
	}

	// Function to load events for a specific calendar
	function loadCalendarSpecificEvents(selectedCalendar) {
		const eventFilters = parseCalendarEventReferences(selectedCalendar.eventReferences);

		if (eventFilters.length === 0) {
			// Don't set loading=false here - let UI remain reactive
			return;
		}

		console.log('📅 Calendar Store: Loading', eventFilters.length, 'specific events for calendar:', selectedCalendar.title);

		// Group filters by kind for efficient querying
		/** @type {Record<number, {kinds: number[], authors: string[], '#d': string[]}>} */
		const filtersByKind = {};
		eventFilters.forEach(/** @param {{kind: number, author: string, dTag: string}} filter */ filter => {
			if (!filtersByKind[filter.kind]) {
				filtersByKind[filter.kind] = {
					kinds: [filter.kind],
					authors: [],
					'#d': []
				};
			}
			filtersByKind[filter.kind].authors.push(filter.author);
			filtersByKind[filter.kind]['#d'].push(filter.dTag);
		});

		// Create subscriptions for each kind
		const subscriptions = Object.values(filtersByKind).map(/** @param {{kinds: number[], authors: string[], '#d': string[]}} filter */ filter => {
			const timelineLoader = createTimelineLoader(
				pool,
				relays,
				filter,
				{ eventStore }
			);

			return timelineLoader()
				.pipe(
					map(/** @param {any} event */ event => convertNDKEventToCalendarEvent(event)),
					catchError(/** @param {any} error */ error => {
						console.error('Error loading calendar-specific event:', error);
						return of(null);
					})
				)
				.subscribe(/** @param {CalendarEvent | null} event */ event => {
					if (event) {
						// Check if event already exists to avoid duplicates
						const exists = store.events.some(e => e.id === event.id);
						if (!exists) {
							console.log('📅 Calendar Store: Added calendar event:', event.title);
							store.events = [...store.events, event];
						}
					}
					// Don't set loading=false here - let UI remain reactive
					store.error = null;
				});
		});

		// Clean up subscriptions after loading
		setTimeout(() => {
			subscriptions.forEach(sub => sub.unsubscribe());
		}, 15000); // Longer timeout for calendar-specific loading
	}

	// Helper function for getting current view events
	function getCurrentViewEvents() {
		switch (store.viewState.viewMode) {
			case 'month':
				return currentMonthEvents();
			case 'week':
				return currentWeekEvents();
			case 'day':
				return currentDayEvents();
			default:
				return store.events || [];
		}
	}

	// Return reactive store object
	return {
		// Reactive state (directly accessible)
		get events() { return store.events; },
		get viewState() { return store.viewState; },
		get loading() { return store.loading; },
		get error() { return store.error; },

		// Computed properties (reactive through $derived) - getters that call derived functions
		get currentMonthEvents() { return currentMonthEvents(); },
		get currentWeekEvents() { return currentWeekEvents(); },
		get currentDayEvents() { return currentDayEvents(); },
		get groupedEvents() { return groupedEvents(); },

		// Methods
		getCurrentViewEvents,

		setViewMode(/** @param {CalendarViewMode} mode */ mode) {
			store.viewState.viewMode = /** @type {CalendarViewMode} */ (mode);
		},

		setCurrentDate(/** @param {Date} date */ date) {
			store.viewState.currentDate = new Date(date);
		},

		navigateToDate(/** @param {Date} date */ date) {
			this.setCurrentDate(date);
		},

		navigateNext() {
			const { currentDate, viewMode } = store.viewState;
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

			this.setCurrentDate(newDate);
		},

		navigatePrevious() {
			const { currentDate, viewMode } = store.viewState;
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

			this.setCurrentDate(newDate);
		},

		navigateToToday() {
			this.setCurrentDate(new Date());
		},

		selectEvent(/** @param {CalendarEvent} event */ event) {
			store.viewState.selectedEvent = event;
		},

		clearSelection() {
			store.viewState.selectedEvent = undefined;
		},

		startCreating(/** @param {EventType} eventType */ eventType = 'date') {
			store.viewState.isCreating = true;
			store.viewState.eventType = /** @type {EventType} */ (eventType);
		},

		stopCreating() {
			store.viewState.isCreating = false;
			store.viewState.selectedEvent = undefined;
		},

		setEventType(/** @param {EventType} eventType */ eventType) {
			store.viewState.eventType = /** @type {EventType} */ (eventType);
		},

		// Refresh events from the timeline
		refresh() {
			store.loading = true;
			store.error = null;
			store.events = []; // Clear existing events
			initializeLoader(); // Reinitialize loader
		},

		// Cleanup subscription
		destroy() {
			if (subscription) {
				subscription.unsubscribe();
			}
		}
	};
}

/**
 * Convert NDK event to CalendarEvent object
 * @param {any} ndkEvent - NDK event
 * @returns {CalendarEvent} Calendar event object
 */
function convertNDKEventToCalendarEvent(ndkEvent) {
	/** @type {CalendarEvent} */
	const event = {
		id: ndkEvent.id || '',
		pubkey: ndkEvent.pubkey || '',
		kind: ndkEvent.kind,
		title: getCalendarEventTitle(ndkEvent) || 'Untitled Event',
		summary: ndkEvent.content || '',
		image: '',
		start: getCalendarEventStart(ndkEvent) || 0,
		end: getCalendarEventEnd(ndkEvent),
		startTimezone: '',
		endTimezone: '',
		locations: [],
		participants: [],
		hashtags: [],
		references: [],
		geohash: '',
		communityPubkey: '',
		createdAt: ndkEvent.created_at || 0
	};

	// Extract additional data from tags
	if (ndkEvent.tags) {
		ndkEvent.tags.forEach(/** @param {any[]} tag */ tag => {
			switch (tag[0]) {
				case 'd':
					// Extract d-tag for NIP-52 event identification
					event.dTag = tag[1] || '';
					break;
				case 'image':
					event.image = tag[1] || '';
					break;
				case 'location':
					if (tag[1]) event.locations.push(tag[1]);
					break;
				case 'start_tz':
					event.startTimezone = tag[1] || '';
					break;
				case 'end_tz':
					event.endTimezone = tag[1] || '';
					break;
				case 't':
					if (tag[1]) event.hashtags.push(tag[1]);
					break;
				case 'e':
					if (tag[1]) event.references.push(tag[1]);
					break;
				case 'g':
					event.geohash = tag[1] || '';
					break;
				case 'h':
					// Extract community pubkey from h-tag (Communikey targeting)
					event.communityPubkey = tag[1] || '';
					break;
				case 'a':
					// Extract community pubkey from targeting tag
					if (tag[1] && tag[1].includes('34550:')) {
						const parts = tag[1].split(':');
						if (parts.length >= 2) {
							event.communityPubkey = parts[1];
						}
					}
					break;
				case 'p':
					// Add participants
					if (tag[1]) {
						event.participants.push({
							pubkey: tag[1],
							relay: tag[2],
							role: tag[3]
						});
					}
					break;
			}
		});
	}

	return event;
}

/**
 * Global calendar events store instance
 * @type {CalendarStore | null}
 */
let globalCalendarStore = null;

/**
 * Get or create the global calendar events store
 * @param {any} [calendarSelectionStore] - Optional calendar selection store for reactive filtering
 * @returns {CalendarStore} Global calendar store instance
 */
export function useGlobalCalendarEvents(calendarSelectionStore = null) {
	if (!globalCalendarStore) {
		globalCalendarStore = createCalendarStore({
			kinds: [31922, 31923],
			limit: 250
		}, '', calendarSelectionStore);
	}
	return /** @type {CalendarStore} */ (globalCalendarStore);
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
 * @type {Map<string, CalendarStore>}
 */
const communityCalendarStores = new Map();

/**
 * Get or create a calendar events store for a community
 * @param {string} communityPubkey - Community public key
 * @returns {CalendarStore} Calendar store instance
 */
export function useCalendarEvents(communityPubkey) {
	if (!communityCalendarStores.has(communityPubkey)) {
		communityCalendarStores.set(communityPubkey, createCalendarStore({
			kinds: [31922, 31923],
			'#h': [communityPubkey],
			limit: 250
		}));
	}
	return /** @type {CalendarStore} */ (communityCalendarStores.get(communityPubkey));
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
