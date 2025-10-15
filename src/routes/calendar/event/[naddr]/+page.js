import { fetchEventById } from '$lib/helpers/nostrUtils';
import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  const rawEvent = await fetchEventById(params.naddr);
  const event = rawEvent ? getCalendarEventMetadata(rawEvent) : null;
  
  return {
    event,
    rawEvent, // Include raw event for AddToCalendarDropdown and editing
    naddr: params.naddr
  };
}
