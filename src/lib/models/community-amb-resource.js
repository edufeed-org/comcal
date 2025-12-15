/**
 * Community AMB Resource Model
 * Combines direct community resources and resources referenced by targeted publications
 * 
 * This model ONLY reads from EventStore - it does NOT fetch data.
 * The loader must populate EventStore with:
 * - Direct community resources (kind 30142 with h-tag)
 * - Targeted publications (kind 30222)
 * - Referenced AMB resources (loaded on-demand by the loader)
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
import { formatAMBResource } from '$lib/helpers/educational/index.js';

/**
 * Model for community AMB resources (educational content)
 * Combines direct resources and resources referenced by targeted publications
 * @param {string} communityPubkey - The community's pubkey to get AMB resources for
 * @returns {import('applesauce-core').Model<Array<any>>} Model that emits array of formatted AMB resources
 */
export function CommunityAMBResourceModel(communityPubkey) {
	return (eventStore) => {
		// Stream 1: Direct community resources (h-tag)
		const directResources$ = eventStore.model(TimelineModel, {
			kinds: [30142],
			'#h': [communityPubkey],
			limit: 100
		});

		// Stream 2: Targeted publications (kind 30222) for AMB resources
		const targetedPublications$ = eventStore.model(TimelineModel, {
			kinds: [30222],
			'#p': [communityPubkey],
			'#k': ['30142'],
			limit: 100
		});

		// Stream 3: All AMB resources (will include referenced resources loaded by the loader)
		const allAMBResources$ = eventStore.model(TimelineModel, {
			kinds: [30142],
			limit: 500
		});

		// Combine all streams reactively
		return combineLatest([directResources$, targetedPublications$, allAMBResources$]).pipe(
			map(([directResources, shareEvents, allResources]) => {
				// Create lookup map for efficient searching
				const allResourcesMap = new Map();
				allResources.forEach((event) => {
					// Index by event ID
					allResourcesMap.set(event.id, event);
					// Also index by address for addressable events (kind:pubkey:d-tag)
					const dTag = getTagValue(event, 'd');
					if (dTag) {
						const address = `${event.kind}:${event.pubkey}:${dTag}`;
						allResourcesMap.set(address, event);
					}
				});

				const resultMap = new Map();

				// Add direct resources first (priority)
				directResources.forEach((event) => {
					const formattedResource = formatAMBResource(event);
					resultMap.set(formattedResource.id, formattedResource);
				});

				// Parse targeted publications and resolve references
				shareEvents.forEach((shareEvent) => {
					const eTag = getTagValue(shareEvent, 'e');
					const aTag = getTagValue(shareEvent, 'a');

					if (eTag && allResourcesMap.has(eTag)) {
						// Found resource by ID
						const event = allResourcesMap.get(eTag);
						if (!resultMap.has(event.id)) {
							resultMap.set(event.id, formatAMBResource(event));
						}
					} else if (aTag) {
						// Try to find resource by address
						if (allResourcesMap.has(aTag)) {
							const event = allResourcesMap.get(aTag);
							if (!resultMap.has(event.id)) {
								resultMap.set(event.id, formatAMBResource(event));
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
