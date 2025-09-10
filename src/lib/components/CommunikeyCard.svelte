<script>
	let { pubkey } = $props();

	import { getProfilePicture, getProfileContent } from 'applesauce-core/helpers';
	import { useCommunityMembership } from '$lib/stores/community-membership.svelte.js';
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';

	// Use the reusable user profile hook
	const getProfile = useUserProfile(pubkey);

	// Use the reusable community membership hook
	const getJoined = useCommunityMembership(pubkey);
</script>

<div class="card w-96 bg-base-100 shadow-sm">
	<div class="mr-10 ml-auto">
		{#if getJoined()}
			<div class="badge badge-soft badge-success">Joined</div>
		{:else}
			<div class="badge badge-soft badge-outline">Not Joined</div>
		{/if}
	</div>

	<figure class="px-10 pt-4">
		<img
			src={getProfilePicture(getProfile()) || `https://robohash.org/${pubkey}`}
			alt="Shoes"
			class="rounded-xl"
		/>
	</figure>
	<div class="card-body items-center text-center">
		<h2 class="card-title">
			{getProfile()?.name}
		</h2>
		<p>
			{getProfile()?.about || 'No bio available'}
		</p>
		<div class="card-actions">
			<a href={pubkey ? `/c/${pubkey}` : '#'} class="btn btn-primary">Visit</a>
		</div>
	</div>
</div>
