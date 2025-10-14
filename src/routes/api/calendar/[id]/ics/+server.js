import { fetchCalendarEvents, fetchEventById, encodeEventToNaddr } from '$lib/helpers/nostrUtils';
import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, params }) {
  const { id: nostrCalendarAddress } = params ?? null;

  const calendarEvent = await fetchEventById(nostrCalendarAddress);
  const calendarMetadata = getCalendarEventMetadata(calendarEvent)

  if (!calendarEvent || calendarEvent.kind !== 31924) {
    return new Response(JSON.stringify({ error: "Invalid calendar ID or event not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { upcoming, past } = await fetchCalendarEvents(calendarEvent)

  const allEvents = [...upcoming, ...past];

  const icsContent = generateICSContent(calendarMetadata, allEvents, url);

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${calendarMetadata.title || "edufeed-calendar"}.ics"`,
      "Cache-Control": "no-cache, must-revalidate",
      "X-Published-TTL": "PT1H", // Refresh every hour
    },
  });
}

/**
 * 
 * @param {import('$lib/types/calendar.js').CalendarEvent} calendarMetadata 
 * @param {import('nostr-tools').NostrEvent[]} events 
 * @param {URL} url - Request URL object for generating event URLs
 * @returns 
 */
function generateICSContent(calendarMetadata, events, url) {
  /** @type {Date} */
  const now = new Date();

  /**
   * Format a UNIX timestamp (seconds) into an ICS-compatible UTC date-time string.
   * Returns empty string for invalid input.
   * @param {string|number|undefined|null} timestamp
   * @returns {string}
   */
  const formatDate = (timestamp) => {
    if (
      timestamp === undefined ||
      timestamp === null ||
      isNaN(Number(timestamp))
    )
      return "";
    const num = typeof timestamp === "string" ? parseInt(timestamp) : timestamp;
    if (!isFinite(num)) return "";
    const date = new Date(num * 1000);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  /**
   * Format a UNIX timestamp (seconds) into an ICS-compatible DATE-only string (YYYYMMDD).
   * Used for all-day events (kind 31922).
   * Returns empty string for invalid input.
   * @param {string|number|undefined|null} timestamp
   * @returns {string}
   */
  const formatDateOnly = (timestamp) => {
    if (
      timestamp === undefined ||
      timestamp === null ||
      isNaN(Number(timestamp))
    )
      return "";
    const num = typeof timestamp === "string" ? parseInt(timestamp) : timestamp;
    if (!isFinite(num)) return "";
    const date = new Date(num * 1000);
    if (isNaN(date.getTime())) return "";
    // Format as YYYYMMDD
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  /**
   * Escape text for ICS fields.
   * @param {string} text
   * @returns {string}
   */
  const escapeText = (text) => {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  };

  /** @type {string[]} */
  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Edufeed//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarMetadata.title || "Edufeed Calendar")}`,
    `X-WR-CALDESC:${escapeText(calendarMetadata.summary || "")}`,
    "X-WR-TIMEZONE:UTC",
    `LAST-MODIFIED:${formatDate(now.getTime() / 1000)}`,
  ];

  events.forEach((event) => {
    const metadata = getCalendarEventMetadata(event);
    // Ensure start is a valid UNIX timestamp (seconds)
    const startTimestamp = Number(metadata.start);
    if (!startTimestamp || !isFinite(startTimestamp)) return;

    // Check if this is an all-day event (kind 31922)
    const isAllDayEvent = event.kind === 31922;

    let startDate, endDate, dtStartProperty, dtEndProperty;

    if (isAllDayEvent) {
      // Format as DATE-only for all-day events (kind 31922)
      startDate = formatDateOnly(startTimestamp);
      
      // For all-day events, end date should be the day AFTER the last day
      // per ICS standard (exclusive end date)
      let endTimestamp;
      if (metadata.end && isFinite(Number(metadata.end))) {
        // End timestamp exists, add 1 day (86400 seconds)
        endTimestamp = Number(metadata.end) + 86400;
      } else {
        // No end date, assume single-day event: end is start + 1 day
        endTimestamp = startTimestamp + 86400;
      }
      endDate = formatDateOnly(endTimestamp);
      
      // Use VALUE=DATE for all-day events
      dtStartProperty = `DTSTART;VALUE=DATE:${startDate}`;
      dtEndProperty = `DTEND;VALUE=DATE:${endDate}`;
    } else {
      // Format as datetime for time-based events (kind 31923)
      startDate = formatDate(startTimestamp);
      
      // If end is present and valid, use it; otherwise, default to 1 hour after start
      let endTimestamp;
      if (metadata.end && isFinite(Number(metadata.end))) {
        endTimestamp = Number(metadata.end);
      } else {
        endTimestamp = startTimestamp + 3600; // Default 1 hour duration
      }
      endDate = formatDate(endTimestamp);
      
      // Standard datetime format for time-based events
      dtStartProperty = `DTSTART:${startDate}`;
      dtEndProperty = `DTEND:${endDate}`;
    }

    const baseUrl = url.origin;
    const eventNaddr = encodeEventToNaddr(event, []);

    ics.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@edufeed.com`,
      dtStartProperty,
      dtEndProperty,
      `SUMMARY:${escapeText(metadata.title || "Untitled Event")}`,
      `DESCRIPTION:${escapeText(metadata.summary || "")}`,
      metadata.location ? `LOCATION:${escapeText(metadata.location)}` : "",
      `URL:${baseUrl}/calendar/event/${eventNaddr}`,
      `CREATED:${formatDate(event.created_at)}`,
      `LAST-MODIFIED:${formatDate(event.created_at)}`,
      "END:VEVENT"
    );
  });

  ics.push("END:VCALENDAR");

  return ics.filter((line) => line !== "").join("\r\n");
}
