import { EventStore } from 'applesauce-core';
import { RelayPool } from 'applesauce-relay';

export const eventStore = new EventStore();
export const pool = new RelayPool();


export const relays = [
	'wss://relay.damus.io',
	'wss://nos.lol',
	'wss://relay.snort.social',
	'wss://theforest.nostr1.com',
	'wss://relay-rpi.edufeed.org'
];
