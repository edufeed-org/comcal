/**
 * Personal Calendar Events Model
 * Recreates applesauce's CalendarEventsModel with extensive logging for debugging
 * 
 * This model parses a calendar's 'a' tags and uses replaceable() queries
 * to fetch each referenced calendar event from the EventStore.
 * 
 * @param {any} calendar - The calendar event (kind 31924) containing 'a' tag references
 * @returns {import('applesauce-core').Model<Array<import('$lib/types/calendar.js').CalendarEvent>>}
 */
import { combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';

/**
 * Helper to parse address pointers from calendar 'a' tags
 * @param {any} calendar 
 * @returns {Array<{kind: number, pubkey: string, identifier: string}>}
 */
function getCalendarAddressPointers(calendar) {
	const pointers = calendar.tags
		.filter((tag) => tag[0] === 'a')
		.map((tag) => {
			const [kind, pubkey, identifier] = tag[1].split(':');
			return {
				kind: parseInt(kind, 10),
				pubkey,
				identifier: identifier || '' // Use empty string instead of undefined
			};
		});
	
	console.log('📅 PersonalCalendarEventsModel: Parsed pointers from calendar:', pointers);
	return pointers;
}

export function PersonalCalendarEventsModel(calendar) {
	return (eventStore) => {
		console.log('📅 PersonalCalendarEventsModel: Creating model for calendar:', calendar.id);
		
		const pointers = getCalendarAddressPointers(calendar);
		
		if (pointers.length === 0) {
			console.log('📅 PersonalCalendarEventsModel: No pointers found, returning empty array');
			return of([]);
		}
		
		console.log(`📅 PersonalCalendarEventsModel: Creating ${pointers.length} replaceable queries`);
		
		// Create a replaceable query for each pointer
		const queries = pointers.map((pointer, index) => {
			console.log(`📅 PersonalCalendarEventsModel: Query ${index + 1}/${pointers.length}:`, {
				kind: pointer.kind,
				pubkey: pointer.pubkey,
				identifier: pointer.identifier,
				identifierLength: pointer.identifier.length,
				identifierType: typeof pointer.identifier
			});
			
			// Create the replaceable query
			// IMPORTANT: Do NOT filter out null/undefined here, as combineLatest requires all observables to emit
			const query = eventStore.replaceable(pointer.kind, pointer.pubkey, pointer.identifier).pipe(
				// Log what we get from the query
				map((event) => {
					if (event) {
						console.log(`📅 PersonalCalendarEventsModel: Query ${index + 1} returned event:`, {
							id: event.id,
							kind: event.kind,
							dTag: event.tags.find(t => t[0] === 'd')?.[1],
							dTagLength: event.tags.find(t => t[0] === 'd')?.[1]?.length
						});
					} else {
						console.log(`📅 PersonalCalendarEventsModel: Query ${index + 1} returned null/undefined`);
					}
					return event;
				})
			);
			
			return query;
		});
		
		console.log('📅 PersonalCalendarEventsModel: Combining queries with combineLatest');
		
		// If no queries, return empty array
		if (queries.length === 0) {
			return of([]);
		}
		
		// Combine all queries (using array syntax to avoid deprecation warning)
		return combineLatest(queries).pipe(
			map((events) => {
				console.log(`📅 PersonalCalendarEventsModel: combineLatest returned ${events.length} events (including nulls)`);
				
				// Filter out null/undefined events
				const validEvents = events.filter((event) => event != null);
				console.log(`📅 PersonalCalendarEventsModel: After filtering nulls: ${validEvents.length} valid events`);
				
				// Transform to calendar event format
				const calendarEvents = validEvents.map((event) => getCalendarEventMetadata(event));
				
				console.log('📅 PersonalCalendarEventsModel: Final calendar events:', calendarEvents);
				return calendarEvents;
			})
		);
	};
}
