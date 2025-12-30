/**
 * Comment helper functions for NIP-22 comments
 * Handles creating and deleting comments
 */
import { EventFactory } from 'applesauce-factory';
import { publishEvent } from './publisher.js';
import { manager } from '$lib/stores/accounts.svelte.js';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { runtimeConfig } from '$lib/stores/config.svelte.js';

/**
 * Delete a comment event using NIP-09 deletion
 * 
 * @param {any} commentEvent - The comment event to delete
 * @param {Object} [options] - Optional configuration
 * @param {string[]} [options.relays] - Relay hints for deletion event
 * @returns {Promise<{success: boolean, event: any, results: any}>}
 */
export async function deleteComment(commentEvent, options = {}) {
	const account = manager.active;
	
	if (!account?.signer) {
		throw new Error('No account or signer available');
	}
	
	if (commentEvent.pubkey !== account.pubkey) {
		throw new Error('Cannot delete comment from another user');
	}
	
	// Create EventFactory with the signer
	const factory = new EventFactory({
		signer: account.signer
	});
	
	// Use factory.delete() to create proper NIP-09 deletion event
	const deleteEventTemplate = await factory.delete([commentEvent]);
	
	// Sign the deletion event
	const deleteEvent = await factory.sign(deleteEventTemplate);
	
	const result = await publishEvent(deleteEvent, {
		relays: options.relays || runtimeConfig.calendar.defaultRelays,
		addToStore: true,
		logPrefix: 'Comments'
	});
	
	// Explicitly add deletion event to EventStore after successful publish
	// This triggers automatic removal of the referenced comment event
	// and updates all subscriptions (including CommentsModel)
	if (result.success) {
		eventStore.add(deleteEvent);
	}
	
	return {
		...result,
		event: deleteEvent
	};
}
