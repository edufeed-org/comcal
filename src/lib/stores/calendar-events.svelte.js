/**
 * Calendar Events Store - Svelte 5 Runes
 * Centralized reactive state management for calendar events
 * Provides better reactivity and component communication
 */

import { groupEventsByDate } from '$lib/helpers/calendar.js';

/**
 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
 */

class CalendarStore {
	// Reactive state using Svelte 5 runes
	events = $state(/** @type {CalendarEvent[]} */ ([]));
	loading = $state(false);
	error = $state(/** @type {string | null} */ (null));
	selectedCalendarId = $state('');
	selectedCalendar = $state(/** @type {any} */ (null));
	missingEvents = $state(/** @type {Array<{addressRef: string, reason?: string}>} */ ([]));
	
	// Derived reactive state
	groupedEvents = $derived(groupEventsByDate(this.events));
	eventCount = $derived(this.events.length);
	hasEvents = $derived(this.events.length > 0);
	hasMissingEvents = $derived(this.missingEvents.length > 0);
	missingEventsCount = $derived(this.missingEvents.length);
	
	// Actions for updating state
	
	/**
	 * Set the events array
	 * @param {CalendarEvent[]} newEvents
	 */
	setEvents(newEvents) {
		console.log('📅 CalendarEventsStore: Setting events:', newEvents.length);
		this.events = newEvents;
	}
	
	/**
	 * Clear all events
	 */
	clearEvents() {
		console.log('📅 CalendarEventsStore: Clearing events');
		this.events = [];
	}
	
	/**
	 * Set loading state
	 * @param {boolean} isLoading
	 */
	setLoading(isLoading) {
		this.loading = isLoading;
	}
	
	/**
	 * Set error state
	 * @param {string | null} errorMessage
	 */
	setError(errorMessage) {
		console.log('📅 CalendarEventsStore: Setting error:', errorMessage);
		this.error = errorMessage;
	}
	
	/**
	 * Set selected calendar
	 * @param {string} calendarId
	 * @param {any} calendar
	 */
	setSelectedCalendar(calendarId, calendar) {
		console.log('📅 CalendarEventsStore: Setting selected calendar:', calendarId, calendar?.title);
		this.selectedCalendarId = calendarId;
		this.selectedCalendar = calendar;
	}
	
	/**
	 * Reset all state
	 */
	reset() {
		console.log('📅 CalendarEventsStore: Resetting all state');
		this.events = [];
		this.loading = false;
		this.error = null;
		this.selectedCalendarId = '';
		this.selectedCalendar = null;
		this.missingEvents = [];
	}
	
	/**
	 * Add a single event (useful for real-time updates)
	 * @param {CalendarEvent} event
	 */
	addEvent(event) {
		console.log('📅 CalendarEventsStore: Adding event:', event.title);
		this.events = [...this.events, event];
	}
	
	/**
	 * Remove an event by ID
	 * @param {string} eventId
	 */
	removeEvent(eventId) {
		console.log('📅 CalendarEventsStore: Removing event:', eventId);
		this.events = this.events.filter(event => event.id !== eventId);
	}
	
	/**
	 * Update an existing event
	 * @param {string} eventId
	 * @param {Partial<CalendarEvent>} updates
	 */
	updateEvent(eventId, updates) {
		console.log('📅 CalendarEventsStore: Updating event:', eventId, updates);
		this.events = this.events.map(event => 
			event.id === eventId ? { ...event, ...updates } : event
		);
	}
	
	/**
	 * Add a missing event reference
	 * @param {string} addressRef - The event reference that failed to load
	 * @param {string} [reason] - Optional reason for failure
	 */
	addMissingEvent(addressRef, reason) {
		console.log('📅 CalendarEventsStore: Adding missing event:', addressRef, reason);
		// Avoid duplicates
		if (!this.missingEvents.find(missing => missing.addressRef === addressRef)) {
			this.missingEvents = [...this.missingEvents, { addressRef, reason }];
		}
	}
	
	/**
	 * Clear missing events
	 */
	clearMissingEvents() {
		console.log('📅 CalendarEventsStore: Clearing missing events');
		this.missingEvents = [];
	}
	
	/**
	 * Clear all events and missing events (for calendar switching)
	 */
	clearAllEvents() {
		console.log('📅 CalendarEventsStore: Clearing all events and missing events');
		this.events = [];
		this.missingEvents = [];
	}
}

// Export singleton instance
export const calendarStore = new CalendarStore();

// Export for debugging in development
if (typeof window !== 'undefined') {
	// @ts-ignore
	window.calendarEventsStore = calendarStore;
}
