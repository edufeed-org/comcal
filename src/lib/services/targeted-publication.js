/**
 * Shared helper for creating targeted publication events (kind 30222)
 * Used by both educational-actions and article-actions.
 */

import { EventFactory } from 'applesauce-core/event-factory';
import { manager } from '$lib/stores/accounts.svelte';
import {
  publishEventOptimistic,
  buildATagWithHint,
  buildETagWithHint
} from '$lib/services/publish-service.js';

/** Kind number for Targeted Publication events (Communikey) */
const TARGETED_PUBLICATION_KIND = 30222;

/**
 * Create a targeted publication event to associate content with a community
 * @param {import('nostr-tools').NostrEvent} contentEvent - The content event (article, resource, etc.)
 * @param {string} communityPubkey - Target community public key
 * @param {import('nostr-tools').NostrEvent | null} [communityEvent] - Optional community definition event (kind 10222) for relay routing
 * @returns {Promise<void>}
 */
export async function createTargetedPublication(
  contentEvent,
  communityPubkey,
  communityEvent = null
) {
  const currentAccount = manager.active;
  if (!currentAccount) {
    throw new Error('No account selected. Please log in to create targeted publications.');
  }

  // Extract d-tag from content event
  const dTag = contentEvent.tags.find((/** @type {string[]} */ t) => t[0] === 'd')?.[1];
  if (!dTag) {
    throw new Error('Content event missing d-tag');
  }

  // Build the coordinate for the 'a' tag
  const coordinate = `${contentEvent.kind}:${contentEvent.pubkey}:${dTag}`;

  // Build tags with relay hints for discoverability
  const aTagWithHint = await buildATagWithHint(coordinate);
  const eTagWithHint = await buildETagWithHint(contentEvent.id, contentEvent.pubkey);

  const eventFactory = new EventFactory();

  const tags = [
    ['d', `${communityPubkey}:${dTag}`],
    ['h', communityPubkey],
    aTagWithHint,
    eTagWithHint
  ];

  const eventTemplate = await eventFactory.build({
    kind: TARGETED_PUBLICATION_KIND,
    content: '',
    tags: tags
  });

  const targetingEvent = await currentAccount.signEvent(eventTemplate);
  publishEventOptimistic(targetingEvent, [communityPubkey], { communityEvent });
}
