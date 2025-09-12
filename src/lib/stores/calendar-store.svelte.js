/**
 * Unified Calendar Store
 * Single reactive store for managing calendar events with configurable filtering
 * Supports both global and community-specific calendar views
 */

import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, relays, eventStore } from '$lib/store.svelte';
import { getCalendarEventTitle, getCalendarEventStart, getCalendarEventEnd } from 'applesauce-core/helpers/calendar-event';
import { isEventInDateRange, groupEventsByDate } from '../helpers/calendar.js';

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
 * @returns {CalendarStore} Calendar store with reactive state
 */
export function createCalendarStore(filterConfig) {
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

	// Derived state for computed properties - now properly reactive without manual triggers
	let currentMonthEvents = $derived(() => {
		const { currentDate, viewMode } = store.viewState;
		if (viewMode !== 'month') return store.events || [];

		const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
		const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

		return (store.events || []).filter(event =>
			isEventInDateRange(event, startOfMonth, endOfMonth)
		);
	});

	let currentWeekEvents = $derived(() => {
		const { currentDate, viewMode } = store.viewState;
		if (viewMode !== 'week') return store.events || [];

		const startOfWeek = new Date(currentDate);
		startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
		const endOfWeek = new Date(startOfWeek);
		endOfWeek.setDate(startOfWeek.getDate() + 6);

		return (store.events || []).filter(event =>
			isEventInDateRange(event, startOfWeek, endOfWeek)
		);
	});

	let currentDayEvents = $derived(() => {
		const { currentDate, viewMode } = store.viewState;
		if (viewMode !== 'day') return store.events || [];

		const startOfDay = new Date(currentDate);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(currentDate);
		endOfDay.setHours(23, 59, 59, 999);

		return (store.events || []).filter(event =>
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
					const exists = store.events.some(e => e.id === event.id);
					if (!exists) {
						console.log('📅 Calendar Store: Adding new event:', event.title);
						store.events = [...store.events, event];
						console.log('📅 Calendar Store: Events count now:', store.events.length);
					}
				}
				store.loading = false;
				store.error = null;
			});
	}

	// Initialize loader on creation
	initializeLoader();

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
 * @returns {CalendarStore} Global calendar store instance
 */
export function useGlobalCalendarEvents() {
	if (!globalCalendarStore) {
		globalCalendarStore = createCalendarStore({
			kinds: [31922, 31923],
			limit: 250
		});
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
