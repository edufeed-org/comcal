import { fetchEventById } from '$lib/helpers/nostrUtils';

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  const event = await fetchEventById(params.naddr)
  return {
    event
  }
}