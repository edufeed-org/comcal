import { decodeEventPointer } from 'applesauce-core/helpers';
import { fetchEventById, hexToNpub } from '$lib/helpers/nostrUtils.js';
import { error, redirect } from '@sveltejs/kit';

export const ssr = false;
export const prerender = false;

/**
 * Top-level nevent route: resolves community from #h tag and redirects.
 * @type {import('./$types').PageLoad}
 */
export async function load({ params }) {
  const pointer = decodeEventPointer(params.nevent);
  if (!pointer) {
    throw error(400, 'Invalid nevent format');
  }

  const event = await fetchEventById(params.nevent);
  if (!event) {
    throw error(404, 'Event not found');
  }

  // Find community pubkey from #h tag
  let hTag = event.tags?.find((/** @type {string[]} */ t) => t[0] === 'h');

  // If no #h tag and it's a comment (kind 1111), follow root event to find community
  if ((!hTag || !hTag[1]) && event.kind === 1111) {
    /** @type {any} */
    let rootEvent = null;

    // Try A tag first (addressable root events like kind 30xxx)
    const aTag = event.tags?.find((/** @type {string[]} */ t) => t[0] === 'A');
    if (aTag?.[1]) {
      const [kind, pubkey, ...rest] = aTag[1].split(':');
      const identifier = rest.join(':');
      const relays = aTag[2] ? [aTag[2]] : [];
      const { nip19 } = await import('nostr-tools');
      const naddr = nip19.naddrEncode({ kind: parseInt(kind), pubkey, identifier, relays });
      rootEvent = await fetchEventById(naddr);
    }

    // Try E tag (regular root events like kind 11)
    if (!rootEvent) {
      const eTag = event.tags?.find((/** @type {string[]} */ t) => t[0] === 'E');
      if (eTag?.[1]) {
        const relayHint = eTag[2] || '';
        const { nip19 } = await import('nostr-tools');
        const nevent = nip19.neventEncode({ id: eTag[1], relays: relayHint ? [relayHint] : [] });
        rootEvent = await fetchEventById(nevent);
      }
    }

    if (rootEvent) {
      hTag = rootEvent.tags?.find((/** @type {string[]} */ t) => t[0] === 'h');
    }
  }

  if (!hTag || !hTag[1]) {
    throw error(404, 'Event not associated with a community');
  }

  const npub = hexToNpub(hTag[1]);
  if (!npub) {
    throw error(400, 'Invalid community pubkey in event');
  }

  redirect(307, `/c/${npub}/${params.nevent}`);
}
