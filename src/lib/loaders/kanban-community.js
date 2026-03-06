/**
 * Kanban board loading for community views (kind 30301).
 * Follows the same pattern as amb.js useAMBCommunityLoader.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { getKanbanRelays } from '$lib/helpers/relay-helper.js';
import { TimelineModel } from 'applesauce-core/models';
import { getTagValue } from 'applesauce-core/helpers';
import { parseAddressPointerFromATag } from '$lib/helpers/nostrUtils.js';
import { SvelteSet } from 'svelte/reactivity';
import { onlyEvents } from 'applesauce-relay/operators';
import { mapEventsToStore } from 'applesauce-core/observable';
import { addressLoader, timedPool } from './base.js';
import { communityTargetedPublicationsLoader } from './targeted-publications.js';

/**
 * Hook: Load kanban boards for a specific community.
 *
 * @param {string} communityPubkey - The community's public key
 * @returns {{
 *   subscriptions: Map<string, any>,
 *   cleanup: () => void
 * }}
 */
export function useKanbanCommunityLoader(communityPubkey) {
  const subscriptions = new Map();

  if (!communityPubkey) {
    console.warn('📋 KanbanLoader: No communityPubkey provided');
    return { subscriptions, cleanup: () => {} };
  }

  console.log('📋 KanbanLoader: Starting community loader for', communityPubkey.slice(0, 8));

  // 1. Load direct community boards (kind 30301 with h-tag)
  const directLoader = createTimelineLoader(
    timedPool,
    getKanbanRelays(),
    { kinds: [30301], '#h': [communityPubkey] },
    { eventStore, limit: 50 }
  );
  subscriptions.set('directBoards', directLoader().subscribe());

  // 2. Load targeted publications (kind 30222) referencing boards
  subscriptions.set(
    'targetedPublications',
    communityTargetedPublicationsLoader(communityPubkey, [30301])().subscribe()
  );

  // 3. Watch targeted publications and load referenced boards on-demand
  const referencedSub = eventStore
    .model(TimelineModel, {
      kinds: [30222],
      '#p': [communityPubkey],
      '#k': ['30301'],
      limit: 100
    })
    .subscribe((shareEvents) => {
      const eventIds = new SvelteSet();
      /** @type {Array<{kind: number, pubkey: string, dTag: string}>} */
      const addressableRefs = [];

      shareEvents.forEach((shareEvent) => {
        const eTag = getTagValue(shareEvent, 'e');
        const aTag = getTagValue(shareEvent, 'a');

        if (eTag) {
          eventIds.add(eTag);
        }
        if (aTag) {
          const parsed = parseAddressPointerFromATag(aTag);
          if (parsed) {
            addressableRefs.push({
              kind: parsed.kind,
              pubkey: parsed.pubkey,
              dTag: parsed.identifier
            });
          }
        }
      });

      if (eventIds.size > 0) {
        console.log('📋 KanbanLoader: Loading', eventIds.size, 'referenced boards by ID');
        const sub = pool
          .subscription(getKanbanRelays(), { ids: Array.from(eventIds) })
          .pipe(onlyEvents(), mapEventsToStore(eventStore))
          .subscribe();
        subscriptions.set(`refById-${Date.now()}`, sub);
      }

      if (addressableRefs.length > 0) {
        console.log(
          '📋 KanbanLoader: Loading',
          addressableRefs.length,
          'referenced boards by address'
        );
        addressableRefs.forEach((ref) => {
          addressLoader({
            kind: ref.kind,
            pubkey: ref.pubkey,
            identifier: ref.dTag
          }).subscribe();
        });
      }
    });
  subscriptions.set('referencedBoards', referencedSub);

  function cleanup() {
    console.log('📋 KanbanLoader: Cleaning up community loader');
    subscriptions.forEach((sub) => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    subscriptions.clear();
  }

  return { subscriptions, cleanup };
}
