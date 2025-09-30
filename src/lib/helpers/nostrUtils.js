import { nip19 } from "nostr-tools";
import { eventLoader, addressLoader } from "$lib/loaders.js";
import { firstValueFrom } from "rxjs";
import { getCalendarEventStart } from "applesauce-core/helpers";


/**
 * Fetches a Nostr event using various identifier types
 *
 * @param identifier {string} - Can be an event ID, naddr, or other identifier
 * @returns Promise that resolves to the event or null if not found
 */
export const fetchEventById = async (
  identifier
) => {

  try {
    // Handle different identifier types using applesauce loaders
    if (identifier.startsWith("naddr")) {
      // If it's an naddr, decode it to get the components
      try {
        const decoded = nip19.decode(identifier);
        if (decoded.type === "naddr") {
          const data = decoded.data;
          // Use addressLoader for addressable events
          const event$ = addressLoader({
            kind: data.kind,
            pubkey: data.pubkey,
            identifier: data.identifier
          });
          const event = await firstValueFrom(event$);
          return event || null;
        } else {
          throw new Error("Invalid naddr format");
        }
      } catch (error) {
        console.error("Error decoding naddr:", error);
        return null;
      }
    } else if (identifier.startsWith("note")) {
      // If it's a note ID
      try {
        const decoded = nip19.decode(identifier);
        if (decoded.type === "note") {
          // Use eventLoader for event IDs
          const event$ = eventLoader({ id: decoded.data });
          const event = await firstValueFrom(event$);
          return event || null;
        } else {
          throw new Error("Invalid note format");
        }
      } catch (error) {
        console.error("Error decoding note:", error);
        return null;
      }
    } else {
      // Assume it's a raw event ID - use eventLoader
      try {
        const event$ = eventLoader({ id: identifier });
        const event = await firstValueFrom(event$);
        return event || null;
      } catch (error) {
        console.error("Error fetching event by ID:", error);
        return null;
      }
    }
  } catch (error) {
    console.error("Error fetching event:", error);
    return null;
  }
};


/**
 * Fetches and categorizes calendar events from a main calendar event
 *
 * @param {import('nostr-tools').NostrEvent} calendarEvent - The main calendar event (kind 31924)
 * @returns {Promise<{upcoming: import('nostr-tools').NostrEvent[], past: import('nostr-tools').NostrEvent[]}>} Object containing sorted upcoming and past events
 */
export const fetchCalendarEvents = async (
  calendarEvent
) => {
  const now = Math.floor(Date.now() / 1000);
  /** @type {import('nostr-tools').NostrEvent[]} */
  const upcoming = [];
  /** @type {import('nostr-tools').NostrEvent[]} */
  const past = [];
  /** @type {string[]} */
  const deletedEventRefs = [];

  if (!calendarEvent || calendarEvent.kind !== 31924) {
    return { upcoming, past };
  }

  const eventRefs = calendarEvent.tags.filter((/** @type {string[]} */ tag) => tag[0] === "a");
  // could we also use merge from rxjs here?
  const fetchPromises = eventRefs.map(async (/** @type {string[]} */ tag) => {
    const parts = tag[1].split(":");
    if (parts.length < 3) return null;

    const [kindStr, pubkey, dTag] = parts;
    const kind = parseInt(kindStr);

    if (kind !== 31922 && kind !== 31923) return null;

    try {
      // Use addressLoader for addressable calendar events
      const event$ = addressLoader({
        kind: kind,
        pubkey: pubkey,
        identifier: dTag
      });
      const event = await firstValueFrom(event$);

      if (!event) return null;

      // Check for deletion events (NIP-09)
      const isDeleted = await checkForDeletionEvents(
        event,
        pubkey,
        kind,
        dTag
      );

      if (isDeleted) {
        deletedEventRefs.push(tag[1]);
        return null; // Skip deleted events
      }

      const startTime = parseInt(
        event.tags.find((/** @type {string[]} */ t) => t[0] === "start")?.[1] || "0"
      );

      return { event, startTime };
    } catch (error) {
      console.error("Error fetching calendar event:", error);
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);

  results.forEach((result) => {
    if (!result) return;

    if (result.startTime > now) {
      upcoming.push(result.event);
    } else {
      past.push(result.event);
    }
  });

  // If we found deleted events, update the calendar to remove their references
  if (deletedEventRefs.length > 0) {
    removeDeletedEventsFromCalendar(calendarEvent, deletedEventRefs);
  }

  // Sort functions
  /**
   * @param {import('nostr-tools').NostrEvent} a
   * @param {import('nostr-tools').NostrEvent} b
   */
  const sortAsc = (a, b) =>
    (getCalendarEventStart(a) || 0) - (getCalendarEventStart(b) || 0);

  /**
   * @param {import('nostr-tools').NostrEvent} a
   * @param {import('nostr-tools').NostrEvent} b
   */
  const sortDesc = (a, b) =>
    (getCalendarEventStart(b) || 0) - (getCalendarEventStart(a) || 0);

  return {
    upcoming: upcoming.sort(sortAsc),
    past: past.sort(sortDesc),
  };
};

/**
 * Removes deleted event references from a calendar and publishes the updated calendar
 *
 * @param {import('nostr-tools').NostrEvent} calendarEvent - The calendar event to update
 * @param {string[]} deletedEventRefs - Array of deleted event coordinate strings to remove
 */
async function removeDeletedEventsFromCalendar(
  calendarEvent,
  deletedEventRefs
) {
  try {
    console.log(
      `Removing ${deletedEventRefs.length} deleted events from calendar`
    );

    // TODO: Implement calendar update functionality using existing publisher utilities
    // This would require integrating with the publisher.js utilities in the project
    // For now, just log the action that would be taken
    console.log(
      `Would update calendar ${calendarEvent.id} to remove deleted event references:`,
      deletedEventRefs
    );

    // The actual implementation would:
    // 1. Create updated calendar event with filtered tags
    // 2. Use the existing publisher utilities to sign and publish
    // 3. Update the calendar in the EventStore
  } catch (error) {
    console.error("Error updating calendar to remove deleted events:", error);
  }
}

/**
 * Checks if an event has been deleted according to NIP-09
 *
 * @param {import('nostr-tools').NostrEvent} event - The event to check
 * @param {string} pubkey - The event author's public key
 * @param {number} kind - The event kind
 * @param {string} dTag - The d-tag identifier for replaceable events
 * @returns {Promise<boolean>} True if the event has been deleted
 */
async function checkForDeletionEvents(
  event,
  pubkey,
  kind,
  dTag
) {
  try {
    // For now, return false as deletion event checking with applesauce
    // would require more complex timeline loader setup
    // This maintains the same behavior as before (no deletion checking)
    // TODO: Implement proper deletion event checking with applesauce timeline loaders
    console.log(`Checking deletion for event ${event.id} - skipping for now`);
    return false;
  } catch (error) {
    console.error("Error checking for deletion events:", error);
    return false; // On error, assume not deleted
  }
}
