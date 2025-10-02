/**
 * Calendar Events Store - Svelte 5 Runes + RxJS Observables
 * Centralized reactive state management for calendar events
 * Provides better reactivity and component communication
 */

import { BehaviorSubject } from 'rxjs';
import { groupEventsByDate } from '$lib/helpers/calendar.js';


export let loading = $state({
	loading: false
})

export let cEvents = $state({
	events: []
})

/**
 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
 */

class CalendarStore {
	// RxJS observable for selected calendar (single source of truth)
	selectedCalendar$ = new BehaviorSubject(/** @type {any} */ (null));
	
	// Reactive state using Svelte 5 runes
	events = $state(/** @type {CalendarEvent[]} */ ([]));
	loading = $state(false);
	error = $state(/** @type {string | null} */ (null));
	missingEvents = $state(/** @type {Array<{addressRef: string, reason?: string}>} */ ([]));
	
	// Derived reactive state
	groupedEvents = $derived(groupEventsByDate(this.events));
	eventCount = $derived(this.events.length);
	hasEvents = $derived(this.events.length > 0);
	hasMissingEvents = $derived(this.missingEvents.length > 0);
	missingEventsCount = $derived(this.missingEvents.length);
	
	// Getters for current observable values (for convenience)
	get selectedCalendar() {
		return this.selectedCalendar$.value;
	}
	
	// Derived getter - ID is extracted from calendar object
	get selectedCalendarId() {
		return this.selectedCalendar$.value?.id || '';
	}
	
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
	 * @param {any} calendar - Calendar object with id property
	 */
	setSelectedCalendar(calendar) {
		console.log('📅 CalendarEventsStore: Setting selected calendar:', calendar?.id, calendar?.title);
		this.selectedCalendar$.next(calendar);
	}
	
	/**
	 * Reset all state
	 */
	reset() {
		console.log('📅 CalendarEventsStore: Resetting all state');
		this.events = [];
		this.loading = false;
		this.error = null;
		this.selectedCalendar$.next(null);
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
