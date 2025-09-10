import { EventStore, mapEventsToStore } from 'applesauce-core';
import { RelayPool } from 'applesauce-relay';
import { createAddressLoader, createEventLoader } from 'applesauce-loaders/loaders';
import { getProfileContent } from 'applesauce-core/helpers';
import { map, take } from 'rxjs';
import { manager } from './accounts.svelte';

export const eventStore = new EventStore();
export const pool = new RelayPool();
export let communities = $state({ communities: [] });

export const relays = [
	'wss://relay.damus.io',
	'wss://nos.lol',
	'wss://relay.snort.social',
	'wss://theforest.nostr1.com',
	'wss://relay-rpi.edufeed.org'
];

export const profileLoader = createAddressLoader(pool, {
	eventStore,
	lookupRelays: ['wss://purplepag.es/']
});

export function loadUserProfile(kind, pubkey) {
	return profileLoader({ kind, pubkey, relays }).pipe(
		// Take only the first (most recent) profile
		take(1),
		map((event) => getProfileContent(event))
	);
}

export const joinedCommunitiesLoader = createAddressLoader(pool, {
	eventStore,
	lookupRelays: ['wss://theforest.nostr1.com', 'wss://relay-rpi.edufeed.org'],
	extraRelays: ['wss://theforest.nostr1.com', 'wss://relay-rpi.edufeed.org']
});

export function loadRelationships(pubkey, identifier) {
	return joinedCommunitiesLoader({ kind: 30382, pubkey, identifier, relays }).pipe(
		take(1),
		mapEventsToStore(eventStore),
		map((event) => {
			return event;
		})
	);
}

// Create an event loader (do this once at the app level)
export const eventLoader = createEventLoader(pool);

export const addressLoader = createAddressLoader(pool);

eventStore.timeline({ kinds: [10222] }).subscribe();

// make a subscription to relationship events?
manager.active$.subscribe((account) => {
	if (account) {
		const pk = account.pubkey;
		loadRelationships(pk).subscribe();
	}
});
