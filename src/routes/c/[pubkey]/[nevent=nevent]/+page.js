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

  // Kind 1111 comment: resolve root thread via A tag
  if (event.kind === 1111) {
    const aTag = event.tags.find((/** @type {any[]} */ t) => t[0] === 'A');
    if (aTag) {
      const [kind, pubkey, ...rest] = aTag[1].split(':');
      const identifier = rest.join(':'); // Handle d-tags with colons
      const relays = aTag[2] ? [aTag[2]] : [];
      const naddr = nip19.naddrEncode({ kind: parseInt(kind), pubkey, identifier, relays });
      const rootThread = await fetchEventById(naddr);
      if (rootThread) {
        return {
          event: rootThread,
          nevent: params.nevent,
          contentView: kindViewMap[rootThread.kind],
          focusCommentId: event.id
        };
      }
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
