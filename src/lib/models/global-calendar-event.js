/**
 * Global Calendar Event Model
 * Provides reactive access to calendar events from the global timeline
 * Can optionally filter by authors
 *
 * Uses TimelineModel from applesauce-core which automatically:
 * - Filters out deleted events (NIP-09 deletion events)
 * - Handles deduplication
 * - Re-emits when deletion events are added to EventStore
 * - Provides proper reactive updates
 *
 * Required loaders (must be started before using this model):
 * - Global calendar events (kinds 31922, 31923)
 * - Deletion events for event authors (kind 5)
 *
 * @param {string[]} [authors] - Optional array of author pubkeys to filter by
 * @returns {import('applesauce-core').Model<Array<import('$lib/types/calendar.js').CalendarEvent>>} Model that emits array of calendar events
 */
import { TimelineModel } from 'applesauce-core/models';
import { map } from 'rxjs/operators';
import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';

/**
 * @param {string[]} [authors]
 */
export function GlobalCalendarEventModel(authors = []) {
  return (/** @type {any} */ eventStore) => {
    // Build filter for timeline query
    /** @type {any} */
    const filter = {
      kinds: [31922, 31923],
      limit: 300
    };

    // Add author filter if provided
    if (authors && authors.length > 0) {
      filter.authors = authors;
    }

    // Use TimelineModel which handles deletion filtering automatically
    // TimelineModel will:
    // 1. Filter out events that have deletion events (kind 5) in EventStore
    // 2. Re-emit when new deletion events are added
    // 3. Maintain proper reactivity
    return eventStore.model(TimelineModel, filter).pipe(
      // Transform raw Nostr events to CalendarEvent objects
      map((events) => events.map((/** @type {any} */ event) => getCalendarEventMetadata(event)))
    );
  };
}
