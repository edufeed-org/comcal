<script>
	import CommunikeyCard from '$lib/components/CommunikeyCard.svelte';
	import { useAllCommunities } from '$lib/stores/all-communities.svelte.js';
	import { useJoinedCommunitiesList } from '$lib/stores/joined-communities-list.svelte.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { manager } from '$lib/accounts.svelte';
	import { useActiveUser } from '$lib/stores/accounts.svelte';

	const getAllCommunities = useAllCommunities();
	const getJoinedCommunities = useJoinedCommunitiesList();
	const activeUser = useActiveUser()
</script>

<svelte:head>
	<title>Nostr Feed - Communikey</title>
	<meta name="description" content="Real-time Nostr feed powered by SvelteKit" />
</svelte:head>

<div class="flex flex-row gap-8">
	<!-- Sidebar -->
	<div class="w-1/4">
		<div class="flex justify-between items-center mb-4">
			<h2>Joined Communities</h2>
			{#if activeUser()}
				<button
					class="btn btn-primary btn-sm"
					onclick={() => modalStore.openModal('createCommunity')}
				>
					New Group
				</button>
			{/if}
		</div>
		<div class="space-y-2">
			{#each getJoinedCommunities() as community}
				<div class="card bg-base-100 shadow-sm p-3">
					<div class="flex items-center gap-2">
						<div class="avatar">
							<div class="w-8 rounded-full">
								<img src={`https://robohash.org/${community.pubkey}`} alt="Community" />
							</div>
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">
								{community.pubkey.slice(0, 8)}...
							</p>
						</div>
						<a href={`/c/${community.pubkey}`} class="btn btn-xs btn-primary">Visit</a>
					</div>
				</div>
			{/each}
			{#if getJoinedCommunities().length === 0}
				<p class="text-sm text-base-content/60">No joined communities yet</p>
			{/if}
		</div>
	</div>
	<div class="w-3/4">
		<div class="flex flex-wrap gap-2">
			{#each getAllCommunities() as community}
				<CommunikeyCard pubkey={community.pubkey} />
			{/each}
		</div>
	</div>
</div>
