import { nip19 } from "nostr-tools";
import { eventLoader, addressLoader } from "$lib/loaders.js";
import { firstValueFrom } from "rxjs";


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
