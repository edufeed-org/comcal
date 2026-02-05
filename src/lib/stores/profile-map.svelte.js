/**
 * Reactive hook for batch profile loading.
 * Relies on EventStore's replaceableLoader (wired in base.js)
 * which internally batches with bufferTime: 1000ms, bufferSize: 200.
 */
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { ProfileModel } from 'applesauce-core/models';

/**
 * Hook: Subscribe to profiles for a reactive collection of pubkeys.
 * Creates one ProfileModel subscription per unique pubkey.
 * Auto-loads from network via replaceableLoader when not cached.
 *
 * @param {() => Iterable<string>} getPubkeys - Reactive getter returning pubkeys to load
 * @returns {() => Map<string, any>} Reactive getter for pubkey → profile Map
 */
export function useProfileMap(getPubkeys) {
	/** @type {Map<string, import('rxjs').Subscription>} */
	const subscriptions = new Map();
	const profilesMap = new Map();
	let profiles = $state(/** @type {Map<string, any>} */ (new Map()));
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let updateTimer;

	// Subscribe to new pubkeys as they appear
	$effect(() => {
		for (const pubkey of getPubkeys()) {
			if (subscriptions.has(pubkey)) continue;

			const sub = eventStore.model(ProfileModel, { pubkey }).subscribe((profile) => {
				if (profile) {
					profilesMap.set(pubkey, profile);
					clearTimeout(updateTimer);
					updateTimer = setTimeout(() => {
						profiles = new Map(profilesMap);
					}, 50);
				}
			});
			subscriptions.set(pubkey, sub);
		}
	});

	// Cleanup on destroy
	$effect(() => {
		return () => {
			clearTimeout(updateTimer);
			for (const sub of subscriptions.values()) sub.unsubscribe();
			subscriptions.clear();
			profilesMap.clear();
		};
	});

	return () => profiles;
}
