import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { getProfilePicture } from 'applesauce-core/helpers';
import { nip19 } from 'nostr-tools';

/**
 * Fetch profile data for a given npub or pubkey
 * @param {string} identifier - Either an npub or hex pubkey
 * @returns {Promise<Object>} Profile data with fallbacks
 */
export async function fetchProfileData(identifier) {
	try {
		// Convert npub to pubkey if needed
		let pubkey = identifier;
		if (identifier.startsWith('npub')) {
			const decoded = nip19.decode(identifier);
			pubkey = String(decoded.data);
		}

		// Simple promise that resolves when we get profile data or times out
		return new Promise((resolve, reject) => {
			let resolved = false;
			
			const subscription = eventStore.profile(pubkey).subscribe((event) => {
				if (event && !resolved) {
					resolved = true;
					subscription.unsubscribe();
					
					try {
						const profileContent = event;
						let profilePicture = `https://robohash.org/${pubkey}`;
						
						// Use getProfilePicture which works with both events and parsed content
						try {
							profilePicture = getProfilePicture(profileContent) || profilePicture;
						} catch (picError) {
							// Use fallback if getProfilePicture fails
						}

						const profileData = {
							npub: identifier.startsWith('npub') ? identifier : nip19.npubEncode(pubkey),
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
						
						resolve(profileData);
					} catch (error) {
						console.warn('Error parsing profile content:', error);
						resolve({
							npub: identifier.startsWith('npub') ? identifier : nip19.npubEncode(pubkey),
							pubkey,
							name: 'Anonymous',
							about: '',
							picture: `https://robohash.org/${pubkey}`,
							website: '',
							nip05: '',
							lud16: '',
							banner: '',
							event
						});
					}
				}
			});

			// Clean timeout - resolve with fallback if no data received
			setTimeout(() => {
				if (!resolved) {
					resolved = true;
					subscription.unsubscribe();
					resolve({
						npub: identifier.startsWith('npub') ? identifier : nip19.npubEncode(pubkey),
						pubkey,
						name: 'Anonymous',
						about: '',
						picture: `https://robohash.org/${pubkey}`,
						website: '',
						nip05: '',
						lud16: '',
						banner: '',
						event: null
					});
				}
			}, 2000); // 2 second timeout
		});
	} catch (error) {
		console.error('Error fetching profile data:', error);
		// Return fallback data on error
		return {
			npub: identifier,
			pubkey: identifier,
			name: 'Anonymous',
			about: '',
			picture: `https://robohash.org/${identifier}`,
			website: '',
			nip05: '',
			lud16: '',
			banner: '',
			event: null
		};
	}
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
