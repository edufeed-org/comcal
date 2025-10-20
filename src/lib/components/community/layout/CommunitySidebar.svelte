<script>
	import { getDisplayName, getProfilePicture, getTagValue } from 'applesauce-core/helpers';
	import { useJoinedCommunitiesList } from '$lib/stores/joined-communities-list.svelte.js';
	import { useUserProfile } from '$lib/stores/user-profile.svelte';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { PlusIcon } from '$lib/components/icons';

	let { selectedCommunityId = $bindable(), onCommunitySelect } = $props();

	const getJoinedCommunities = useJoinedCommunitiesList();
	const joinedCommunities = $derived(getJoinedCommunities());

	/**
	 * Handle community selection
	 * @param {string} pubkey
	 */
	function handleCommunityClick(pubkey) {
		if (onCommunitySelect) {
			onCommunitySelect(pubkey);
		}
	}

	function handleCreateCommunity() {
		modalStore.openModal('createCommunity');
	}
</script>

<!-- Desktop: Fixed left sidebar -->
<div class="hidden lg:flex flex-col w-16 bg-base-200 border-r border-base-300 h-[calc(100vh-4rem)] fixed left-0 top-16 overflow-y-auto overflow-x-hidden">
	<div class="flex flex-col items-center py-4 space-y-3">
		{#each joinedCommunities.sort() as community}
			{@const communityPubKey = getTagValue(community, 'd') || ''}
			{@const getCommunityProfile = useUserProfile(communityPubKey)}
			{@const communityProfile = getCommunityProfile()}
			{@const isActive = selectedCommunityId === communityPubKey}
			
			{#if communityPubKey}
				<div class="tooltip tooltip-right" data-tip={getDisplayName(communityProfile)}>
					<button
						onclick={() => handleCommunityClick(communityPubKey)}
					class="btn btn-ghost btn-circle w-12 h-12 p-0 hover:scale-110 transition-transform duration-200 {isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-base-200' : ''}"
				>
					<div class="avatar">
						<div class="w-12 h-12 rounded-full">
							<img
								src={getProfilePicture(communityProfile) || `https://robohash.org/${communityPubKey}`}
								alt={getDisplayName(communityProfile)}
								class="rounded-full object-cover"
							/>
						</div>
					</div>
					</button>
				</div>
			{/if}
		{/each}
	</div>

	<!-- Spacer to push + button to bottom -->
	<div class="flex-1"></div>

	<!-- Create Community Button -->
	<div class="flex justify-center py-4 border-t border-base-300">
		<div class="tooltip tooltip-right" data-tip="Create Community">
			<button
				onclick={handleCreateCommunity}
				class="btn btn-circle btn-primary btn-sm w-10 h-10"
			>
				<PlusIcon class_="w-5 h-5" />
			</button>
		</div>
	</div>
</div>

<!-- Mobile: Drawer content (will be used inside drawer in AppLayout) -->
<div class="lg:hidden flex flex-col w-full bg-base-200 h-full">
	<div class="p-4 border-b border-base-300">
		<h2 class="text-lg font-semibold">Communities</h2>
	</div>
	
	<div class="flex-1 overflow-y-auto p-4 space-y-2">
		{#each joinedCommunities.sort() as community}
			{@const communityPubKey = getTagValue(community, 'd') || ''}
			{@const getCommunityProfile = useUserProfile(communityPubKey)}
			{@const communityProfile = getCommunityProfile()}
			{@const isActive = selectedCommunityId === communityPubKey}
			
			{#if communityPubKey}
				<button
					onclick={() => handleCommunityClick(communityPubKey)}
				class="flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-200 {isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}"
			>
				<div class="avatar">
					<div class="w-10 h-10 rounded-full">
						<img
							src={getProfilePicture(communityProfile) || `https://robohash.org/${communityPubKey}`}
							alt={getDisplayName(communityProfile)}
							class="rounded-full object-cover"
						/>
					</div>
				</div>
				<span class="text-sm font-medium truncate flex-1 text-left">
					{getDisplayName(communityProfile)}
				</span>
				</button>
			{/if}
		{/each}

		{#if joinedCommunities.length === 0}
			<div class="text-center py-8 text-base-content/60">
				<p class="text-sm mb-2">No joined communities yet</p>
				<p class="text-xs">Create or join a community to get started</p>
			</div>
		{/if}
	</div>

	<!-- Create Community Button -->
	<div class="p-4 border-t border-base-300">
		<button
			onclick={handleCreateCommunity}
			class="btn btn-primary w-full"
		>
			<PlusIcon class_="w-5 h-5" />
			Create Community
		</button>
	</div>
</div>
