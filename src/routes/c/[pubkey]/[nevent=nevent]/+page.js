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

  const contentView = kindViewMap[event.kind] || undefined;

  return {
    event,
    nevent: params.nevent,
    contentView
  };
}
