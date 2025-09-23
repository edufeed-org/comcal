<script>
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import { getDisplayName, getTagValue } from 'applesauce-core/helpers';
	import { useJoinedCommunitiesList } from '$lib/stores/joined-communities-list.svelte.js';
	import { userProfile } from '$lib/shared.svelte';
	import { useUserProfile } from '$lib/stores/user-profile.svelte';

	const activeUser = useActiveUser();
	const getJoinedCommunities = useJoinedCommunitiesList(); // gets the getter function
	const joinedCommunities = $derived(getJoinedCommunities()); // reactive value

	
</script>

<!-- Sidebar -->
<div class="mb-4 flex items-center justify-between">
	<h2>Joined Communities</h2>
	{#if activeUser()}
		<button class="btn btn-sm btn-primary" onclick={() => modalStore.openModal('createCommunity')}>
			New Group
		</button>
	{/if}
</div>

<div class="space-y-2">
	{#each joinedCommunities as community}
		{@const communityPubKey = getTagValue(community, 'd')}
		{@const getCommunityProfile = useUserProfile(communityPubKey)}
		{@const communityProfile = getCommunityProfile()}
		<div class="card bg-base-100 p-3 shadow-sm">
			<div class="flex items-center gap-2">
				<div class="avatar">
					<div class="w-8 rounded-full">
						<img src={`https://robohash.org/${getTagValue(community, 'd')}`} alt="Community" />
					</div>
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium">
						{getDisplayName(communityProfile)}
					</p>
				</div>
				<a href={`/c/${communityPubKey}`} class="btn btn-xs btn-primary">Visit</a>
			</div>
		</div>
	{/each}
	{#if joinedCommunities.length === 0}
		<p class="text-sm text-base-content/60">No joined communities yet</p>
	{/if}
</div>
