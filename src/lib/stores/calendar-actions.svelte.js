/**
 * Calendar Actions Store
 * Actions for creating and managing calendar events with applesauce integration
 */

import { EventFactory } from 'applesauce-factory';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { manager } from '$lib/stores/accounts.svelte';
import { validateEventForm, convertFormDataToEvent, createEventTargetingTags } from '../helpers/calendar.js';
import { calendarStore } from './calendar-events.svelte.js';
import { getCalendarEventMetadata } from '../helpers/eventUtils.js';
import { publishEvent, publishEventOptimistic, buildATagWithHint, buildETagWithHint, buildPTagsWithHints } from '$lib/services/publish-service.js';

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
		 * @param {Object} [communityEvent] - Optional community definition event (kind 10222) for relay routing
		 * @returns {Promise<any>}
		 */
		async createEvent(formData, targetCommunityPubkey, communityEvent = null) {
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
				
				// Add h-tag if event is targeted to a community (Communikey spec)
				if (targetCommunityPubkey) {
					tags.push(['h', targetCommunityPubkey]);
				}
				
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

				// Add references (web links, documents, etc.)
				if (eventData.references) {
					eventData.references.forEach(reference => {
						if (reference) tags.push(['r', reference]);
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

			// Publish optimistically in background (returns immediately)
			publishEventOptimistic(calendarEvent, [], { communityEvent });

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
		 * @param {EventFormData} formData - Event form data
		 * @param {any} existingEvent - Existing raw Nostr event to update
		 * @param {Object} [communityEvent] - Optional community definition event (kind 10222) for relay routing
		 * @returns {Promise<any>}
		 */
		async updateEvent(formData, existingEvent, communityEvent = null) {
			// Validate form data
			const validationErrors = validateEventForm(formData);
			if (validationErrors.length > 0) {
				throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
			}

			// Get current account
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to update events.');
			}

			// Extract the original d-tag from the existing event
			const dTag = existingEvent.tags.find((/** @type {string[]} */ t) => t[0] === 'd')?.[1];
			if (!dTag) {
				throw new Error('Cannot update event: missing d-tag. Event may not be replaceable.');
			}

			// Extract the original h-tag (community targeting) if present
			const hTag = existingEvent.tags.find((/** @type {string[]} */ t) => t[0] === 'h')?.[1];

			// Verify the user owns this event
			if (existingEvent.pubkey !== currentAccount.pubkey) {
				throw new Error('Cannot update event: you do not own this event.');
			}

			try {
				// Convert form data to event object
				const eventData = convertFormDataToEvent(formData, existingEvent.pubkey);

				// Create the calendar event using EventFactory with the SAME d-tag
				const eventFactory = new EventFactory();
				
				// Build event template with tags
				const tags = [];
				
				// CRITICAL: Use the original d-tag for addressable event replacement
				tags.push(['d', dTag]);
				
				// Preserve h-tag if event was originally targeted to a community (Communikey spec)
				if (hTag) {
					tags.push(['h', hTag]);
				}
				
				// Add calendar-specific tags
				tags.push(['title', eventData.title]);
				if (eventData.start) {
					tags.push(['start', eventData.start.toString()]);
				}

				if (eventData.end) {
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

				// Add references (web links, documents, etc.)
				if (eventData.references) {
					eventData.references.forEach(reference => {
						if (reference) tags.push(['r', reference]);
					});
				}

				// Add geohash if present
				if (eventData.geohash) {
					tags.push(['g', eventData.geohash]);
				}

				// Build and sign the updated calendar event
				const eventTemplate = await eventFactory.build({
					kind: eventData.kind || existingEvent.kind,
					content: eventData.summary || '',
					tags: tags
				});

			const updatedEvent = await currentAccount.signEvent(eventTemplate);

			// Add dTag property to the event object
				const eventWithDTag = {
					...updatedEvent,
					dTag: dTag
				};

				// Transform the raw Nostr event to CalendarEvent format for immediate UI display
				const transformedEvent = getCalendarEventMetadata(eventWithDTag);

				// Update the event in the calendar store immediately
				const currentEvents = calendarStore.events;
				const updatedEvents = currentEvents.map(evt =>
					evt.id === existingEvent.id ? transformedEvent : evt
				);
				calendarStore.setEvents(updatedEvents);
				console.log('📅 Calendar Actions: Updated event in store');

			// Publish optimistically in background
			publishEventOptimistic(updatedEvent, [], { communityEvent });

				// Return the updated event
				return eventWithDTag;

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
				// Create a deletion event (kind 5) with relay hint for discoverability
				const eventFactory = new EventFactory();
				const eTagWithHint = await buildETagWithHint(eventId, currentAccount.pubkey);

				const eventTemplate = await eventFactory.build({
					kind: 5,
					content: '',
					tags: [eTagWithHint]
				});

			// Sign and publish the deletion event
			const deletionEvent = await currentAccount.signEvent(eventTemplate);
			await publishEvent(deletionEvent, []);

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
		 * @param {Object} [communityEvent] - Optional community definition event (kind 10222) for relay routing
		 * @returns {Promise<void>}
		 */
		async createTargetedPublication(eventId, targetCommunityPubkey, communityEvent = null) {
			// Get current account
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to create targeted publications.');
			}

			try {
				// Create targeting event using Communikey spec (kind 30222)
				const eventFactory = new EventFactory();

				// Build targeting tags with relay hints for discoverability
				const targetingTags = createEventTargetingTags(targetCommunityPubkey);
				const eTagWithHint = await buildETagWithHint(eventId, currentAccount.pubkey);
				targetingTags.push(eTagWithHint);
				targetingTags.push(['d', eventId]);

				const eventTemplate = await eventFactory.build({
					kind: 30222,
					content: '',
					tags: targetingTags
				});

			// Sign and publish the targeting event (kind 30222 uses communikey relays)
			const targetingEvent = await currentAccount.signEvent(eventTemplate);
			await publishEvent(targetingEvent, [targetCommunityPubkey], { communityEvent });

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
		 * @returns {Promise<any>} Created calendar event object
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
			await publishEvent(calendarEvent, []);

			console.log('📅 Calendar created successfully:', calendarEvent.id);
			return calendarEvent;

			} catch (error) {
				console.error('Error creating calendar:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create calendar: ${errorMessage}`);
			}
		},

		/**
		 * Create or update an RSVP for a calendar event
		 * @param {any} calendarEvent - Calendar event to RSVP to
		 * @param {'accepted' | 'declined' | 'tentative'} status - RSVP status
		 * @param {string} [content=''] - Optional RSVP message/note
		 * @param {'free' | 'busy'} [freeBusy] - Optional free/busy status (ignored if declined)
		 * @returns {Promise<any>} Created RSVP event
		 */
		async createRsvp(calendarEvent, status, content = '', freeBusy) {
			// Validate status
			if (!['accepted', 'declined', 'tentative'].includes(status)) {
				throw new Error('Invalid RSVP status. Must be accepted, declined, or tentative');
			}

			// Get current account
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to RSVP.');
			}

			try {
				// Extract event coordinates for the 'a' tag
				const eventKind = calendarEvent.kind;
				const eventPubkey = calendarEvent.pubkey;
				const dTag = calendarEvent.tags?.find(t => t[0] === 'd')?.[1];

				if (!dTag) {
					throw new Error('Cannot RSVP: calendar event missing d-tag');
				}

				// Build event coordinate (NIP-33 format)
				const eventCoordinate = `${eventKind}:${eventPubkey}:${dTag}`;

				// Generate unique d-tag for the RSVP (allows user to update their RSVP)
				const rsvpDTag = `rsvp-${eventCoordinate}`;

				// Create the RSVP event using EventFactory (NIP-52 kind 31925)
				const eventFactory = new EventFactory();

				// Build RSVP tags according to NIP-52 with relay hints for discoverability
				const aTagWithHint = await buildATagWithHint(eventCoordinate);
				const tags = [
					['d', rsvpDTag], // Unique identifier (same for updates)
					aTagWithHint, // Required: reference to calendar event with relay hint
					['status', status] // Required: accepted/declined/tentative
				];

				// Add optional event ID reference with relay hint
				if (calendarEvent.id) {
					const eTagWithHint = await buildETagWithHint(calendarEvent.id, eventPubkey);
					tags.push(eTagWithHint);
				}

				// Add optional free/busy status (ignored if declined)
				if (freeBusy && status !== 'declined') {
					tags.push(['fb', freeBusy]);
				}

				// Add optional reference to event author with relay hint
				const pTagsWithHints = await buildPTagsWithHints([eventPubkey]);
				tags.push(pTagsWithHints[0]);

				// Build and sign the RSVP event
				const eventTemplate = await eventFactory.build({
					kind: 31925,
					content: content,
					tags: tags
				});

			const rsvpEvent = await currentAccount.signEvent(eventTemplate);
			// Include event author in tagged pubkeys for outbox routing
			await publishEvent(rsvpEvent, [eventPubkey]);

			// Add to eventStore for immediate UI update
				eventStore.add(rsvpEvent);
				console.log('✅ RSVP created successfully:', rsvpEvent.id, 'Status:', status);

				return rsvpEvent;

			} catch (error) {
				console.error('Error creating RSVP:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create RSVP: ${errorMessage}`);
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
