import { manager } from '$lib/accounts.svelte';
import { eventStore } from '$lib/store.svelte';
import { getTagValue } from 'applesauce-core/helpers';
import { useAllCommunities } from './all-communities.svelte.js';

/**
 * Custom hook for loading and managing joined communities list
 * @returns {() => Array<import('nostr-tools').Event>} - Reactive getter function returning array of joined community events
 */
export function useJoinedCommunitiesList() {
	let joinedCommunities = $state([]);
	let activeUser = $state(manager.active);

	const getAllCommunities = useAllCommunities();

	// Subscribe to account changes
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

	// Update joined communities when user or communities change
	$effect(() => {
		if (!activeUser?.pubkey) {
			joinedCommunities = [];
			return;
		}

		const communities = getAllCommunities();
		joinedCommunities = []; // Reset first

		const subscriptions = [];

		// For each community, subscribe to relationship events reactively
		for (const community of communities) {
			const subscription = eventStore
				.replaceable(30382, activeUser.pubkey, community.pubkey)
				.subscribe((relationshipEvent) => {
					if (relationshipEvent) {
						const relationship = getTagValue(relationshipEvent, 'n');
						if (relationship === 'follow') {
							// Add to joined communities if not already present
							const exists = joinedCommunities.some(c => c.pubkey === community.pubkey);
							if (!exists) {
								joinedCommunities = [...joinedCommunities, community];
							}
						} else {
							// Remove from joined communities if relationship changed
							joinedCommunities = joinedCommunities.filter(c => c.pubkey !== community.pubkey);
						}
					}
				});

			subscriptions.push(subscription);
		}

		// Cleanup subscriptions
		return () => {
			subscriptions.forEach(sub => sub.unsubscribe());
		};
	});

	// Return a getter function that provides reactive access to joined communities
	return () => joinedCommunities;
}
