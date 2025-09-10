import { getTagValue } from 'applesauce-core/helpers';
import { loadUserProfile } from './store.svelte';
import { eventStore } from './store.svelte';

export let signer = $state({
	signer: null
});

export let userProfile = $state({
	profile: null
});

export function communityProfile(pubkey /** @type {string} */) {
	let profile = null;
	loadUserProfile(0, pubkey).subscribe((event) => {
		if (event) {
			// console.log('Profile loaded:', event);
			profile = event;
			// console.log("got profile for ", getProfileContent(event).name);
		}
	});
	return profile;
}
