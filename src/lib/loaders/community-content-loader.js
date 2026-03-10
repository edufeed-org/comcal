/**
 * Generic community content loader factory.
 * Extracts the shared 3-step loading pattern used by amb.js and kanban-community.js:
 * 1. Direct content (h-tagged events from content relays)
 * 2. Targeted publications (kind 30222 from communikey relays)
 * 3. Reference resolution (load events referenced by targeted publications)
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { TimelineModel } from 'applesauce-core/models';
import { getTagValue } from 'applesauce-core/helpers';
import { parseAddressPointerFromATag } from '$lib/helpers/nostrUtils.js';
import { onlyEvents } from 'applesauce-relay/operators';
import { mapEventsToStore } from 'applesauce-core/observable';
import { addressLoader, timedPool } from './base.js';
import { communityTargetedPublicationsLoader } from './targeted-publications.js';

/**
 * Create a community content loader for any content type.
 *
 * @param {number[]} kinds - Event kinds to load (e.g. [30142], [30301], [30023])
 * @param {() => string[]} getRelays - Function returning relay URLs for this content type
 * @param {Object} [options]
 * @param {(filter: import('nostr-tools').Filter) => import('nostr-tools').Filter} [options.filterFn] - Filter transform (e.g. applyCuratedFilter)
 * @returns {(communityPubkey: string) => { subscriptions: Map<string, any>, cleanup: () => void }}
 */
export function createCommunityContentLoader(kinds, getRelays, options = {}) {
  const { filterFn } = options;
  const kTagStrings = kinds.map(String);

  return function (communityPubkey) {
    const subscriptions = new Map();

    if (!communityPubkey) {
      return { subscriptions, cleanup: () => {} };
    }

    const relays = getRelays();

    // 1. Direct community content (events with h-tag matching community)
    const directFilter = { kinds, '#h': [communityPubkey] };
    const finalDirectFilter = filterFn ? filterFn(directFilter) : directFilter;
    const directLoader = createTimelineLoader(timedPool, relays, finalDirectFilter, {
      eventStore,
      limit: 50
    });
    subscriptions.set('direct', directLoader().subscribe());

    // 2. Targeted publications (kind 30222) referencing this content type
    const targetedPubSub = communityTargetedPublicationsLoader(
      communityPubkey,
      kinds
    )().subscribe();
    subscriptions.set('targetedPublications', targetedPubSub);

    // 3. Watch targeted publications and load referenced content on-demand
    // Uses plain Set (not SvelteSet) for internal tracking — avoids reactive read/write loops
    const loadedEventIds = new Set();
    const loadedAddresses = new Set();

    const referencedSub = eventStore
      .model(TimelineModel, {
        kinds: [30222],
        '#p': [communityPubkey],
        '#k': kTagStrings,
        limit: 100
      })
      .subscribe((shareEvents) => {
        const newEventIds = [];
        /** @type {Array<{kind: number, pubkey: string, identifier: string}>} */
        const newAddressRefs = [];

        for (const shareEvent of shareEvents) {
          const eTag = getTagValue(shareEvent, 'e');
          const aTag = getTagValue(shareEvent, 'a');

          if (eTag && !loadedEventIds.has(eTag)) {
            loadedEventIds.add(eTag);
            newEventIds.push(eTag);
          }
          if (aTag && !loadedAddresses.has(aTag)) {
            loadedAddresses.add(aTag);
            const parsed = parseAddressPointerFromATag(aTag);
            if (parsed) {
              newAddressRefs.push({
                kind: parsed.kind,
                pubkey: parsed.pubkey,
                identifier: parsed.identifier
              });
            }
          }
        }

        if (newEventIds.length > 0) {
          const sub = pool
            .subscription(relays, { ids: newEventIds })
            .pipe(onlyEvents(), mapEventsToStore(eventStore))
            .subscribe();
          subscriptions.set(`refById-${Date.now()}`, sub);
        }

        if (newAddressRefs.length > 0) {
          for (const ref of newAddressRefs) {
            addressLoader({
              kind: ref.kind,
              pubkey: ref.pubkey,
              identifier: ref.identifier
            }).subscribe();
          }
        }
      });
    subscriptions.set('referenced', referencedSub);

    function cleanup() {
      subscriptions.forEach((sub) => {
        if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      });
      subscriptions.clear();
    }

    return { subscriptions, cleanup };
  };
}
