<script>
	let { account } = $props();

	import { manager } from '$lib/accounts.svelte';
	import { loadUserProfile } from '$lib/store.svelte.js';
	import { getProfilePicture } from 'applesauce-core/helpers';

	let userProfile = $state(null);

	loadUserProfile(0, account.pubkey).subscribe((profile) => {
		if (profile) {
			console.log('Profile loaded:', profile);
			userProfile = profile;
		}
	});
</script>

<div class="flex w-full items-center rounded-md border border-purple-400 p-2">
	<div tabindex="0" role="button" class="btn avatar btn-circle btn-ghost">
		<div class="w-10 rounded-full">
			<img alt="" src={getProfilePicture(userProfile)} />
		</div>
	</div>
	<li>
		{#if userProfile?.name}
			{userProfile?.name}
			{#if account === manager.active}
				(active)
			{/if}
		{/if}
	</li>
</div>
