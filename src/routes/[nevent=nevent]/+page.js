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
  const hTag = event.tags?.find((/** @type {string[]} */ t) => t[0] === 'h');
  if (!hTag || !hTag[1]) {
    throw error(404, 'Event not associated with a community');
  }

  const npub = hexToNpub(hTag[1]);
  if (!npub) {
    throw error(400, 'Invalid community pubkey in event');
  }

  redirect(307, `/c/${npub}/${params.nevent}`);
}
