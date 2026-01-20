/**
 * Relay Settings Service - Save NIP-65 relay preferences
 */

import { publishEvent } from './publish-service.js';
import { invalidateRelayListCache } from './relay-service.svelte.js';
import { manager } from '$lib/stores/accounts.svelte.js';

/**
 * Save relay list by publishing a kind 10002 event
 * @param {Array<{url: string, read: boolean, write: boolean}>} relays - Relay configuration
 * @param {string} userPubkey - User's public key
 * @returns {Promise<Object>} The signed and published event
 */
export async function saveRelayList(relays, userPubkey) {
	if (!manager.active?.signer) {
		throw new Error('No signer available. Please login first.');
	}

	if (!relays || relays.length === 0) {
		throw new Error('At least one relay is required');
	}

	// Build r tags based on read/write preferences
	const tags = relays.map((relay) => {
		const tag = ['r', relay.url];

		// If both read and write, no marker needed
		if (relay.read && relay.write) {
			return tag;
		}

		// If only read, add "read" marker
		if (relay.read && !relay.write) {
			tag.push('read');
			return tag;
		}

		// If only write, add "write" marker
		if (!relay.read && relay.write) {
			tag.push('write');
			return tag;
		}

		// If neither (shouldn't happen), default to both
		return tag;
	});

	// Create the event (kind 10002 - replaceable)
	const event = {
		kind: 10002,
		pubkey: userPubkey,
		created_at: Math.floor(Date.now() / 1000),
		tags,
		content: ''
	};

	try {
		// Sign the event with applesauce-accounts signer
		const signedEvent = await manager.active.signer.signEvent(event);

		// Invalidate cache BEFORE publishing so we use the new relays
		invalidateRelayListCache(userPubkey);

		// Publish using the outbox model
		const result = await publishEvent(signedEvent);

		if (!result.success) {
			throw new Error('Failed to publish to any relay');
		}

		return signedEvent;
	} catch (error) {
		console.error('Failed to save relay list:', error);
		throw new Error('Failed to save relay list: ' + error.message);
	}
}

/**
 * Validate a relay URL
 * @param {string} url - Relay URL to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateRelayUrl(url) {
	if (!url || typeof url !== 'string') {
		return { valid: false, error: 'URL is required' };
	}

	const trimmed = url.trim();

	if (!trimmed.startsWith('wss://') && !trimmed.startsWith('ws://')) {
		return { valid: false, error: 'URL must start with wss:// or ws://' };
	}

	try {
		new URL(trimmed);
		return { valid: true };
	} catch {
		return { valid: false, error: 'Invalid URL format' };
	}
}

/**
 * Parse a relay list event (kind 10002) into a structured format
 * @param {Object} event - The kind 10002 event
 * @returns {Array<{url: string, read: boolean, write: boolean}>}
 */
export function parseRelayListEvent(event) {
	if (!event || !event.tags) return [];

	return event.tags
		.filter((tag) => tag[0] === 'r')
		.map((tag) => {
			const url = tag[1];
			const marker = tag[2];

			return {
				url,
				read: !marker || marker === 'read',
				write: !marker || marker === 'write'
			};
		});
}
