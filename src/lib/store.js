import { EventStore, mapEventsToStore } from "applesauce-core";
import { RelayPool, onlyEvents } from "applesauce-relay";
import { createAddressLoader, createEventLoader, createTimelineLoader } from "applesauce-loaders/loaders";
import { writable, derived } from "svelte/store";
import { getEventUID, getProfileContent } from "applesauce-core/helpers";
import { map, take } from "rxjs";


const eventStore = new EventStore();
const pool = new RelayPool();

const relays = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://theforest.nostr1.com",
  "wss://relay-rpi.edufeed.org"
];

export const communikeyLoader = createTimelineLoader(
  pool,
  relays,
  { kinds: [10222] },
  { eventStore }
)

export const profileLoader = createAddressLoader(
  pool,
  {
    eventStore,
    lookupRelays: ["wss://purplepag.es/"],
  }
);

export function loadUserProfile(kind, pubkey) {
  return profileLoader({ kind, pubkey, relays }).pipe(
    // Take only the first (most recent) profile
    take(1),
    map((event) => getProfileContent(event)),
  );
}

export const joinedCommunitiesLoader = createAddressLoader(
  pool,
  {
    eventStore,
    lookupRelays: ["wss://theforest.nostr1.com", "wss://relay-rpi.edufeed.org"],
    extraRelays: ["wss://theforest.nostr1.com", "wss://relay-rpi.edufeed.org"]
  }
)

export function loadJoinedCommunities(pubkey, identifier) {
  console.log("loading joined communities")
  return joinedCommunitiesLoader({ kind: 30382, pubkey, identifier, relays }).pipe(
    take(1),
    mapEventsToStore(eventStore)
  )
}


// Create an event loader (do this once at the app level)
export const eventLoader = createEventLoader(pool);

export const addressLoader = createAddressLoader(pool);