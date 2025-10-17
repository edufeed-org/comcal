import { manager } from '$lib/stores/accounts.svelte';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { getTagValue } from 'applesauce-core/helpers';
import { useAllCommunities } from './all-communities.svelte.js';
import { relationshipTimelineLoader } from '$lib/loaders.js';

/**
 * Custom hook for loading and managing joined communities list
 * Uses EventStore intelligence for efficient reactive updates
 * @returns {() => Array<import('nostr-tools').Event>} - Function returning reactive derived state with array of joined community events
 */
export function useJoinedCommunitiesList() {
	let activeUser = $state(manager.active);
	let relationshipEvents = $state(/** @type {import('nostr-tools').Event[]} */ ([]));

	const getAllCommunities = useAllCommunities();

	// Subscribe to account changes
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

	// Load relationship events when user changes
	$effect(() => {
		if (!activeUser?.pubkey) {
			relationshipEvents = [];
			return;
		}

		// Bootstrap EventStore with relationship loader (similar to CalendarView pattern)
		const loaderSubscription = relationshipTimelineLoader().subscribe();

		// Use EventStore timeline for reactive data loading
		const subscription = eventStore.timeline({
			kinds: [30382], // Relationship events
			authors: [activeUser.pubkey],
			limit: 100
		}).subscribe({
			next: (/** @type {import('nostr-tools').Event[]} */ events) => {
				console.log('📋 JoinedCommunities: Loaded relationship events:', events.length);
				relationshipEvents = events;
			},
			error: (/** @type {any} */ error) => {
				console.error('📋 JoinedCommunities: Error loading relationship events:', error);
				relationshipEvents = [];
			}
		});

		return () => {
			subscription.unsubscribe();
			loaderSubscription.unsubscribe();
		};
	});

	// Derive joined communities reactively - filter relationship events for 'follow' relationships
	const joinedCommunities = $derived.by(() => {
		if (!activeUser?.pubkey || !relationshipEvents.length) {
			return [];
		}

		// Filter relationship events to only include 'follow' relationships
		return relationshipEvents.filter(event => {
			const relationship = getTagValue(event, 'n');
			return relationship === 'follow';
		});
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
