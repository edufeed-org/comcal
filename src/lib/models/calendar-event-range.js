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
import { map, debounceTime } from 'rxjs/operators';
import { validateAndTransformCalendarEvents } from '$lib/helpers/eventUtils';
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
      // Batch rapid emissions to avoid redundant validate+transform+sort pipelines
      debounceTime(100),
      // Validate, transform, sort, then filter by date range
      map((events) =>
        validateAndTransformCalendarEvents(events).filter((e) =>
          eventOverlapsDateRange(e, rangeStart, rangeEnd)
        )
      )
    );
  };
}
