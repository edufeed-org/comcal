/**
 * Global Calendar Event Model
 * Provides reactive access to calendar events from the global timeline
 * Can optionally filter by authors
 * 
 * Uses progressive streaming to emit partial results as events are processed,
 * preventing UI blocking when processing large event sets.
 * 
 * Required loaders (must be started before using this model):
 * - Global calendar events (kinds 31922, 31923)
 * 
 * @param {string[]} [authors] - Optional array of author pubkeys to filter by
 * @returns {import('applesauce-core').Model<Array<import('$lib/types/calendar.js').CalendarEvent>>} Model that emits array of calendar events
 */
import { scan, distinctUntilChanged } from 'rxjs/operators';
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
			limit: 200
		};
		
		// Add author filter if provided
		if (authors && authors.length > 0) {
			filter.authors = authors;
		}
		
		// Query eventStore timeline and transform events progressively
		return eventStore.timeline(filter).pipe(
			// Use scan to accumulate and transform events progressively
			scan((accumulator, events) => {
				// Transform incoming events
				const transformedEvents = events.map((/** @type {any} */ event) => 
					getCalendarEventMetadata(event)
				);
				
				// Create a map to deduplicate by event ID
				const eventMap = new Map(accumulator.map((/** @type {any} */ e) => [e.id, e]));
				transformedEvents.forEach((/** @type {any} */ e) => eventMap.set(e.id, e));
				
				return Array.from(eventMap.values());
			}, /** @type {import('$lib/types/calendar.js').CalendarEvent[]} */ ([])),
			// Only emit when the array actually changes
			distinctUntilChanged((prev, curr) => prev.length === curr.length)
		);
	};
}
