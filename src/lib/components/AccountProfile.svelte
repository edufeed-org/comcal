<script>
	let { account } = $props();

	import { manager } from '$lib/accounts.svelte';
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';

	const getProfile = useUserProfile(account.pubkey);

	// Reactive state for active account to trigger re-renders
	let activeAccount = $state(manager.active);

	// Subscribe to active account changes
	$effect(() => {
		const subscription = manager.active$.subscribe((account) => {
			activeAccount = account;
		});
		return () => subscription.unsubscribe();
	});
</script>

<div class="flex w-full items-center rounded-md border border-purple-400 p-2">
	<div tabindex="0" role="button" class="btn avatar btn-circle btn-ghost">
		<div class="w-10 rounded-full">
			<img
				alt=""
				src={getProfilePicture(getProfile()) || `https://robohash.org/${account.pubkey}`}
			/>
		</div>
	</div>
	<li>
		{getProfile()?.name || account.pubkey.slice(0, 8) + '...'}

		{#if account === activeAccount}
			(active)
		{/if}
	</li>
	<button
		class="btn mr-2 ml-auto"
		disabled={account === activeAccount}
		onclick={() => manager.setActive(account)}
	>
		{account === activeAccount ? 'Active' : 'Set Active'}
	</button>
</div>
