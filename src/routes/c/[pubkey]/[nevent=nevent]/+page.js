import { nip19 } from 'nostr-tools';
import { decodeEventPointer } from 'applesauce-core/helpers';
import { fetchEventById } from '$lib/helpers/nostrUtils.js';
import { error } from '@sveltejs/kit';

export const ssr = false;
export const prerender = false;

/** @type {{ [kind: number]: string }} */
const kindViewMap = { 11: 'forum' };

/**
 * @type {import('./$types').PageLoad}
 */
export async function load({ params }) {
  const pointer = decodeEventPointer(params.nevent);
  if (!pointer) {
    throw error(400, 'Invalid nevent format');
  }

  // Fetch the event
  const event = await fetchEventById(params.nevent);
  if (!event) {
    throw error(404, 'Event not found');
  }

  // Kind 1111 comment: resolve root thread via A tag or E tag
  if (event.kind === 1111) {
    /** @type {any} */
    let rootThread = null;

    // Try A tag first (addressable root events like kind 30xxx)
    const aTag = event.tags.find((/** @type {any[]} */ t) => t[0] === 'A');
    if (aTag) {
      const [kind, pubkey, ...rest] = aTag[1].split(':');
      const identifier = rest.join(':');
      const relays = aTag[2] ? [aTag[2]] : [];
      const naddr = nip19.naddrEncode({ kind: parseInt(kind), pubkey, identifier, relays });
      rootThread = await fetchEventById(naddr);
    }

    // Fallback: try E tag (regular root events like kind 11)
    if (!rootThread) {
      const eTag = event.tags.find((/** @type {any[]} */ t) => t[0] === 'E');
      if (eTag) {
        const relayHint = eTag[2] || '';
        const nevent = nip19.neventEncode({ id: eTag[1], relays: relayHint ? [relayHint] : [] });
        rootThread = await fetchEventById(nevent);
      }
    }

    if (rootThread) {
      return {
        event: rootThread,
        nevent: params.nevent,
        contentView: kindViewMap[rootThread.kind],
        focusCommentId: event.id
      };
    }
    throw error(404, 'Could not resolve comment thread');
  }

  const contentView = kindViewMap[event.kind] || undefined;

  return {
    event,
    nevent: params.nevent,
    contentView
  };
}
