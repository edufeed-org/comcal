<script>
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import { getDisplayName, getTagValue, getProfilePicture } from 'applesauce-core/helpers';
	import { useJoinedCommunitiesList } from '$lib/stores/joined-communities-list.svelte.js';
	import { userProfile } from '$lib/shared.svelte';
	import { useUserProfile } from '$lib/stores/user-profile.svelte';

	const activeUser = useActiveUser();
	const getJoinedCommunities = useJoinedCommunitiesList(); // gets the getter function
	const joinedCommunities = $derived(getJoinedCommunities()); // reactive value

	
</script>

<!-- Sidebar -->
<div class="mb-4 flex items-center justify-between">
	<h2 class="text-base font-semibold text-base-content">Joined Communities</h2>
	{#if activeUser()}
		<button class="btn btn-sm btn-primary hover:btn-primary-focus transition-colors duration-200" onclick={() => modalStore.openModal('createCommunity')}>
			New Group
		</button>
	{/if}
</div>

<div class="space-y-2">
	{#each joinedCommunities.sort() as community}
		{@const communityPubKey = getTagValue(community, 'd')}
		{@const getCommunityProfile = useUserProfile(communityPubKey)}
		{@const communityProfile = getCommunityProfile()}
		<a href={`/c/${communityPubKey}`} class="flex bg-base-100 p-3 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer transform hover:scale-[1.02] items-center gap-2 rounded-lg border border-base-200 hover:border-primary/20">
			<div class="avatar">
				<div class="w-8 h-8 rounded-full ring-2 ring-base-300 hover:ring-primary/50 transition-colors duration-300">
					<img src={getProfilePicture(communityProfile) || `https://robohash.org/${getTagValue(community, 'd')}`} alt="Community" class="rounded-full object-cover" />
				</div>
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium text-base-content hover:text-primary transition-colors duration-300">
					{getDisplayName(communityProfile)}
				</p>
			</div>
		</a>
	{/each}
	{#if joinedCommunities.length === 0}
		<div class="text-center py-6 px-3">
			<p class="text-sm text-base-content/60 mb-2">No joined communities yet</p>
			<p class="text-xs text-base-content/40">Join communities to see them here</p>
		</div>
	{/if}
</div>
