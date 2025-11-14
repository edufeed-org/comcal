import { manager } from '$lib/stores/accounts.svelte';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { getTagValue } from 'applesauce-core/helpers';
import { createRelationshipLoader } from '$lib/loaders/community';
import { CommunityRelationshipModel } from '$lib/models/community-relationship';

/**
 * Custom hook for loading and managing joined communities list
 * Uses loader + model pattern for efficient reactive updates
 * @returns {() => Array<import('nostr-tools').Event>} - Function returning reactive array of joined community events
 */
export function useJoinedCommunitiesList() {
	let activeUser = $state(manager.active);
	let joinedCommunities = $state(/** @type {import('nostr-tools').Event[]} */ ([]));

	// Subscribe to account changes
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

	// Load relationship events using loader + model pattern
	$effect(() => {
		if (!activeUser?.pubkey) {
			joinedCommunities = [];
			return;
		}

		// 1. Bootstrap EventStore with author-specific relationship loader (fetches from relays)
		const loaderSubscription = createRelationshipLoader(activeUser.pubkey)().subscribe();

		// 2. Subscribe to model for reactive filtered data from EventStore
		const modelSubscription = eventStore
			.model(CommunityRelationshipModel, activeUser.pubkey)
			.subscribe((events) => {
				joinedCommunities = events;
			});

		return () => {
			loaderSubscription.unsubscribe();
			modelSubscription.unsubscribe();
		};
	});

	// Return a function that provides reactive access to joined communities
	return () => joinedCommunities;
}

/**
 * Custom hook for checking community membership status
 * @param {string} communityPubkey - The pubkey of the community to check membership for
 * @returns {() => boolean} - Reactive getter function indicating if current user has joined the community
 */
export function useCommunityMembership(communityPubkey) {
	const getJoinedCommunities = useJoinedCommunitiesList();

	// Derive joined status from current state
	const joined = $derived.by(() => {
		if (!communityPubkey) {
			return false;
		}

		const joinedCommunities = getJoinedCommunities();
		return joinedCommunities.some(event => {
			const community = getTagValue(event, 'd');
			return community === communityPubkey;
		});
	});

	// Return a getter function that provides reactive access to the joined state
	return () => joined;
}
