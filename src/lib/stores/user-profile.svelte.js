import { ProfileModel } from 'applesauce-core/models';
import { profileLoader } from '$lib/loaders/profile.js';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { runtimeConfig } from '$lib/stores/config.svelte.js';
import { useActiveUser } from '$lib/stores/accounts.svelte';

/**
 * Custom hook for loading and managing user profile data using the loader + model pattern.
 * This ensures reactive updates when profiles change (e.g., via EditProfileModal).
 * 
 * @param {string} [pubkey] - Optional pubkey of the user to load profile for.
 *                           If not provided, uses the active user's pubkey from manager.active
 * @returns {() => any} - Reactive getter function returning the user profile
 */
export function useUserProfile(pubkey) {
	// Store the profile data reactively
	let profile = $state(/** @type {any} */ (null));

	// Use the proper hook for active user
	const getActiveUser = useActiveUser();

	// Effect to handle profile loading and subscription management
	// Uses the loader + model pattern for reactive updates
	$effect(() => {
		// Reset profile when pubkey changes or when active account changes
		profile = null;

		// Determine the target pubkey: use provided pubkey or fallback to active user's pubkey
		const targetPubkey = pubkey || getActiveUser()?.pubkey;

		if (targetPubkey) {
			// 1. Trigger loader to fetch from relays and populate eventStore
			const loaderSub = profileLoader({
				kind: 0,
				pubkey: targetPubkey,
				relays: runtimeConfig.fallbackRelays || []
			}).subscribe(() => {
				// Loader automatically populates eventStore
			});

			// 2. Subscribe to model for reactive parsed profile from eventStore
			const modelSub = eventStore
				.model(ProfileModel, targetPubkey)
				.subscribe((profileContent) => {
					profile = profileContent;
				});

			// Return cleanup function to unsubscribe from both
			return () => {
				loaderSub.unsubscribe();
				modelSub.unsubscribe();
			};
		}
	});

	// Return a getter function that provides reactive access to the profile
	return () => profile;
}
