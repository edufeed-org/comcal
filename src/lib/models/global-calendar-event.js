/**
 * Global Calendar Event Model
 * Provides reactive access to calendar events from the global timeline
 * Can optionally filter by authors
 * 
 * Required loaders (must be started before using this model):
 * - Global calendar events (kinds 31922, 31923)
 * 
 * @param {string[]} [authors] - Optional array of author pubkeys to filter by
 * @returns {import('applesauce-core').Model<Array<import('$lib/types/calendar.js').CalendarEvent>>} Model that emits array of calendar events
 */
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
			limit: 200
		};
		
		// Add author filter if provided
		if (authors && authors.length > 0) {
			filter.authors = authors;
		}
		
		// Query eventStore timeline and transform events
		return eventStore.timeline(filter).pipe(
			map((events) => {
				const calendarEvents = events.map((/** @type {any} */ event) => 
					getCalendarEventMetadata(event)
				);
				console.log(
					`📅 GlobalCalendarEventModel: Retrieved ${calendarEvents.length} calendar events${
						authors && authors.length > 0 ? ` (filtered by ${authors.length} authors)` : ''
					}`
				);
				return calendarEvents;
			})
		);
	};
}
