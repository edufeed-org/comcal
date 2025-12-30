import { fetchCalendarEvents, fetchEventById, encodeEventToNaddr } from '$lib/helpers/nostrUtils';
import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';
import { 
  detectCalendarIdentifierType, 
  fetchCommunityCalendarEvents, 
  getCommunityCalendarMetadata 
} from '$lib/helpers/calendar';
import { nip19 } from 'nostr-tools';
import { env } from '$env/dynamic/private';

/**
 * Safely encode filename for Content-Disposition header
 * Uses RFC 5987 encoding to support Unicode characters
 * @param {string} filename - Original filename
 * @returns {string} - Encoded Content-Disposition value
 */
function encodeFilename(filename) {
  // Remove file extension for processing
  const name = filename.replace(/\.ics$/, '');
  
  // Create ASCII-safe fallback (remove non-ASCII chars)
  const asciiFallback = name.replace(/[^\x20-\x7E]/g, '').trim() || 'calendar';
  
  // Encode for RFC 5987 (UTF-8 percent encoding)
  const encoded = encodeURIComponent(name).replace(/['()]/g, escape);
  
  return `attachment; filename="${asciiFallback}.ics"; filename*=UTF-8''${encoded}.ics`;
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, params }) {
  const { id: calendarIdentifier } = params ?? null;

  if (!calendarIdentifier) {
    return new Response(JSON.stringify({ error: "Calendar ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Detect identifier type
  const identifierType = detectCalendarIdentifierType(calendarIdentifier);

  if (identifierType === 'naddr') {
    // Handle NIP-52 calendar (existing flow)
    return await handleNIP52Calendar(calendarIdentifier, url);
  } else if (identifierType === 'pubkey') {
    // Handle community calendar (new flow)
    return await handleCommunityCalendar(calendarIdentifier, url);
  } else {
    return new Response(JSON.stringify({ error: "Invalid calendar identifier format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Handle NIP-52 calendar ICS generation
 * @param {string} naddr - Calendar naddr identifier
 * @param {URL} url - Request URL
 * @returns {Promise<Response>}
 */
async function handleNIP52Calendar(naddr, url) {
  const calendarEvent = await fetchEventById(naddr);
  const calendarMetadata = getCalendarEventMetadata(calendarEvent);

  if (!calendarEvent || calendarEvent.kind !== 31924) {
    return new Response(JSON.stringify({ error: "Invalid calendar ID or event not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { upcoming, past } = await fetchCalendarEvents(calendarEvent);
  const allEvents = [...upcoming, ...past];

  const icsContent = generateICSContent(
    { title: calendarMetadata.title || '', summary: calendarMetadata.summary || '' },
    allEvents,
    url
  );

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": encodeFilename(calendarMetadata.title || "edufeed-calendar"),
      "Cache-Control": "no-cache, must-revalidate",
      "X-Published-TTL": "PT1H", // Refresh every hour
    },
  });
}

/**
 * Handle community calendar ICS generation
 * @param {string} pubkeyOrNpub - Community pubkey (hex or npub)
 * @param {URL} url - Request URL
 * @returns {Promise<Response>}
 */
async function handleCommunityCalendar(pubkeyOrNpub, url) {
  try {
    // Decode npub to hex if needed
    let communityPubkey = pubkeyOrNpub;
    if (pubkeyOrNpub.startsWith('npub1')) {
      const decoded = nip19.decode(pubkeyOrNpub);
      if (decoded.type === 'npub') {
        communityPubkey = decoded.data;
      } else {
        return new Response(JSON.stringify({ error: "Invalid npub format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Fetch community calendar metadata
    const metadata = await getCommunityCalendarMetadata(communityPubkey);
    
    // Get default relays from environment and combine with community relays
    const defaultRelays = env.RELAYS 
      ? env.RELAYS.split(',').map(r => r.trim()).filter(Boolean) 
      : [];
    const allRelays = [...new Set([...defaultRelays, ...metadata.relays])];
    
    // Fetch community calendar events with combined relays
    const events = await fetchCommunityCalendarEvents(communityPubkey, allRelays);

    if (events.length === 0) {
      console.warn(`No events found for community calendar: ${communityPubkey}`);
    }

    // Generate ICS content
    const icsContent = generateICSContent(
      { title: metadata.title, summary: metadata.summary },
      events,
      url
    );

    return new Response(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": encodeFilename(metadata.title || "community-calendar"),
        "Cache-Control": "no-cache, must-revalidate",
        "X-Published-TTL": "PT1H", // Refresh every hour
      },
    });
  } catch (error) {
    console.error('Error generating community calendar ICS:', error);
    return new Response(JSON.stringify({ error: "Failed to generate community calendar" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * 
 * @param {{title: string, summary: string}} calendarMetadata 
 * @param {import('nostr-tools').NostrEvent[]} events 
 * @param {URL} url - Request URL object for generating event URLs
 * @returns {string}
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
