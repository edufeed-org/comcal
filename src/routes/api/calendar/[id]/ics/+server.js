import { fetchCalendarEvents, fetchEventById } from '$lib/helpers/nostrUtils';
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

  const icsContent = generateICSContent(calendarMetadata, allEvents);

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
 * @returns 
 */
function generateICSContent(calendarMetadata, events) {
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

    const startDate = formatDate(startTimestamp);

    // If end is present and valid, use it; otherwise, default to 1 hour after start
    let endTimestamp;
    if (metadata.end && isFinite(Number(metadata.end))) {
      endTimestamp = Number(metadata.end);
    } else {
      endTimestamp = startTimestamp + 3600; // Default 1 hour duration
    }
    const endDate = formatDate(endTimestamp);

    ics.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@edufeed.com`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${escapeText(metadata.title || "Untitled Event")}`,
      `DESCRIPTION:${escapeText(metadata.summary || "")}`,
      metadata.location ? `LOCATION:${escapeText(metadata.location)}` : "",
      `URL:https://edufeed.com/event/${event.id}`,
      `CREATED:${formatDate(event.created_at)}`,
      `LAST-MODIFIED:${formatDate(event.created_at)}`,
      "END:VEVENT"
    );
  });

  ics.push("END:VCALENDAR");

  return ics.filter((line) => line !== "").join("\r\n");
}
