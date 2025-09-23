<script>
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { useCommunityMembership } from '$lib/stores/joined-communities-list.svelte.js';

	let { profile, communikeyEvent, communikeyContentTypes } = $props();

	const contentTypes = {
		30023: 'long-form-content'
	};

	// Use the reusable community membership hook
	const getJoined = useCommunityMembership(communikeyEvent.pubkey);
</script>

<div class="flex items-center gap-2">
	<div class="avatar">
		<div class="mask w-12 mask-hexagon-2">
			<img src={getProfilePicture(profile)} />
		</div>
	</div>

	<div class="flex gap-2">
		<span>{profile.name}</span>

		<div class="flex flex-wrap">
			{#each communikeyContentTypes as contentType}
				<div class="badge badge-soft badge-primary">{contentType.name}</div>
			{/each}
		</div>

	</div>
	<div class="ml-auto mr-2">
		{#if getJoined()}
			<div class="badge badge-soft badge-success">Joined</div>
		{:else}
			<div class="badge badge-soft badge-outline">Not Joined</div>
		{/if}
	</div>
</div>
