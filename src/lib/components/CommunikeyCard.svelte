<script>
	let { pubkey } = $props();

	import { loadUserProfile } from '$lib/store.svelte';
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { userJoinedCommunity } from '$lib/shared.svelte';
	import { communities } from '$lib/store.svelte';

	/**
	 * User profile state either null or an applesauce profile 
	 */
	let userProfile = $state(null);

	loadUserProfile(0, pubkey).subscribe((profile) => {
		if (profile) {
			userProfile = profile;
		}
	});

	const joined = $derived.by(() => {
		return userJoinedCommunity(pubkey);
	});
</script>

<div class="card w-96 bg-base-100 shadow-sm">
	<p>
		Joined: {joined}
	</p>

	<figure class="px-10 pt-10">
		<img
			src={getProfilePicture(userProfile) || `https://robohash.org/${pubkey}`}
			alt="Shoes"
			class="rounded-xl"
		/>
	</figure>
	<div class="card-body items-center text-center">
		<h2 class="card-title">
			{userProfile?.name}
		</h2>
		<p>
			{userProfile?.about || 'No bio available'}
		</p>
		<div class="card-actions">
			<a href={pubkey ? `/c/${pubkey}` : '#'} class="btn btn-primary">Visit</a>
		</div>
	</div>
</div>
