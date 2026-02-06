import { EventFactory } from 'applesauce-core/event-factory';
import { manager } from '$lib/stores/accounts.svelte';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { publishEvent } from '$lib/services/publish-service.js';
import { getPrimaryWriteRelay } from '$lib/services/relay-service.svelte.js';

/**
 * Join a community by creating a relationship event (kind 30382)
 * @param {string} communityPubkey - The pubkey of the community to join
 * @param {Object} [options] - Optional configuration
 * @param {string[]} [options.relays] - Relays to publish to
 * @returns {Promise<{success: boolean, event?: any, error?: string}>}
 */
export async function joinCommunity(communityPubkey, options = {}) {
	const account = manager.active;

	if (!account?.signer) {
		return { success: false, error: 'No account or signer available. Please login first.' };
	}

	if (!communityPubkey) {
		return { success: false, error: 'Community pubkey is required' };
	}

	try {
		const factory = new EventFactory({ signer: account.signer });

		// Get relay hint for the community for discoverability
		const relayHint = await getPrimaryWriteRelay(communityPubkey);

		// Create relationship event (kind 30382)
		// Tags: d (identifier), n (relationship type), p (community pubkey with relay hint)
		const relationshipEventTemplate = {
			kind: 30382,
			content: '',
			tags: [
				['d', communityPubkey], // Use community pubkey as identifier
				['n', 'follow'], // Relationship type: follow
				['p', communityPubkey, relayHint] // Reference to community with relay hint
			],
			created_at: Math.floor(Date.now() / 1000)
		};

		const signedEvent = await factory.sign(relationshipEventTemplate);

		// Publish using outbox model + communikey relays (for kind 30382)
		const result = await publishEvent(signedEvent, [communityPubkey], {
			additionalRelays: options.relays || []
		});

		if (result.success) {
			// Add to EventStore to trigger automatic updates
			eventStore.add(signedEvent);
		}

		return { ...result, event: signedEvent };
	} catch (error) {
		console.error('Failed to join community:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred'
		};
	}
}

/**
 * Leave a community by deleting the relationship event
 * @param {string} communityPubkey - The pubkey of the community to leave
 * @param {Object} [options] - Optional configuration
 * @param {string[]} [options.relays] - Relays to publish to
 * @returns {Promise<{success: boolean, event?: any, error?: string}>}
 */
export async function leaveCommunity(communityPubkey, options = {}) {
	const account = manager.active;

	if (!account?.signer) {
		return { success: false, error: 'No account or signer available. Please login first.' };
	}

	if (!communityPubkey) {
		return { success: false, error: 'Community pubkey is required' };
	}

	try {
		// Use model to find the relationship event to delete
		const { CommunityRelationshipModel } = await import('$lib/models/community-relationship');
		
		const relationshipEvents = await new Promise((resolve) => {
			eventStore
				.model(CommunityRelationshipModel, account.pubkey)
				.subscribe({
					next: (events) => {
						resolve(events);
					},
					error: () => {
						resolve([]);
					}
				});
		});

		// Find the specific relationship event for this community
		const relationshipEvent = relationshipEvents.find((/** @type {any} */ event) => {
			const dTag = event.tags.find((/** @type {any} */ tag) => tag[0] === 'd')?.[1];
			return dTag === communityPubkey;
		});

		if (!relationshipEvent) {
			return { success: false, error: 'No relationship found to delete' };
		}

		const factory = new EventFactory({ signer: account.signer });

		// Create deletion event (kind 5)
		const deleteEventTemplate = await factory.delete([relationshipEvent]);
		const deleteEvent = await factory.sign(deleteEventTemplate);

		// Publish deletion using outbox model
		const result = await publishEvent(deleteEvent, [], {
			additionalRelays: options.relays || []
		});

		if (result.success) {
			eventStore.add(deleteEvent);
		}

		return { ...result, event: deleteEvent };
	} catch (error) {
		console.error('Failed to leave community:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred'
		};
	}
}
