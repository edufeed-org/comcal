<script>
	let { account } = $props();

	import { manager } from '$lib/accounts.svelte';
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';

	const getProfile = useUserProfile(account.pubkey);
</script>

<div class="flex w-full items-center rounded-md border border-purple-400 p-2">
	<div tabindex="0" role="button" class="btn avatar btn-circle btn-ghost">
		<div class="w-10 rounded-full">
			<img alt="" src={getProfilePicture(getProfile())} />
		</div>
	</div>
	<li>
		{#if getProfile()?.name}
			{getProfile()?.name}
			{#if account === manager.active}
				(active)
			{/if}
		{/if}
	</li>
</div>
