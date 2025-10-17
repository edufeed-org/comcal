import { loadUserProfile } from '$lib/loaders';
import { manager } from '$lib/stores/accounts.svelte';

/**
 * Custom hook for loading and managing user profile data
 * @param {string} [pubkey] - Optional pubkey of the user to load profile for.
 *                           If not provided, uses the active user's pubkey from manager.active
 * @returns {() => any} - Reactive getter function returning the user profile
 */
export function useUserProfile(pubkey) {
	// Store the profile data reactively
	let profile = $state(/** @type {any} */ (null));

	// Create a reactive state for the active account to bridge RxJS to Svelte reactivity
	let activeAccount = $state(manager.active);

	// Subscribe to manager.active$ to keep activeAccount in sync
	$effect(() => {
		const subscription = manager.active$.subscribe((account) => {
			activeAccount = account;
		});
		return () => subscription.unsubscribe();
	});

	// Effect to handle profile loading and subscription management
	$effect(() => {
		// Reset profile when pubkey changes or when active account changes
		profile = null;

		// Determine the target pubkey: use provided pubkey or fallback to active user's pubkey
		const targetPubkey = pubkey || activeAccount?.pubkey;

		if (targetPubkey) {
			// Subscribe to the profile loading observable
			const subscription = loadUserProfile(0, targetPubkey).subscribe((loadedProfile) => {
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
