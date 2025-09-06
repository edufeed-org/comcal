<script>
	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	import { profileLoader } from '$lib/store';
	import { getProfileContent, getProfilePicture } from 'applesauce-core/helpers';
	import { writable } from 'svelte/store';
	let profile = writable(null);

	profileLoader({
		kind: 0,
		pubkey: data.pubkey
	}).subscribe({
		next: (event) => {
			console.log('found profile', event);
			profile.set(event);
		},
		complete: () => {
			console.log('complete');
		}
	});
</script>

{#if $profile}
	<p>Hello {getProfileContent($profile).name}</p>
  <img src={getProfilePicture($profile)} alt="Profile" />
{/if}
