import { EventFactory } from 'applesauce-factory';
import { publishEventOptimistic } from '$lib/services/publish-service.js';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { getCalendarRelays } from '$lib/helpers/relay-helper.js';

/**
 * Delete a calendar event using NIP-09 deletion
 * @param {any} event - The calendar event to delete (can be raw event or processed)
 * @param {any} activeUser - The active user with signer
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteCalendarEvent(event, activeUser) {
	if (!activeUser || !event) {
		return { success: false, error: 'Missing required parameters' };
	}

	// Determine if we're working with a processed event or raw event
	const kind = event.kind;
	const pubkey = event.pubkey;
	const dTag = event.dTag || event.tags?.find((/** @type {any[]} */ t) => t[0] === 'd')?.[1];

	if (!kind || !pubkey || !dTag) {
		return { success: false, error: 'Invalid event data' };
	}

	// Verify ownership
	if (pubkey !== activeUser.pubkey) {
		return { success: false, error: 'You can only delete your own events' };
	}

	try {
		// Create EventFactory
		const factory = new EventFactory({
			signer: activeUser.signer
		});

		// Use factory.delete() - idiomatic applesauce pattern
		// This properly constructs NIP-09 deletion events for addressable events
		// It handles all necessary tags correctly, similar to how reactions work
		const eventToDelete = event.originalEvent || event;
		console.log('📅 Creating deletion event for:', {
			id: eventToDelete.id,
			kind: eventToDelete.kind,
			pubkey: eventToDelete.pubkey,
			dTag
		});

		const deleteTemplate = await factory.delete([eventToDelete]);
		
		// Sign the deletion event
		const signedDelete = await factory.sign(deleteTemplate);

		console.log('📅 Deletion event created:', {
			id: signedDelete.id,
			kind: signedDelete.kind,
			tags: signedDelete.tags,
			created_at: signedDelete.created_at
		});

		// OPTIMISTIC UI: Add to EventStore IMMEDIATELY
		// This triggers automatic filtering in Models and removes the event from UI instantly
		eventStore.add(signedDelete);
		console.log('✅ Deletion event added to EventStore (optimistic)');

		// Publish in background - user sees instant deletion, toast shows progress
		// Deletions go to user's write relays AND calendar relays so they're found when loading events
		publishEventOptimistic(signedDelete, [], {
			additionalRelays: getCalendarRelays()
		});

		return { success: true };
	} catch (error) {
		console.error('Failed to delete event:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return { success: false, error: errorMessage };
	}
}
