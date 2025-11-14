/**
 * Community Calendar Event Model
 * Provides reactive access to calendar events for a specific community
 * Combines direct community events (h-tag) and targeted publications (kind 30222)
 * 
 * Uses TimelineModel from applesauce-core which automatically:
 * - Filters out deleted events (NIP-09 deletion events)
 * - Handles deduplication
 * - Re-emits when deletion events are added to EventStore
 * - Provides proper reactive updates
 * 
 * This model actively loads referenced calendar events on-demand using EventStore loaders,
 * making it self-contained and eliminating race conditions.
 * 
 * Required loaders (must be started before using this model):
 * - Direct community events (kinds 31922, 31923 with h-tag)
 * - Targeted publication events (kind 30222)
 * - Deletion events (kind 5) for all event authors
 * 
 * The model will automatically load referenced calendar events as needed.
 */
import { combineLatest, of, from, isObservable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { TimelineModel } from 'applesauce-core/models';
import { getTagValue } from 'applesauce-core/helpers';
import { getCalendarEventMetadata, parseAddressReference } from '$lib/helpers/eventUtils';

/**
 * Model for community calendar events
 * Combines direct events and events referenced by targeted publications
 * @param {string} communityPubkey - The community's pubkey to get calendar events for
 * @returns {import('applesauce-core').Model<Array<import('$lib/types/calendar.js').CalendarEvent>>} Model that emits array of calendar events
 */
export function CommunityCalendarEventModel(communityPubkey) {
	return (eventStore) => {
		// Stream 1: Direct community events (events with h-tag pointing to community)
		// Use TimelineModel which handles deletion filtering
		const directEvents$ = eventStore.model(TimelineModel, {
			kinds: [31922, 31923],
			'#h': [communityPubkey],
			limit: 100
		});

		// Stream 2: Targeted publication events (kind 30222 events referencing this community)
		// Use TimelineModel which handles deletion filtering
		const targetedPublications$ = eventStore.model(TimelineModel, {
			kinds: [30222],
			'#p': [communityPubkey],
			'#k': ['31922', '31923'],
			limit: 100
		});

		// Combine streams and actively load referenced events
		return combineLatest([directEvents$, targetedPublications$]).pipe(
			switchMap(([directEvents, shareEvents]) => {
				const eventMap = new Map();
				
				// Add direct events first (these have priority)
				directEvents.forEach((event) => {
					const calendarEvent = getCalendarEventMetadata(event);
					eventMap.set(calendarEvent.id, calendarEvent);
				});
				
				// Extract references from targeted publications and create loaders
				/** @type {Array<import('rxjs').Observable<any>>} */
				const referenceLoaders = [];
				console.log('share events', shareEvents)
				shareEvents.forEach((shareEvent) => {
					const eTag = getTagValue(shareEvent, 'e');
					const aTag = getTagValue(shareEvent, 'a');
					
					if (aTag) {
						// Load by addressable reference
						const parsed = parseAddressReference(aTag);
						if (parsed && eventStore.addressableLoader) {
							const loaderResult = eventStore.addressableLoader({
								kind: parsed.kind,
								pubkey: parsed.pubkey,
								identifier: parsed.dTag
							});
							if (loaderResult) {
								// Handle both Observable and Promise returns
								const loader = isObservable(loaderResult) ? loaderResult : from(loaderResult);
								referenceLoaders.push(loader);
							}
						}
					} else if (eTag) {
						// Load by event ID using TimelineModel (filters deleted events)
						const loader = eventStore.model(TimelineModel, {
							ids: [eTag]
						}).pipe(
							map((events) => events[0] || null)
						);
						referenceLoaders.push(loader);
					}
				});
				
				// If no references to load, return direct events immediately
				if (referenceLoaders.length === 0) {
					console.log(`📅 CommunityCalendarEventModel: Combined ${eventMap.size} events (${directEvents.length} direct + 0 resolved shares)`);
					return of(Array.from(eventMap.values()));
				}
				
				// Combine all reference loaders and add results to map
				return combineLatest(referenceLoaders).pipe(
					map((referencedEvents) => {
						let resolvedCount = 0;
						console.log('referenced events', referencedEvents)
						referencedEvents.forEach((event) => {
							// Skip null/undefined results
							if (!event) return;
							
							// Add to map if not already present
							if (!eventMap.has(event.id)) {
								const calendarEvent = getCalendarEventMetadata(event);
								eventMap.set(calendarEvent.id, calendarEvent);
								resolvedCount++;
							}
						});
						
						const combined = Array.from(eventMap.values());
						console.log(`📅 CommunityCalendarEventModel: Combined ${combined.length} events (${directEvents.length} direct + ${resolvedCount} resolved shares from ${shareEvents.length} total)`);
						return combined;
					})
				);
			})
		);
	};
}
