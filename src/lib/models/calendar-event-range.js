/**
 * Calendar Event Range Model
 * Filters calendar events by date range, sorted by start time (soonest first).
 * Reusable across discover page, calendar views, profile pages, etc.
 *
 * Uses TimelineModel from applesauce-core which automatically:
 * - Filters out deleted events (NIP-09 deletion events)
 * - Handles deduplication
 * - Re-emits when deletion events are added to EventStore
 * - Provides proper reactive updates
 *
 * @param {number} rangeStart - Start of date range (Unix timestamp seconds)
 * @param {number} rangeEnd - End of date range (Unix timestamp seconds)
 * @param {string[]} [authors] - Optional array of author pubkeys to filter by
 * @returns {import('applesauce-core').Model<Array<import('$lib/types/calendar.js').CalendarEvent>>}
 */
import { TimelineModel } from 'applesauce-core/models';
import { map } from 'rxjs/operators';
import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';
import { eventOverlapsDateRange } from '$lib/helpers/calendar.js';

/**
 * @param {number} rangeStart
 * @param {number} rangeEnd
 * @param {string[]} [authors]
 */
export function CalendarEventRangeModel(rangeStart, rangeEnd, authors = []) {
  return (/** @type {any} */ eventStore) => {
    // Build filter for timeline query
    /** @type {any} */
    const filter = {
      kinds: [31922, 31923],
      limit: 500
    };

    // Add author filter if provided
    if (authors && authors.length > 0) {
      filter.authors = authors;
    }

    // Use TimelineModel which handles deletion filtering automatically
    return eventStore.model(TimelineModel, filter).pipe(
      // Transform raw Nostr events to CalendarEvent objects, filter by date range, and sort
      map((events) => {
        const calendarEvents = events.map((/** @type {any} */ event) =>
          getCalendarEventMetadata(event)
        );

        // Filter to only events that overlap with the date range
        const filteredEvents = calendarEvents.filter((/** @type {any} */ e) =>
          eventOverlapsDateRange(e, rangeStart, rangeEnd)
        );

        // Sort by start time ascending (soonest first)
        return filteredEvents.sort(
          (/** @type {any} */ a, /** @type {any} */ b) => (a.start || 0) - (b.start || 0)
        );
      })
    );
  };
}
