/**
 * Community Calendar Event Model
 * Combines direct community events and events referenced by targeted publications
 * 
 * This model ONLY reads from EventStore - it does NOT fetch data.
 * The loader must populate EventStore with:
 * - Direct community events (kinds 31922, 31923 with h-tag)
 * - Targeted publications (kind 30222)
 * - Referenced calendar events (loaded on-demand by the loader)
 * 
 * Uses TimelineModel from applesauce-core which automatically:
 * - Filters out deleted events (NIP-09 deletion events)
 * - Handles deduplication
 * - Re-emits when deletion events are added to EventStore
 * - Provides proper reactive updates
 */
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { TimelineModel } from 'applesauce-core/models';
import { getTagValue } from 'applesauce-core/helpers';
import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';

/**
 * Model for community calendar events
 * Combines direct events and events referenced by targeted publications
 * @param {string} communityPubkey - The community's pubkey to get calendar events for
 * @returns {import('applesauce-core').Model<Array<import('$lib/types/calendar.js').CalendarEvent>>} Model that emits array of calendar events
 */
export function CommunityCalendarEventModel(communityPubkey) {
	return (eventStore) => {
		// Stream 1: Direct community events (h-tag)
		const directEvents$ = eventStore.model(TimelineModel, {
			kinds: [31922, 31923],
			'#h': [communityPubkey],
			limit: 100
		});

		// Stream 2: Targeted publications (kind 30222)
		const targetedPublications$ = eventStore.model(TimelineModel, {
			kinds: [30222],
			'#p': [communityPubkey],
			'#k': ['31922', '31923'],
			limit: 100
		});

		// Stream 3: All calendar events (will include referenced events loaded by the loader)
		const allCalendarEvents$ = eventStore.model(TimelineModel, {
			kinds: [31922, 31923],
			limit: 500
		});

		// Combine all streams reactively
		return combineLatest([directEvents$, targetedPublications$, allCalendarEvents$]).pipe(
			map(([directEvents, shareEvents, allEvents]) => {
				// Create lookup map for efficient searching
				const allEventsMap = new Map();
				allEvents.forEach((event) => {
					// Index by event ID
					allEventsMap.set(event.id, event);
					// Also index by address for addressable events (kind:pubkey:d-tag)
					const dTag = getTagValue(event, 'd');
					if (dTag) {
						const address = `${event.kind}:${event.pubkey}:${dTag}`;
						allEventsMap.set(address, event);
					}
				});

				const resultMap = new Map();

				// Add direct events first (priority)
				directEvents.forEach((event) => {
					const calendarEvent = getCalendarEventMetadata(event);
					resultMap.set(calendarEvent.id, calendarEvent);
				});

				// Parse targeted publications and resolve references
				shareEvents.forEach((shareEvent) => {
					const eTag = getTagValue(shareEvent, 'e');
					const aTag = getTagValue(shareEvent, 'a');

					if (eTag && allEventsMap.has(eTag)) {
						// Found event by ID
						const event = allEventsMap.get(eTag);
						if (!resultMap.has(event.id)) {
							resultMap.set(event.id, getCalendarEventMetadata(event));
						}
					} else if (aTag) {
						// Try to find event by address
						if (allEventsMap.has(aTag)) {
							const event = allEventsMap.get(aTag);
							if (!resultMap.has(event.id)) {
								resultMap.set(event.id, getCalendarEventMetadata(event));
							}
						}
					}
				});

				const results = Array.from(resultMap.values());
				return results;
			})
		);
	};
}
