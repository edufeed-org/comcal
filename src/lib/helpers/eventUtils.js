import { getCalendarEventStart, getCalendarEventEnd, getCalendarTitle, getCalendarEventImage, getTagValue } from 'applesauce-core/helpers';

/**
 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
 */

/**
 * Convert raw event to CalendarEvent format
 * @param {any} event
 * @returns {CalendarEvent}
 */
export function getCalendarEventMetadata(event) {
 
  const tagMap = new Map();
  event.tags.forEach((tag) => {
    const [key, ...values] = tag;
    if (!tagMap.has(key)) {
      tagMap.set(key, []);
    }
    tagMap.get(key).push(...values);
  });

  const getTagValue = (tagName) => tagMap.get(tagName)?.[0];
  const getTagValues = (tagName) => tagMap.get(tagName) || [];


  return {
    id: event.id,
    pubkey: event.pubkey,
    kind: /** @type {import('$lib/types/calendar.js').CalendarEventKind} */ (event.kind),
    title: getCalendarTitle(event) || 'Untitled Event',
    summary: event.content || getTagValue("summary") || getTagValue("description"),
    image: getCalendarEventImage(event) || '',
    startTimezone: getTagValue("start_tzid"),
    endTimezone: getTagValue("end_tzid"),
    start: getTagValue('start'),
    end: getTagValue('end'),
    location: getTagValue('location'),
    participants: getTagValues('p'),
    hashtags: getTagValues('t'),
    references: getTagValues('r'),
    geohash: getTagValue('g'),
    communityPubkey: '',
    createdAt: event.created_at,
    dTag: getTagValue('d'),
    originalEvent: event
  };
}