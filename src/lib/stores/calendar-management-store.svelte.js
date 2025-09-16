/**
 * Calendar Management Store
 * Manages user calendars (NIP-52 kind 31924) with reactive state
 */

import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, relays, eventStore } from '$lib/store.svelte';
import { getCalendarEventTitle } from 'applesauce-core/helpers/calendar-event';
import { appConfig } from '../config.js';
import { EventFactory } from 'applesauce-factory';
import { manager } from '../accounts.svelte.js';

/**
 * @typedef {Object} Calendar
 * @property {string} id - Event ID
 * @property {string} pubkey - Calendar owner pubkey
 * @property {number} kind - Event kind (31924)
 * @property {string} title - Calendar title
 * @property {string} description - Calendar description
 * @property {string} dTag - Unique identifier (d-tag)
 * @property {string[]} eventReferences - Array of event references (a-tags)
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} CalendarManagementStore
 * @property {Calendar[]} calendars - Array of user's calendars
 * @property {boolean} loading - Loading state
 * @property {string | null} error - Error message
 * @property {() => Promise<void>} refresh - Refresh calendars
 * @property {(title: string, description?: string) => Promise<Calendar | null>} createCalendar - Create new calendar
 * @property {(calendarId: string, event: any) => Promise<boolean>} addEventToCalendar - Add event to calendar
 * @property {(calendarId: string, event: any) => Promise<boolean>} removeEventFromCalendar - Remove event from calendar
 * @property {() => void} destroy - Cleanup subscriptions
 */

/**
 * Create a calendar management store for a specific user
 * @param {string} userPubkey - User's public key
 * @returns {CalendarManagementStore} Calendar management store
 */
export function createCalendarManagementStore(userPubkey) {
	// Single reactive object to maintain proper reactivity
	let store = $state({
		calendars: /** @type {Calendar[]} */ ([]),
		loading: false,
		error: /** @type {string | null} */ (null)
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

		// Create timeline loader with filter for user's calendars (kind 31924)
		timelineLoader = createTimelineLoader(
			pool,
			relays,
			{
				kinds: [31924],
				authors: [userPubkey],
				limit: 100
			},
			{ eventStore }
		);

		subscription = timelineLoader()
			.pipe(
				map(/** @param {any} event */ event => convertNDKEventToCalendar(event)),
				catchError(/** @param {any} error */ error => {
					console.error('Error loading calendar:', error);
					store.error = error.message || 'Failed to load calendars';
					return of(null);
				})
			)
			.subscribe(/** @param {Calendar | null} calendar */ calendar => {
				if (calendar) {
					// Check if calendar already exists to avoid duplicates
					const exists = store.calendars.some(c => c.id === calendar.id);
					if (!exists) {
						console.log('📅 Calendar Management: Adding calendar:', calendar.title);
						store.calendars = [...store.calendars, calendar];
						console.log('📅 Calendar Management: Calendar count now:', store.calendars.length);
					}
				}
				store.loading = false;
				store.error = null;
			});
	}

	// Initialize loader on creation
	initializeLoader();

	/**
	 * Refresh calendars from the timeline
	 */
	async function refresh() {
		store.loading = true;
		store.error = null;
		store.calendars = []; // Clear existing calendars
		initializeLoader(); // Reinitialize loader
	}

	/**
	 * Create a new calendar
	 * @param {string} title - Calendar title
	 * @param {string} [description=''] - Calendar description
	 * @returns {Promise<Calendar | null>} Created calendar or null on failure
	 */
	async function createCalendar(title, description = '') {
		try {
			// Generate unique d-tag
			const dTag = `calendar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

			// Create the calendar event following NIP-52
			const calendarEvent = {
				kind: 31924,
				content: description,
				tags: [
					['d', dTag],
					['title', title]
				],
				created_at: Math.floor(Date.now() / 1000)
			};

			// Publish the event (this would need to be implemented based on your publishing system)
			// For now, we'll simulate the creation and add it to the store
			const newCalendar = {
				id: `temp-${Date.now()}`, // Temporary ID until real event is published
				pubkey: userPubkey,
				kind: 31924,
				title,
				description,
				dTag,
				eventReferences: [],
				createdAt: calendarEvent.created_at
			};

			// Add to store immediately for optimistic updates
			store.calendars = [...store.calendars, newCalendar];

			console.log('📅 Calendar Management: Created new calendar:', title);
			return newCalendar;

		} catch (error) {
			console.error('Error creating calendar:', error);
			store.error = error instanceof Error ? error.message : 'Failed to create calendar';
			return null;
		}
	}

	/**
	 * Add an event to a calendar following NIP-52 specification
	 * @param {string} calendarId - Calendar ID to add the event to
	 * @param {any} event - Calendar event to add (must have id, pubkey, kind, and dTag)
	 * @returns {Promise<boolean>} Success status
	 */
	async function addEventToCalendar(calendarId, event) {
		try {
			// Find the calendar to update
			const calendar = store.calendars.find(c => c.id === calendarId);
			if (!calendar) {
				throw new Error('Calendar not found');
			}

			// Validate event has required properties
			if (!event.id || !event.pubkey || !event.kind || !event.dTag) {
				throw new Error('Invalid event data: missing required properties');
			}

			// Check if event is already in the calendar
			const eventReference = `${event.kind}:${event.pubkey}:${event.dTag}`;
			if (calendar.eventReferences.includes(eventReference)) {
				console.log('📅 Calendar Management: Event already in calendar');
				return true; // Already added
			}

			// Create new calendar event with updated event references
			const updatedEventReferences = [...calendar.eventReferences, eventReference];

			// Build tags for the updated calendar
			const tags = [
				['d', calendar.dTag],
				['title', calendar.title]
			];

			// Add all existing event references as 'a' tags
			updatedEventReferences.forEach(ref => {
				tags.push(['a', ref]);
			});

			// Get current account for signing
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to add events to calendars.');
			}

			// Create the updated calendar event using EventFactory
			const eventFactory = new EventFactory();
			const eventTemplate = await eventFactory.build({
				kind: 31924,
				content: calendar.description,
				tags: tags
			});

			// Sign the event
			const signedEvent = await currentAccount.signEvent(eventTemplate);

			// Publish to multiple relays
			const responses = await pool.publish(relays, signedEvent);

			// Check if at least one relay accepted the event
			const hasSuccess = responses.some(response => response.ok);

			if (hasSuccess) {
				// Add to event store for local caching
				eventStore.add(signedEvent);

				// Update the calendar in the store with the new event ID and references
				const updatedCalendar = {
					...calendar,
					id: signedEvent.id,
					eventReferences: updatedEventReferences,
					createdAt: signedEvent.created_at
				};

				// Update the calendar in the store
				store.calendars = store.calendars.map(c =>
					c.id === calendarId ? updatedCalendar : c
				);

				// Trigger refresh of calendar events display
				if (calendarEventsRefreshCallback) {
					console.log('📅 Calendar Management: Triggering calendar events refresh');
					calendarEventsRefreshCallback();
				}

				console.log('📅 Calendar Management: Successfully added event to calendar:', calendar.title);
				console.log('📅 Calendar Management: Published to relays:', responses.filter(r => r.ok).map(r => r.from));
				return true;
			} else {
				// Log failed responses for debugging
				const failedResponses = responses.filter(r => !r.ok);
				console.error('📅 Calendar Management: Failed to publish to any relay:', failedResponses);
				throw new Error('Failed to publish calendar update to any relay');
			}

		} catch (error) {
			console.error('Error adding event to calendar:', error);
			store.error = error instanceof Error ? error.message : 'Failed to add event to calendar';
			return false;
		}
	}

	/**
	 * Remove an event from a calendar following NIP-52 specification
	 * @param {string} calendarId - Calendar ID to remove the event from
	 * @param {any} event - Calendar event to remove (must have id, pubkey, kind, and dTag)
	 * @returns {Promise<boolean>} Success status
	 */
	async function removeEventFromCalendar(calendarId, event) {
		try {
			// Find the calendar to update
			const calendar = store.calendars.find(c => c.id === calendarId);
			if (!calendar) {
				throw new Error('Calendar not found');
			}

			// Validate event has required properties
			if (!event.id || !event.pubkey || !event.kind || !event.dTag) {
				throw new Error('Invalid event data: missing required properties');
			}

			// Check if event is in the calendar
			const eventReference = `${event.kind}:${event.pubkey}:${event.dTag}`;
			if (!calendar.eventReferences.includes(eventReference)) {
				console.log('📅 Calendar Management: Event not in calendar');
				return true; // Already removed
			}

			// Create new calendar event with updated event references (remove the event)
			const updatedEventReferences = calendar.eventReferences.filter(ref => ref !== eventReference);

			// Build tags for the updated calendar
			const tags = [
				['d', calendar.dTag],
				['title', calendar.title]
			];

			// Add all remaining event references as 'a' tags
			updatedEventReferences.forEach(ref => {
				tags.push(['a', ref]);
			});

			// Get current account for signing
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to remove events from calendars.');
			}

			// Create the updated calendar event using EventFactory
			const eventFactory = new EventFactory();
			const eventTemplate = await eventFactory.build({
				kind: 31924,
				content: calendar.description,
				tags: tags
			});

			// Sign the event
			const signedEvent = await currentAccount.signEvent(eventTemplate);

			// Publish to multiple relays
			const responses = await pool.publish(relays, signedEvent);

			// Check if at least one relay accepted the event
			const hasSuccess = responses.some(response => response.ok);

			if (hasSuccess) {
				// Add to event store for local caching
				eventStore.add(signedEvent);

				// Update the calendar in the store with the new event ID and references
				const updatedCalendar = {
					...calendar,
					id: signedEvent.id,
					eventReferences: updatedEventReferences,
					createdAt: signedEvent.created_at
				};

				// Update the calendar in the store
				store.calendars = store.calendars.map(c =>
					c.id === calendarId ? updatedCalendar : c
				);

				// Trigger refresh of calendar events display
				if (calendarEventsRefreshCallback) {
					console.log('📅 Calendar Management: Triggering calendar events refresh');
					calendarEventsRefreshCallback();
				}

				console.log('📅 Calendar Management: Successfully removed event from calendar:', calendar.title);
				console.log('📅 Calendar Management: Published to relays:', responses.filter(r => r.ok).map(r => r.from));
				return true;
			} else {
				// Log failed responses for debugging
				const failedResponses = responses.filter(r => !r.ok);
				console.error('📅 Calendar Management: Failed to publish to any relay:', failedResponses);
				throw new Error('Failed to publish calendar update to any relay');
			}

		} catch (error) {
			console.error('Error removing event from calendar:', error);
			store.error = error instanceof Error ? error.message : 'Failed to remove event from calendar';
			return false;
		}
	}

	// Cleanup subscription
	function destroy() {
		if (subscription) {
			subscription.unsubscribe();
		}
	}

	// Return reactive store object
	return {
		// Reactive state (directly accessible)
		get calendars() { return store.calendars; },
		get loading() { return store.loading; },
		get error() { return store.error; },

		// Methods
		refresh,
		createCalendar,
		addEventToCalendar,
		removeEventFromCalendar,
		destroy
	};
}

/**
 * Convert NDK event to Calendar object
 * @param {any} ndkEvent - NDK event
 * @returns {Calendar} Calendar object
 */
function convertNDKEventToCalendar(ndkEvent) {
	/** @type {Calendar} */
	const calendar = {
		id: ndkEvent.id || '',
		pubkey: ndkEvent.pubkey || '',
		kind: ndkEvent.kind,
		title: getCalendarEventTitle(ndkEvent) || 'Untitled Calendar',
		description: ndkEvent.content || '',
		dTag: '',
		eventReferences: [],
		createdAt: ndkEvent.created_at || 0
	};

	// Extract data from tags
	if (ndkEvent.tags) {
		ndkEvent.tags.forEach(/** @param {any[]} tag */ tag => {
			switch (tag[0]) {
				case 'd':
					calendar.dTag = tag[1] || '';
					break;
				case 'a':
					if (tag[1]) calendar.eventReferences.push(tag[1]);
					break;
			}
		});
	}

	return calendar;
}

/**
 * Global calendar management store instances
 * @type {Map<string, CalendarManagementStore>}
 */
const calendarManagementStores = new Map();

/**
 * Calendar events store refresh callback
 * This allows calendar management to notify calendar events stores of updates
 * @type {(() => void) | null}
 */
let calendarEventsRefreshCallback = null;

/**
 * Register a callback to refresh calendar events when calendars are updated
 * @param {() => void} callback
 */
export function registerCalendarEventsRefreshCallback(callback) {
	calendarEventsRefreshCallback = callback;
}

/**
 * Get or create a calendar management store for a user
 * @param {string} userPubkey - User's public key
 * @returns {CalendarManagementStore} Calendar management store instance
 */
export function useCalendarManagement(userPubkey) {
	if (!calendarManagementStores.has(userPubkey)) {
		calendarManagementStores.set(userPubkey, createCalendarManagementStore(userPubkey));
	}
	return /** @type {CalendarManagementStore} */ (calendarManagementStores.get(userPubkey));
}

/**
 * Cleanup all calendar management stores
 */
export function cleanupCalendarManagementStores() {
	calendarManagementStores.forEach(store => {
		if (store && typeof store.destroy === 'function') {
			store.destroy();
		}
	});
	calendarManagementStores.clear();
}
