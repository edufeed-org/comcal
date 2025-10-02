import { getCalendarTitle, getCalendarEventImage } from 'applesauce-core/helpers';

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


  // Convert timestamp strings to numbers with validation
  const startValue = getTagValue('start');
  const endValue = getTagValue('end');

  const start = startValue ? parseInt(startValue, 10) : 0;
  const end = endValue ? parseInt(endValue, 10) : 0;

  // Validate timestamps
  if (startValue && isNaN(start)) {
    console.warn('Invalid start timestamp:', startValue, 'for event:', event.id, event);
  }
  if (endValue && isNaN(end)) {
    console.warn('Invalid end timestamp:', endValue, 'for event:', event.id);
  }

  return {
    id: event.id,
    pubkey: event.pubkey,
    kind: /** @type {import('$lib/types/calendar.js').CalendarEventKind} */ (event.kind),
    title: getCalendarTitle(event) || 'Untitled Event',
    summary: event.content || getTagValue("summary") || getTagValue("description"),
    image: getCalendarEventImage(event) || '',
    startTimezone: getTagValue("start_tzid"),
    endTimezone: getTagValue("end_tzid"),
    start,
    end,
    location: getTagValue('location'),
    participants: getTagValues('p'),
    hashtags: getTagValues('t'),
    references: getTagValues('r'),
    eventReferences: getTagValues('a'),
    geohash: getTagValue('g'),
    communityPubkey: '',
    createdAt: event.created_at,
    dTag: getTagValue('d'),
    originalEvent: event
  };
}

/**
   * Parse address reference string into components
   * @param {string} addressRef - Address reference like "31922:pubkey:d-tag"
   * @returns {{kind: number, pubkey: string, dTag: string} | null}
   */
export function parseAddressReference(addressRef) {
  try {
    const parts = addressRef.split(':');
    if (parts.length !== 3) return null;

    const [kindStr, pubkey, dTag] = parts;
    const kind = parseInt(kindStr, 10);

    if (isNaN(kind) || !pubkey || !dTag) return null;

    return { kind, pubkey, dTag };
  } catch (error) {
    console.error('📅 SimpleCalendarView: Error parsing address reference:', addressRef, error);
    return null;
  }
}