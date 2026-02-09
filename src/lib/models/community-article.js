/**
 * Community Article Model
 * Combines direct community articles and articles referenced by targeted publications
 *
 * This model ONLY reads from EventStore - it does NOT fetch data.
 * The loader must populate EventStore with:
 * - Direct community articles (kind 30023 with h-tag)
 * - Targeted publications (kind 30222)
 * - Referenced articles (loaded on-demand by the loader)
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

/**
 * Model for community articles (long-form content)
 * Combines direct articles and articles referenced by targeted publications
 * @param {string} communityPubkey - The community's pubkey to get articles for
 * @returns {import('applesauce-core').Model<Array<any>>} Model that emits array of articles
 */
export function CommunityArticleModel(communityPubkey) {
  return (eventStore) => {
    // Stream 1: Direct community articles (h-tag)
    const directArticles$ = eventStore.model(TimelineModel, {
      kinds: [30023],
      '#h': [communityPubkey],
      limit: 100
    });

    // Stream 2: Targeted publications (kind 30222) for articles
    const targetedPublications$ = eventStore.model(TimelineModel, {
      kinds: [30222],
      '#p': [communityPubkey],
      '#k': ['30023'],
      limit: 100
    });

    // Stream 3: All articles (will include referenced articles loaded by the loader)
    const allArticles$ = eventStore.model(TimelineModel, {
      kinds: [30023],
      limit: 500
    });

    // Combine all streams reactively
    return combineLatest([directArticles$, targetedPublications$, allArticles$]).pipe(
      map(([directArticles, shareEvents, allArticles]) => {
        // Create lookup map for efficient searching
        const allArticlesMap = new Map();
        allArticles.forEach((event) => {
          // Index by event ID
          allArticlesMap.set(event.id, event);
          // Also index by address for addressable events (kind:pubkey:d-tag)
          const dTag = getTagValue(event, 'd');
          if (dTag) {
            const address = `${event.kind}:${event.pubkey}:${dTag}`;
            allArticlesMap.set(address, event);
          }
        });

        const resultMap = new Map();

        // Add direct articles first (priority)
        directArticles.forEach((event) => {
          resultMap.set(event.id, event);
        });

        // Parse targeted publications and resolve references
        shareEvents.forEach((shareEvent) => {
          const eTag = getTagValue(shareEvent, 'e');
          const aTag = getTagValue(shareEvent, 'a');

          if (eTag && allArticlesMap.has(eTag)) {
            // Found article by ID
            const event = allArticlesMap.get(eTag);
            if (!resultMap.has(event.id)) {
              resultMap.set(event.id, event);
            }
          } else if (aTag) {
            // Try to find article by address
            if (allArticlesMap.has(aTag)) {
              const event = allArticlesMap.get(aTag);
              if (!resultMap.has(event.id)) {
                resultMap.set(event.id, event);
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
