import { profileLoader } from '$lib/loaders/profile.js';
import { runtimeConfig } from '$lib/stores/config.svelte.js';
import { getProfilePicture, getProfileContent } from 'applesauce-core/helpers';
import { nip19 } from 'nostr-tools';
import { take, timeout, catchError, map, firstValueFrom } from 'rxjs';
import { of } from 'rxjs';

/**
 * Fetch profile data for a given npub or pubkey
 * Uses the loader pattern with RxJS operators
 * @param {string} identifier - Either an npub or hex pubkey
 * @returns {Promise<Object>} Profile data with fallbacks
 */
export async function fetchProfileData(identifier) {
	// Convert npub to pubkey if needed, but preserve the original npub
	let pubkey = identifier;
	let npub = identifier;
	
	try {
		if (identifier.startsWith('npub')) {
			const decoded = nip19.decode(identifier);
			pubkey = String(decoded.data);
			npub = identifier; // Keep the original npub
		} else {
			// If given a pubkey, create the npub
			npub = nip19.npubEncode(identifier);
		}
	} catch (error) {
		console.error('Error decoding identifier:', error);
		// Return fallback if we can't decode
		return createFallbackProfile(identifier, identifier);
	}

	// Use the loader pattern with RxJS operators
	return firstValueFrom(
		profileLoader({
			kind: 0,
			pubkey,
			relays: runtimeConfig.calendar.defaultRelays
		}).pipe(
			// Take only the first profile event
			take(1),
			// Timeout after 2 seconds
			timeout(2000),
			// Transform event to profile data
			map((event) => {
				// Extract profile content from event
				const profileContent = getProfileContent(event);
				let profilePicture = `https://robohash.org/${pubkey}`;
				
				// Use getProfilePicture which works with both events and parsed content
				try {
					profilePicture = getProfilePicture(event) || profilePicture;
				} catch {
					// Use fallback if getProfilePicture fails
				}

				return {
					npub,
					pubkey,
					name: profileContent?.name || profileContent?.display_name || 'Anonymous',
					about: profileContent?.about || '',
					picture: profilePicture,
					website: profileContent?.website || '',
					nip05: profileContent?.nip05 || '',
					lud16: profileContent?.lud16 || '',
					banner: profileContent?.banner || '',
					event
				};
			}),
			// Handle errors and timeouts with fallback
			catchError((error) => {
				console.warn('Profile fetch error or timeout:', error);
				return of(createFallbackProfile(npub, pubkey));
			})
		)
	);
}

/**
 * Create fallback profile data
 * @param {string} npub - User's npub
 * @param {string} pubkey - User's pubkey
 * @returns {Object} Fallback profile data
 */
function createFallbackProfile(npub, pubkey) {
	return {
		npub,
		pubkey,
		name: 'Anonymous',
		about: '',
		picture: `https://robohash.org/${pubkey}`,
		website: '',
		nip05: '',
		lud16: '',
		banner: '',
		event: null
	};
}

/**
 * Fetch profile data for multiple npubs/pubkeys
 * @param {string[]} identifiers - Array of npubs or pubkeys
 * @returns {Promise<Object[]>} Array of profile data
 */
export async function fetchMultipleProfiles(identifiers) {
	const promises = identifiers.map(identifier => fetchProfileData(identifier));
	return Promise.all(promises);
}
