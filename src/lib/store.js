import { EventStore, mapEventsToStore } from "applesauce-core";
import { RelayPool, onlyEvents } from "applesauce-relay";
import { createAddressLoader, createEventLoader, createTimelineLoader } from "applesauce-loaders/loaders";
import { create } from "applesauce-factory";

const pubkey = "1c5ff3caacd842c01dca8f378231b16617516d214da75c7aeabbe9e1efe9c0f6";

const eventStore = new EventStore();
const pool = new RelayPool();
const eventLoader = createEventLoader(pool, { eventStore });


const relays = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.snort.social"
];

export const loader = createTimelineLoader(
  pool,
  ["wss://relay.damus.io "],
  { kinds: [1], authors: [pubkey] },
  { eventStore },
)

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
)