/**
 * Reaction helper functions for NIP-25 reactions
 * Handles creating, publishing, and deleting reactions
 */
import { EventFactory } from 'applesauce-factory';
import { publishEvent } from './publisher.js';
import { manager } from '$lib/stores/accounts.svelte.js';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { runtimeConfig } from '$lib/stores/config.svelte.js';

/**
 * Check if an event is addressable (replaceable)
 * @param {any} event - The event to check
 * @returns {boolean}
 */
function isAddressableEvent(event) {
	return event.kind >= 30000 && event.kind < 40000;
}

/**
 * Get the addressable coordinate for an event (kind:pubkey:d-tag)
 * @param {any} event - The event
 * @returns {string|null}
 */
function getEventAddress(event) {
	if (!isAddressableEvent(event)) return null;
	
	const dTag = event.tags.find((/** @type {any} */ tag) => tag[0] === 'd');
	const dValue = dTag ? dTag[1] : '';
	
	return `${event.kind}:${event.pubkey}:${dValue}`;
}

/**
 * Create a NIP-25 reaction event
 * 
 * @param {any} targetEvent - The event being reacted to
 * @param {string} content - The reaction content (emoji, +, -, etc.)
 * @param {Object} [options] - Optional configuration
 * @param {string[]} [options.relays] - Relay hints
 * @returns {Promise<any>} The signed reaction event
 */
export async function createReaction(targetEvent, content, options = {}) {
	const account = manager.active;
	
	if (!account?.signer) {
		throw new Error('No account or signer available');
	}
	
	const relays = options.relays || runtimeConfig.fallbackRelays || [];
	const mainRelay = relays[0] || '';
	
	// Build tags according to NIP-25
	const tags = [];
	
	// Always add 'e' tag with event id
	tags.push(['e', targetEvent.id, mainRelay, targetEvent.pubkey]);
	
	// Add 'p' tag for the event author
	tags.push(['p', targetEvent.pubkey, mainRelay]);
	
	// For addressable events, add 'a' tag
	if (isAddressableEvent(targetEvent)) {
		const address = getEventAddress(targetEvent);
		if (address) {
			tags.push(['a', address, mainRelay, targetEvent.pubkey]);
		}
	}
	
	// Add 'k' tag with the kind of the reacted event
	tags.push(['k', String(targetEvent.kind)]);
	
	// Create EventFactory with the signer
	const factory = new EventFactory({
		signer: account.signer
	});
	
	// Build the unsigned event
	const unsignedEvent = await factory.build({
		kind: 7, // NIP-25 reaction kind
		content: content || '+', // Default to "like" if no content
		tags
	});
	
	// Sign the event using EventFactory
	const signedEvent = await factory.sign(unsignedEvent);
	
	return signedEvent;
}

/**
 * Publish a reaction to an event
 * 
 * @param {any} targetEvent - The event to react to
 * @param {string} content - The reaction content (emoji, +, -, etc.)
 * @param {Object} [options] - Publishing options
 * @param {string[]} [options.relays] - Custom relay list
 * @returns {Promise<{success: boolean, event: any, results: any}>}
 */
export async function publishReaction(targetEvent, content, options = {}) {
	try {
		// Create the reaction event
		const reactionEvent = await createReaction(targetEvent, content, options);
		
		// Publish it
		const result = await publishEvent(reactionEvent, {
			relays: options.relays || runtimeConfig.fallbackRelays || [],
			addToStore: true,
			logPrefix: 'Reactions'
		});
		
		return {
			...result,
			event: reactionEvent
		};
	} catch (error) {
		console.error('Failed to publish reaction:', error);
		throw error;
	}
}

/**
 * Delete a reaction event
 * Uses idiomatic applesauce pattern with factory.delete() and EventStore
 * 
 * @param {any} reactionEvent - The reaction event to delete
 * @param {Object} [options] - Publishing options
 * @param {string[]} [options.relays] - Custom relay list
 * @returns {Promise<{success: boolean, event: any, results: any}>}
 */
export async function deleteReaction(reactionEvent, options = {}) {
	const account = manager.active;
	
	if (!account?.signer) {
		throw new Error('No account or signer available');
	}
	
	if (reactionEvent.pubkey !== account.pubkey) {
		throw new Error('Cannot delete reaction from another user');
	}
	
	// Create EventFactory with the signer
	const factory = new EventFactory({
		signer: account.signer
	});
	
	// Use factory.delete() to create proper deletion event (idiomatic applesauce pattern)
	const deleteEventTemplate = await factory.delete([reactionEvent]);
	
	// Sign the deletion event
	const deleteEvent = await factory.sign(deleteEventTemplate);
	
	const result = await publishEvent(deleteEvent, {
		relays: options.relays || runtimeConfig.fallbackRelays || [],
		addToStore: true,
		logPrefix: 'Reactions'
	});
	
	// Explicitly add deletion event to EventStore after successful publish
	// This triggers automatic removal of the referenced reaction event
	// and updates all subscriptions (including ReactionsModel)
	if (result.success) {
		eventStore.add(deleteEvent);
	}
	
	return {
		...result,
		event: deleteEvent
	};
}

/**
 * Normalize reaction content for display
 * Converts + to ❤️ and - to 👎
 * 
 * @param {string} content - The raw reaction content
 * @returns {string} Normalized emoji
 */
export function normalizeReactionContent(content) {
	const trimmed = content.trim();
	
	if (trimmed === '+' || trimmed === '') {
		return '❤️';
	}
	
	if (trimmed === '-') {
		return '👎';
	}
	
	return trimmed;
}
