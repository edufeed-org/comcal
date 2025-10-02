import { fetchEventById } from '$lib/helpers/nostrUtils';
import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  const rawCalendar = await fetchEventById(params.naddr);
  const calendar = rawCalendar ? getCalendarEventMetadata(rawCalendar) : null;
  
  return {
    calendar
  };
}
