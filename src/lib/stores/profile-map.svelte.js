/**
 * Reactive hook for batch profile loading.
 * Uses the Loader + Model pattern: addressLoader fetches from network,
 * eventStore.profile() subscribes to reactive parsed profile data.
 */
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { addressLoader } from '$lib/loaders/base.js';

/**
 * Hook: Subscribe to profiles for a reactive collection of pubkeys.
 * Creates one profile subscription per unique pubkey.
 * Explicitly fetches profiles from relays via addressLoader.
 *
 * @param {() => Iterable<string>} getPubkeys - Reactive getter returning pubkeys to load
 * @returns {() => Map<string, any>} Reactive getter for pubkey → profile Map
 */
export function useProfileMap(getPubkeys) {
	/** @type {Map<string, import('rxjs').Subscription[]>} */
	const subscriptions = new Map();
	const profilesMap = new Map();
	let profiles = $state(/** @type {Map<string, any>} */ (new Map()));
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let updateTimer;

	// Subscribe to new pubkeys as they appear
	$effect(() => {
		for (const pubkey of getPubkeys()) {
			if (subscriptions.has(pubkey)) continue;

			const subs = [];

			// Step 1: Loader — fetch profile from relays → populates EventStore
			const loaderSub = addressLoader({ kind: 0, pubkey }).subscribe();
			subs.push(loaderSub);

			// Step 2: Model — subscribe to parsed profile from EventStore
			const modelSub = eventStore.profile(pubkey).subscribe((profile) => {
				if (profile) {
					profilesMap.set(pubkey, profile);
					clearTimeout(updateTimer);
					updateTimer = setTimeout(() => {
						profiles = new Map(profilesMap);
					}, 50);
				}
			});
			subs.push(modelSub);

			subscriptions.set(pubkey, subs);
		}
	});

	// Cleanup on destroy
	$effect(() => {
		return () => {
			clearTimeout(updateTimer);
			for (const subs of subscriptions.values()) {
				for (const sub of subs) sub.unsubscribe();
			}
			subscriptions.clear();
			profilesMap.clear();
		};
	});

	return () => profiles;
}
