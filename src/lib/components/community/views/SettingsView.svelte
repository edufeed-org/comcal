<script>
	import { getDisplayName, getProfilePicture } from 'applesauce-core/helpers';
	import { SettingsIcon } from '$lib/components/icons';
	import { leaveCommunity } from '$lib/helpers/community';
	import { useCommunityMembership } from '$lib/stores/joined-communities-list.svelte.js';
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import { showToast } from '$lib/helpers/toast';
	import { goto } from '$app/navigation';
	import CompactCommunityHeader from '$lib/components/community/layout/CompactCommunityHeader.svelte';

	let { communityId, communikeyEvent, profileEvent } = $props();

	// Use the reusable community membership hook
	const getJoined = useCommunityMembership(communityId);
	
	// Get active user for authentication
	const getActiveUser = useActiveUser();
	const activeUser = $derived(getActiveUser());

	let isLeaving = $state(false);

	async function handleLeaveClick() {
		if (!activeUser) {
			showToast('Please login to leave communities', 'error');
			return;
		}

		if (isLeaving) return;

		isLeaving = true;
		try {
			const result = await leaveCommunity(communityId);
			if (result.success) {
				showToast('Left community', 'success');
				// Redirect to discover page after leaving
				await goto('/discover');
			} else {
				showToast(result.error || 'Failed to leave community', 'error');
			}
		} catch (error) {
			console.error('Error leaving community:', error);
			showToast('An error occurred', 'error');
		} finally {
			isLeaving = false;
		}
	}
</script>

<div class="min-h-screen bg-base-100">
	<!-- Community Context Header -->
	{#if profileEvent && communityId}
		<CompactCommunityHeader communityProfile={profileEvent} communityPubkey={communityId} />
	{/if}

	<div class="p-6">
		<div class="container mx-auto max-w-4xl">
			<div class="flex items-center gap-3 mb-6">
				<SettingsIcon class_="w-6 h-6 text-primary" />
				<h1 class="text-2xl font-bold">Community Settings</h1>
			</div>

		{#if profileEvent && communikeyEvent}
			<!-- Community Information -->
			<div class="card bg-base-200 shadow-xl mb-6">
				<div class="card-body">
					<h2 class="card-title mb-4">Community Information</h2>
					
					<div class="space-y-4">
						<div class="flex items-center gap-4">
							<div class="avatar">
								<div class="w-16 h-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
									<img
										src={getProfilePicture(profileEvent) || `https://robohash.org/${communityId}`}
										alt={getDisplayName(profileEvent)}
									/>
								</div>
							</div>
							<div>
								<h3 class="font-semibold text-lg">{getDisplayName(profileEvent)}</h3>
								<p class="text-sm text-base-content/60">Community ID: {communityId.slice(0, 16)}...</p>
							</div>
						</div>

						{#if communikeyEvent?.content}
							<div>
								<h4 class="font-medium mb-2">Description</h4>
								<p class="text-base-content/80">{communikeyEvent.content}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Community Actions -->
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body">
					<h2 class="card-title mb-4">Actions</h2>
					
					<div class="space-y-3">
						<button
							onclick={handleLeaveClick}
							disabled={isLeaving || !getJoined()}
							class="btn btn-outline btn-error w-full"
						>
							{#if isLeaving}
								<span class="loading loading-spinner loading-xs"></span>
								Leaving...
							{:else}
								Leave Community
							{/if}
						</button>
						<p class="text-xs text-base-content/60 text-center">
							You can rejoin this community later if you change your mind.
						</p>
					</div>
				</div>
			</div>

			<!-- Admin Settings (Future) -->
			<!-- This section would show admin controls if user is community admin -->
		{:else}
			<div class="flex items-center justify-center py-12">
				<div class="loading loading-spinner loading-lg text-primary"></div>
			</div>
		{/if}
		</div>
	</div>
</div>
