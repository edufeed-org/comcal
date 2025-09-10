import { loadUserProfile } from '$lib/store.svelte';

/**
 * Custom hook for loading and managing user profile data
 * @param {string} pubkey - The pubkey of the user to load profile for
 * @returns {() => any} - Reactive getter function returning the user profile
 */
export function useUserProfile(pubkey) {
	// Store the profile data reactively
	let profile = $state(
		/** @type {any} */ (null)
	);

	// Effect to handle profile loading and subscription management
	$effect(() => {
		// Reset profile when pubkey changes
		profile = null;

		if (pubkey) {
			// Subscribe to the profile loading observable
			const subscription = loadUserProfile(0, pubkey).subscribe((loadedProfile) => {
				if (loadedProfile) {
					profile = loadedProfile;
				}
			});

			// Return cleanup function to unsubscribe
			return () => subscription.unsubscribe();
		}
	});

	// Return a getter function that provides reactive access to the profile
	return () => profile;
}
