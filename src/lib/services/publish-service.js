/**
 * Unified Publishing Service with NIP-65 outbox model support
 *
 * Publishing flow:
 * 1. Outbox model: author's write relays + tagged users' read relays
 * 2. App-specific relays: based on event kind (calendar, communikey, educational)
 * 3. Community relays: if event targets a community (h-tag present)
 */
import { pool } from '$lib/stores/nostr-infrastructure.svelte.js';
import { getPublishRelays, getPrimaryWriteRelay } from './relay-service.svelte.js';
import { getAppRelaysForCategory, kindToAppRelayCategory } from './app-relay-service.js';
import { getRelaysForKind, getCommunityGlobalRelays } from '$lib/helpers/communityRelays.js';
import { manager } from '$lib/stores/accounts.svelte.js';

/**
 * Publish an event using outbox model + app relays + community relays
 *
 * @param {Object} signedEvent - The signed Nostr event
 * @param {string[]} taggedPubkeys - Array of pubkeys tagged in the event (p tags)
 * @param {Object} opts - Options
 * @param {number} opts.timeout - Timeout per relay in ms (default 15000)
 * @param {Object} opts.communityEvent - Community definition event (kind 10222) if community-targeted
 * @param {string[]} opts.additionalRelays - Additional relays to publish to
 * @returns {Promise<{success: boolean, relays: string[], successCount: number}>}
 */
export async function publishEvent(signedEvent, taggedPubkeys = [], opts = {}) {
	const { timeout = 15000, communityEvent = null, additionalRelays = [] } = opts;
	const relaySet = new Set();

	// 1. Outbox model: author's write relays + tagged users' read relays
	const outboxRelays = await getPublishRelays(signedEvent.pubkey, taggedPubkeys);
	outboxRelays.forEach((r) => relaySet.add(r));

	// 2. App-specific relay for content type
	const category = kindToAppRelayCategory(signedEvent.kind);
	if (category) {
		getAppRelaysForCategory(category).forEach((r) => relaySet.add(r));
	}

	// 3. If community-targeted, add community's relays
	if (communityEvent) {
		// Add communikey app relay (for discoverability)
		getAppRelaysForCategory('communikey').forEach((r) => relaySet.add(r));

		// Add community's relays for this content type
		getRelaysForKind(communityEvent, signedEvent.kind).forEach((r) => relaySet.add(r));

		// Add community's global relays
		getCommunityGlobalRelays(communityEvent).forEach((r) => relaySet.add(r));
	}

	// 4. Additional relays (explicit)
	additionalRelays.forEach((r) => relaySet.add(r));

	const publishRelays = Array.from(relaySet);

	// Publish to all calculated relays with timeout
	const publishPromises = publishRelays.map(async (relayUrl) => {
		try {
			const relay = pool.relay(relayUrl);

			// Authenticate if we have a signer (NIP-42)
			if (manager.active?.signer) {
				try {
					await relay.authenticate(manager.active.signer);
				} catch (authErr) {
					// Auth failed or not required - continue with publish
				}
			}

			await relay.publish(signedEvent, { timeout });
			return { relay: relayUrl, success: true };
		} catch (err) {
			console.warn(`Failed to publish to ${relayUrl}:`, err);
			return { relay: relayUrl, success: false, error: err };
		}
	});

	const results = await Promise.allSettled(publishPromises);
	const successCount = results.filter(
		(r) => r.status === 'fulfilled' && r.value.success
	).length;

	return {
		success: successCount > 0,
		relays: publishRelays,
		successCount,
		results: results.map((r) => (r.status === 'fulfilled' ? r.value : { success: false }))
	};
}

/**
 * Publish an event in the background (fire-and-forget)
 * Calls onComplete callback when done with results
 *
 * @param {Object} signedEvent - The signed Nostr event
 * @param {string[]} taggedPubkeys - Array of pubkeys tagged in the event (p tags)
 * @param {Function} onComplete - Callback with publish result
 * @param {Object} opts - Options passed to publishEvent
 */
export function publishEventInBackground(signedEvent, taggedPubkeys = [], onComplete, opts = {}) {
	publishEvent(signedEvent, taggedPubkeys, opts)
		.then((result) => {
			if (onComplete) onComplete(result);
		})
		.catch((error) => {
			console.error('Background publish failed:', error);
			if (onComplete) onComplete({ success: false, relays: [], successCount: 0, error });
		});
}

/**
 * Build p tags with relay hints for recipients
 * @param {string[]} recipientPubkeys - Array of recipient pubkeys
 * @returns {Promise<string[][]>} Array of p tags with relay hints
 */
export async function buildPTagsWithHints(recipientPubkeys) {
	return Promise.all(
		recipientPubkeys.map(async (pubkey) => {
			const relayHint = await getPrimaryWriteRelay(pubkey);
			return ['p', pubkey, relayHint];
		})
	);
}

/**
 * Build an e tag with relay hint
 * @param {string} eventId - Event ID to reference
 * @param {string} authorPubkey - Author of the referenced event
 * @returns {Promise<string[]>} e tag with relay hint
 */
export async function buildETagWithHint(eventId, authorPubkey) {
	const relayHint = await getPrimaryWriteRelay(authorPubkey);
	return ['e', eventId, relayHint];
}

/**
 * Build an a tag with relay hint for addressable events
 * @param {string} address - Addressable event coordinate (e.g., "30009:pubkey:identifier")
 * @returns {Promise<string[]>} a tag with relay hint
 */
export async function buildATagWithHint(address) {
	// Extract pubkey from address (format: "kind:pubkey:identifier")
	const parts = address.split(':');
	if (parts.length >= 2) {
		const pubkey = parts[1];
		const relayHint = await getPrimaryWriteRelay(pubkey);
		return ['a', address, relayHint];
	}
	return ['a', address];
}
