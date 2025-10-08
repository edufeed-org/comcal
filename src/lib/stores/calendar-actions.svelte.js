/**
 * Calendar Actions Store
 * Actions for creating and managing calendar events with applesauce integration
 */

import { EventFactory } from 'applesauce-factory';
import { pool, relays } from '$lib/store.svelte';
import { manager } from '$lib/accounts.svelte';
import { validateEventForm, convertFormDataToEvent, createEventTargetingTags } from '../helpers/calendar.js';
import { calendarStore } from './calendar-events.svelte.js';
import { getCalendarEventMetadata } from '../helpers/eventUtils.js';

/**
 * @typedef {import('../types/calendar.js').CalendarEvent} CalendarEvent
 * @typedef {import('../types/calendar.js').EventFormData} EventFormData
 * @typedef {import('../types/calendar.js').CalendarActions} CalendarActions
 */

/**
 * Create calendar actions for a specific community
 * @param {string} communityPubkey - Community public key
 * @returns {CalendarActions} Calendar actions object
 */
export function createCalendarActions(communityPubkey) {
	return {
		/**
		 * Create a new calendar event
		 * @param {EventFormData} formData - Event form data
		 * @param {string} targetCommunityPubkey - Target community public key
		 * @returns {Promise<any>}
		 */
		async createEvent(formData, targetCommunityPubkey) {
			// Validate form data
			const validationErrors = validateEventForm(formData);
			if (validationErrors.length > 0) {
				throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
			}

			// Get current account from manager
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to create events.');
			}

			// Convert form data to event object
			const eventData = convertFormDataToEvent(formData, targetCommunityPubkey);

			try {
				// Generate unique d-tag for the calendar event
				const dTag = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
				
				// Create the calendar event using EventFactory
				const eventFactory = new EventFactory();
				
				// Build event template with tags
				const tags = [];
				
				// Add d-tag for addressable/replaceable event
				tags.push(['d', dTag]);
				
				// Add calendar-specific tags
				tags.push(['title', eventData.title]);
				if (eventData.start) {
					// eventData.start is already a UNIX timestamp (number) from convertFormDataToEvent
					tags.push(['start', eventData.start.toString()]);
				}

				if (eventData.end) {
					// eventData.end is already a UNIX timestamp (number) from convertFormDataToEvent
					tags.push(['end', eventData.end.toString()]);
				}

				// Add timezone tags for time-based events
				if (eventData.kind === 31923) {
					if (eventData.startTimezone) {
						tags.push(['start_tz', eventData.startTimezone]);
					}
					if (eventData.endTimezone) {
						tags.push(['end_tz', eventData.endTimezone]);
					}
				}

				// Add optional properties
				if (eventData.image) {
					tags.push(['image', eventData.image]);
				}

				// Add location
				if (eventData.location) {
					tags.push(['location', eventData.location]);
				}

				// Add hashtags
				if (eventData.hashtags) {
					eventData.hashtags.forEach(hashtag => {
						if (hashtag) tags.push(['t', hashtag]);
					});
				}

				// Add references
				if (eventData.references) {
					eventData.references.forEach(reference => {
						if (reference) tags.push(['e', reference]);
					});
				}

				// Add geohash if present
				if (eventData.geohash) {
					tags.push(['g', eventData.geohash]);
				}

				// Build and sign the calendar event
				const eventTemplate = await eventFactory.build({
					kind: eventData.kind || 31922,
					content: eventData.summary || '',
					tags: tags
				});

				const calendarEvent = await currentAccount.signEvent(eventTemplate);
				await pool.publish(relays, calendarEvent);

				// Add dTag property to the event object for calendar management
				const eventWithDTag = {
					...calendarEvent,
					dTag: dTag
				};

				// Transform the raw Nostr event to CalendarEvent format for immediate UI display
				const transformedEvent = getCalendarEventMetadata(eventWithDTag);
				
				// Add the transformed event to the calendar store for immediate UI update
				calendarStore.setEvents([...calendarStore.events, transformedEvent]);
				console.log('📅 Calendar Actions: Added transformed event to store');

				// Return the created event so caller can handle sharing/adding to calendars
				return eventWithDTag;

			} catch (error) {
				console.error('Error creating calendar event:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create calendar event: ${errorMessage}`);
			}
		},

		/**
		 * Update an existing calendar event
		 * @param {string} eventId - Event ID to update
		 * @param {Partial<CalendarEvent>} updates - Event updates
		 * @returns {Promise<void>}
		 */
		async updateEvent(eventId, updates) {
			// Get current account
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to update events.');
			}

			try {
				// Note: In Nostr, events are immutable, so "updating" means creating a new event
				// that replaces the old one. For calendar events, this would involve creating
				// a new event with the same 'd' tag (for replaceable events) or using deletion.
				
				// For now, we'll throw an error as event updating needs more complex logic
				throw new Error('Event updating not yet implemented. Events are immutable in Nostr.');
				
			} catch (error) {
				console.error('Error updating calendar event:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update calendar event: ${errorMessage}`);
			}
		},

		/**
		 * Delete a calendar event
		 * @param {string} eventId - Event ID to delete
		 * @returns {Promise<void>}
		 */
		async deleteEvent(eventId) {
			// Get current account
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to delete events.');
			}

			try {
				// Create a deletion event (kind 5)
				const eventFactory = new EventFactory();
				
				const eventTemplate = await eventFactory.build({
					kind: 5,
					content: '',
					tags: [['e', eventId]]
				});

				// Sign and publish the deletion event
				const deletionEvent = await currentAccount.signEvent(eventTemplate);
				await pool.publish(relays, deletionEvent);

			} catch (error) {
				console.error('Error deleting calendar event:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete calendar event: ${errorMessage}`);
			}
		},

		/**
		 * Create a targeted publication event to associate calendar event with community
		 * @param {string} eventId - Calendar event ID
		 * @param {string} targetCommunityPubkey - Target community public key
		 * @returns {Promise<void>}
		 */
		async createTargetedPublication(eventId, targetCommunityPubkey) {
			// Get current account
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to create targeted publications.');
			}

			try {
				// Create targeting event using Communikey spec (kind 30222)
				const eventFactory = new EventFactory();
				
				// Build targeting tags
				const targetingTags = createEventTargetingTags(targetCommunityPubkey);
				targetingTags.push(['e', eventId]);
				targetingTags.push(['d', eventId]);

				const eventTemplate = await eventFactory.build({
					kind: 30222,
					content: '',
					tags: targetingTags
				});

				// Sign and publish the targeting event
				const targetingEvent = await currentAccount.signEvent(eventTemplate);
				await pool.publish(relays, targetingEvent);

			} catch (error) {
				console.error('Error creating targeted publication:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create targeted publication: ${errorMessage}`);
			}
		},

		/**
		 * Create a new calendar
		 * @param {string} title - Calendar title
		 * @param {string} [description=''] - Calendar description
		 * @returns {Promise<string>} Created calendar event ID
		 */
		async createCalendar(title, description = '') {
			// Validate inputs
			if (!title.trim()) {
				throw new Error('Calendar title is required');
			}

			// Get current account from manager
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to create calendars.');
			}

			try {
				// Generate unique d-tag for the calendar
				const dTag = `calendar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

				// Create the calendar event using EventFactory (NIP-52 kind 31924)
				const eventFactory = new EventFactory();

				// Build calendar event template
				const eventTemplate = await eventFactory.build({
					kind: 31924,
					content: description,
					tags: [
						['d', dTag],
						['title', title.trim()]
					]
				});

				// Sign and publish the calendar event
				const calendarEvent = await currentAccount.signEvent(eventTemplate);
				await pool.publish(relays, calendarEvent);

				console.log('📅 Calendar created successfully:', calendarEvent.id);
				return calendarEvent.id;

			} catch (error) {
				console.error('Error creating calendar:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create calendar: ${errorMessage}`);
			}
		},

		/**
		 * Load events for a community (delegated to calendar events store)
		 * @param {string} targetCommunityPubkey - Community public key
		 * @returns {Promise<CalendarEvent[]>}
		 */
		async loadEvents(targetCommunityPubkey) {
			// This method is primarily handled by the calendar events store
			// We return an empty array here as the actual loading is reactive
			return [];
		}
	};
}

/**
 * Global calendar actions store instances
 * @type {Map<string, CalendarActions>}
 */
const calendarActionsStores = new Map();

/**
 * Get or create calendar actions for a community
 * @param {string} communityPubkey - Community public key
 * @returns {CalendarActions} Calendar actions instance
 */
export function useCalendarActions(communityPubkey) {
	if (!calendarActionsStores.has(communityPubkey)) {
		calendarActionsStores.set(communityPubkey, createCalendarActions(communityPubkey));
	}
	return /** @type {CalendarActions} */ (calendarActionsStores.get(communityPubkey));
}

/**
 * Cleanup all calendar actions stores
 */
export function cleanupCalendarActionsStores() {
	calendarActionsStores.clear();
}
