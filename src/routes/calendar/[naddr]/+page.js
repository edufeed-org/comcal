import { fetchEventById } from '$lib/helpers/nostrUtils';
import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';

export const ssr = false;
export const prerender = false;

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  const rawCalendar = await fetchEventById(params.naddr);
  const calendar = rawCalendar ? getCalendarEventMetadata(rawCalendar) : null;

  return {
    rawCalendar, // For CalendarEventsModel (expects raw Nostr Event)
    calendar // For UI display (transformed CalendarEvent)
  };
}
