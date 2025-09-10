import { addressLoader, communikeyTimelineLoader } from '$lib/loaders';
import { eventStore } from '$lib/store.svelte';
import { TimelineModel } from 'applesauce-core/models';

/**
 * Custom hook for loading and managing all communities
 * @returns {() => Array<import('nostr-tools').Event>} - Reactive getter function returning array of all community events
 */
export function useAllCommunities() {
	let allCommunities = $state(/** @type {import('nostr-tools').Event[]} */ ([]));

	// Subscribe to community timeline reactively
	$effect(() => {
		// Reset communities when effect starts
		allCommunities = [];

		const subscription = communikeyTimelineLoader().subscribe((communityEvent) => {
			console.log("Fetched community:", communityEvent);

			// Add the new community event to the array
			allCommunities = [...allCommunities, communityEvent];
		});

		return () => subscription.unsubscribe();
	});

	// Return a getter function that provides reactive access to all communities
	return () => allCommunities;
}
