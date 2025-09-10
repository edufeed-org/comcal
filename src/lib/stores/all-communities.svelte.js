import { communikeyTimelineLoader } from '$lib/loaders';

// Global state that persists across page navigations
let globalCommunities = $state(/** @type {import('nostr-tools').Event[]} */ ([]));
let globalSubscription = null;

/**
 * Custom hook for loading and managing all communities
 * @returns {() => Array<import('nostr-tools').Event>} - Reactive getter function returning array of all community events
 */
export function useAllCommunities() {
	// Initialize global subscription only once
	if (!globalSubscription) {
		globalSubscription = communikeyTimelineLoader().subscribe((communityEvent) => {
			// Check if community already exists to avoid duplicates
			const exists = globalCommunities.some(c => c.id === communityEvent.id);
			if (!exists) {
				globalCommunities = [...globalCommunities, communityEvent];
			}
		});
	}

	// Return a getter function that provides reactive access to all communities
	return () => globalCommunities;
}
