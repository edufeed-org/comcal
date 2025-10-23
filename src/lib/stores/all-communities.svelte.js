import { communikeyTimelineLoader } from '$lib/loaders';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';

// Global state that persists across page navigations
let globalCommunities = $state(/** @type {import('nostr-tools').Event[]} */ ([]));
/** @type {{ unsubscribe: () => void } | null} */
let globalSubscription = null;

/**
 * Custom hook for loading and managing all communities
 * Uses EventStore's automatic replaceable event handling for kind 10222
 * @returns {() => Array<import('nostr-tools').Event>} - Reactive getter function returning array of all community events
 */
export function useAllCommunities() {
	// Initialize global subscription only once
	if (!globalSubscription) {
		// Bootstrap EventStore with community loader (feeds events into EventStore)
		const loaderSubscription = communikeyTimelineLoader().subscribe();

		// Use EventStore timeline for reactive data loading
		// EventStore automatically handles replaceable event logic (kind 10222 is replaceable: 10000-19999)
		// This ensures only one event per pubkey is kept (the most recent one)
		const timelineSubscription = eventStore.timeline({
			kinds: [10222]
		}).subscribe({
			next: (/** @type {import('nostr-tools').Event[]} */ events) => {
				console.log('📋 AllCommunities: Loaded community events:', events.length);
				globalCommunities = events;
			},
			error: (/** @type {any} */ error) => {
				console.error('📋 AllCommunities: Error loading community events:', error);
				globalCommunities = [];
			}
		});

		// Store combined subscription for cleanup
		globalSubscription = {
			unsubscribe: () => {
				loaderSubscription.unsubscribe();
				timelineSubscription.unsubscribe();
			}
		};
	}

	// Return a getter function that provides reactive access to all communities
	return () => globalCommunities;
}
