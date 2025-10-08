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
	selectedRelays = $state(/** @type {string[]} */ ([]));
	selectedTags = $state(/** @type {string[]} */ ([]));
	searchQuery = $state('');
	followLists = $state(/** @type {Array<{id: string, name: string, type: 'nip02' | 'nip51', description?: string, pubkeys: string[], count: number}>} */ ([]));
	selectedFollowListIds = $state(/** @type {string[]} */ ([]));
	
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
	 * Set selected relays for filtering
	 * @param {string[]} relays - Array of relay URLs
	 */
	setSelectedRelays(relays) {
		console.log('📅 CalendarEventsStore: Setting selected relays:', relays);
		this.selectedRelays = relays;
	}
	
	/**
	 * Clear selected relays (revert to default)
	 */
	clearSelectedRelays() {
		console.log('📅 CalendarEventsStore: Clearing selected relays');
		this.selectedRelays = [];
	}
	
	/**
	 * Add a relay to the selected relays list
	 * @param {string} relay - Relay URL to add
	 */
	addRelay(relay) {
		if (!this.selectedRelays.includes(relay)) {
			console.log('📅 CalendarEventsStore: Adding relay:', relay);
			this.selectedRelays = [...this.selectedRelays, relay];
		}
	}
	
	/**
	 * Remove a relay from the selected relays list
	 * @param {string} relay - Relay URL to remove
	 */
	removeRelay(relay) {
		console.log('📅 CalendarEventsStore: Removing relay:', relay);
		this.selectedRelays = this.selectedRelays.filter(r => r !== relay);
	}
	
	/**
	 * Set selected tags for filtering
	 * @param {string[]} tags - Array of tag strings
	 */
	setSelectedTags(tags) {
		console.log('📅 CalendarEventsStore: Setting selected tags:', tags);
		this.selectedTags = tags;
	}
	
	/**
	 * Clear selected tags (revert to showing all)
	 */
	clearSelectedTags() {
		console.log('📅 CalendarEventsStore: Clearing selected tags');
		this.selectedTags = [];
	}
	
	/**
	 * Add a tag to the selected tags list
	 * @param {string} tag - Tag to add
	 */
	addTag(tag) {
		if (!this.selectedTags.includes(tag)) {
			console.log('📅 CalendarEventsStore: Adding tag:', tag);
			this.selectedTags = [...this.selectedTags, tag];
		}
	}
	
	/**
	 * Remove a tag from the selected tags list
	 * @param {string} tag - Tag to remove
	 */
	removeTag(tag) {
		console.log('📅 CalendarEventsStore: Removing tag:', tag);
		this.selectedTags = this.selectedTags.filter(t => t !== tag);
	}
	
	/**
	 * Set search query for text filtering
	 * @param {string} query - Search query string
	 */
	setSearchQuery(query) {
		console.log('📅 CalendarEventsStore: Setting search query:', query);
		this.searchQuery = query;
	}
	
	/**
	 * Clear search query
	 */
	clearSearchQuery() {
		console.log('📅 CalendarEventsStore: Clearing search query');
		this.searchQuery = '';
	}
	
	/**
	 * Set follow lists
	 * @param {Array<{id: string, name: string, type: 'nip02' | 'nip51', description?: string, pubkeys: string[], count: number}>} lists - Array of follow lists
	 */
	setFollowLists(lists) {
		console.log('👥 CalendarEventsStore: Setting follow lists:', lists.length);
		this.followLists = lists;
	}
	
	/**
	 * Clear follow lists
	 */
	clearFollowLists() {
		console.log('👥 CalendarEventsStore: Clearing follow lists');
		this.followLists = [];
	}
	
	/**
	 * Set selected follow list IDs for filtering
	 * @param {string[]} listIds - Array of follow list IDs
	 */
	setSelectedFollowListIds(listIds) {
		console.log('👥 CalendarEventsStore: Setting selected follow list IDs:', listIds);
		this.selectedFollowListIds = listIds;
	}
	
	/**
	 * Clear selected follow list IDs (revert to showing all)
	 */
	clearSelectedFollowListIds() {
		console.log('👥 CalendarEventsStore: Clearing selected follow list IDs');
		this.selectedFollowListIds = [];
	}
	
	/**
	 * Get unique author pubkeys from selected follow lists
	 * @returns {string[]} Array of unique author pubkeys
	 */
	getSelectedAuthors() {
		if (this.selectedFollowListIds.length === 0) {
			return [];
		}
		
		const selectedLists = this.followLists.filter(list => 
			this.selectedFollowListIds.includes(list.id)
		);
		
		// Collect all pubkeys and deduplicate
		const pubkeysSet = new Set();
		selectedLists.forEach(list => {
			list.pubkeys.forEach(pubkey => pubkeysSet.add(pubkey));
		});
		
		const uniquePubkeys = Array.from(pubkeysSet);
		console.log(
			`👥 CalendarEventsStore: Got ${uniquePubkeys.length} unique authors from ${selectedLists.length} follow lists`
		);
		
		return uniquePubkeys;
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
		this.selectedRelays = [];
		this.selectedTags = [];
		this.searchQuery = '';
		this.followLists = [];
		this.selectedFollowListIds = [];
	}
	
}

// Export singleton instance
export const calendarStore = new CalendarStore();

// Export for debugging in development
if (typeof window !== 'undefined') {
	// @ts-ignore
	window.calendarEventsStore = calendarStore;
}
