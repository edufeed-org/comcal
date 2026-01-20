import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { runtimeConfig } from '$lib/stores/config.svelte.js';

/**
 * Generic event publishing utility for Nostr events
 * Publishes signed events to configured relays and handles responses
 * 
 * @param {any} signedEvent - The signed Nostr event to publish
 * @param {Object} [options] - Publishing options
 * @param {string[]} [options.relays] - Custom relay list (defaults to app relays)
 * @param {boolean} [options.addToStore] - Whether to add to eventStore (default: true)
 * @param {string} [options.logPrefix] - Prefix for console logs (default: 'Publisher')
 * @returns {Promise<{success: boolean, results: any[], successfulRelays: string[], failedRelays: string[]}>}
 */
export async function publishEvent(signedEvent, options = {}) {
	const {
		relays: customRelays = runtimeConfig.fallbackRelays || [],
		addToStore = true,
		logPrefix = 'Publisher'
	} = options;

	try {
		console.log(`${logPrefix}: Publishing event kind ${signedEvent.kind} to ${customRelays.length} relays`);
		
		// Publish to all configured relays
		const responses = await pool.publish(customRelays, signedEvent);
		
		// Analyze responses
		const successfulResponses = responses.filter(r => r.ok);
		const failedResponses = responses.filter(r => !r.ok);
		
		const successfulRelays = successfulResponses.map(r => r.from);
		const failedRelays = failedResponses.map(r => r.from);
		
		const hasSuccess = successfulResponses.length > 0;
		
		if (hasSuccess) {
			// Add to local event store for immediate UI updates
			if (addToStore) {
				eventStore.add(signedEvent);
			}
			
			console.log(`${logPrefix}: Successfully published to ${successfulRelays.length}/${customRelays.length} relays:`, successfulRelays);
			
			if (failedRelays.length > 0) {
				console.warn(`${logPrefix}: Failed to publish to ${failedRelays.length} relays:`, failedRelays);
			}
		} else {
			console.error(`${logPrefix}: Failed to publish to any relay:`, failedResponses);
		}
		
		return {
			success: hasSuccess,
			results: responses,
			successfulRelays,
			failedRelays
		};
		
	} catch (error) {
		console.error(`${logPrefix}: Error during publishing:`, error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new Error(`Failed to publish event: ${errorMessage}`);
	}
}

/**
 * Publish multiple events in sequence
 * Useful for publishing related events (like metadata + contacts)
 * 
 * @param {any[]} signedEvents - Array of signed events to publish
 * @param {Object} [options] - Publishing options (same as publishEvent)
 * @returns {Promise<{success: boolean, results: any[], allSuccessful: boolean}>}
 */
export async function publishEvents(signedEvents, options = {}) {
	const results = [];
	let allSuccessful = true;
	
	for (const event of signedEvents) {
		try {
			const result = await publishEvent(event, options);
			results.push(result);
			
			if (!result.success) {
				allSuccessful = false;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			results.push({
				success: false,
				error: errorMessage,
				event
			});
			allSuccessful = false;
		}
	}
	
	const overallSuccess = results.some(r => r.success);
	
	return {
		success: overallSuccess,
		results,
		allSuccessful
	};
}
