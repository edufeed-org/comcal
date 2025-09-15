/**
 * Calendar Selection Store
 * Manages selected calendar state with reactive updates
 * Follows established store patterns with observables and reactive state
 */

import { Subject } from 'rxjs';

/**
 * @typedef {Object} CalendarSelectionState
 * @property {string} selectedCalendarId - Currently selected calendar ID (empty string for global)
 * @property {boolean} isGlobalMode - Whether global calendar is selected
 */

/**
 * Calendar Selection Store Class
 */
class CalendarSelectionStore {
	constructor() {
		// Reactive state using Svelte 5 runes
		this.state = $state({
			selectedCalendarId: '',
			isGlobalMode: true
		});

		// Observable streams for reactive updates
		this.selection$ = new Subject();
		this.state$ = new Subject();

		// Initialize with default state
		this.selection$.next(this.state.selectedCalendarId);
		this.state$.next(this.state);
	}

	/**
	 * Get current selected calendar ID
	 * @returns {string}
	 */
	get selectedCalendarId() {
		return this.state.selectedCalendarId;
	}

	/**
	 * Get whether global mode is active
	 * @returns {boolean}
	 */
	get isGlobalMode() {
		return this.state.isGlobalMode;
	}

	/**
	 * Select a calendar by ID
	 * @param {string} calendarId - Calendar ID to select (empty string for global)
	 */
	selectCalendar(calendarId) {
		console.log('📅 Calendar Selection: Selecting calendar:', calendarId);

		this.state.selectedCalendarId = calendarId;
		this.state.isGlobalMode = calendarId === '';

		// Emit changes to subscribers
		this.selection$.next(calendarId);
		this.state$.next(this.state);

		console.log('✅ Calendar Selection: Updated state:', {
			selectedCalendarId: calendarId,
			isGlobalMode: this.state.isGlobalMode
		});
	}

	/**
	 * Select global calendar (all events)
	 */
	selectGlobalCalendar() {
		this.selectCalendar('');
	}

	/**
	 * Clear calendar selection
	 */
	clearSelection() {
		this.selectCalendar('');
	}

	/**
	 * Check if a specific calendar is selected
	 * @param {string} calendarId
	 * @returns {boolean}
	 */
	isCalendarSelected(calendarId) {
		return this.state.selectedCalendarId === calendarId;
	}

	/**
	 * Get observable for selection changes
	 * @returns {import('rxjs').Observable<string>}
	 */
	getSelectionObservable() {
		return this.selection$.asObservable();
	}

	/**
	 * Get observable for state changes
	 * @returns {import('rxjs').Observable<CalendarSelectionState>}
	 */
	getStateObservable() {
		return this.state$.asObservable();
	}

	/**
	 * Cleanup resources
	 */
	destroy() {
		this.selection$.complete();
		this.state$.complete();
	}
}

/**
 * Global calendar selection store instance
 * @type {CalendarSelectionStore | null}
 */
let calendarSelectionStore = null;

/**
 * Get or create the calendar selection store
 * @returns {CalendarSelectionStore}
 */
export function useCalendarSelection() {
	if (!calendarSelectionStore) {
		calendarSelectionStore = new CalendarSelectionStore();
	}
	return calendarSelectionStore;
}

/**
 * Cleanup calendar selection store
 */
export function cleanupCalendarSelectionStore() {
	if (calendarSelectionStore) {
		calendarSelectionStore.destroy();
		calendarSelectionStore = null;
	}
}
