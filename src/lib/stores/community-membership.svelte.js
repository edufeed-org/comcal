import { manager } from '$lib/accounts.svelte';
import { eventStore } from '$lib/store.svelte';
import { getTagValue } from 'applesauce-core/helpers';

/**
 * Custom hook for checking community membership status
 * @param {string} communityPubkey - The pubkey of the community to check membership for
 * @returns {() => boolean} - Reactive getter function indicating if current user has joined the community
 */
export function useCommunityMembership(communityPubkey) {
	// Bridge RxJS observable to Svelte reactivity
	let activeUser = $state(
		/** @type {import('applesauce-accounts').IAccount | undefined} */ (undefined)
	);

	// Store the actual event data, not the subscription/observable
	let relationshipEvent = $state(
		/** @type {import('nostr-tools').Event | null | undefined} */ (null)
	);

	// Derive joined status from current state
	let joined = $derived(() => {
		if (!activeUser?.pubkey || !communityPubkey) {
			return false;
		}

		if (relationshipEvent) {
			const relationship = getTagValue(relationshipEvent, 'n');
			const community = getTagValue(relationshipEvent, 'd');
			// Check if this is a follow relationship for this community
			return community === communityPubkey && relationship === 'follow';
		}

		return false;
	});

	// Effect 1: Handle user authentication changes
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});

		return () => subscription.unsubscribe();
	});

	// Effect 2: Handle relationship subscription based on user and community changes
	$effect(() => {
		// Reset relationship event when dependencies change
		relationshipEvent = null;

		if (activeUser?.pubkey && communityPubkey) {
			// Subscribe to the relationship observable and update state
			const relationshipSubscription = eventStore
				.replaceable(30382, activeUser.pubkey, communityPubkey)
				.subscribe((event) => {
					relationshipEvent = event; // Store the actual event data
				});

			return () => relationshipSubscription.unsubscribe();
		}
	});

	// Return a getter function that provides reactive access to the joined state
	return () => joined();
}
