<script>
	import { getDisplayName, getProfilePicture } from 'applesauce-core/helpers';
	import { SettingsIcon } from '$lib/components/icons';
	import { leaveCommunity } from '$lib/helpers/community';
	import { useCommunityMembership } from '$lib/stores/joined-communities-list.svelte.js';
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import { showToast } from '$lib/helpers/toast';
	import { goto } from '$app/navigation';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import CompactCommunityHeader from '$lib/components/community/layout/CompactCommunityHeader.svelte';
	import * as m from '$lib/paraglide/messages';

	let { communityId, communikeyEvent, profileEvent } = $props();

	// Use the reusable community membership hook
	const getJoined = useCommunityMembership(communityId);

	// Get active user for authentication
	const getActiveUser = useActiveUser();
	const activeUser = $derived(getActiveUser());

	// Check if current user is the community owner
	let isOwner = $derived(
		communikeyEvent?.pubkey && activeUser?.pubkey &&
		communikeyEvent.pubkey === activeUser.pubkey
	);

	function handleEditCommunity() {
		modalStore.openModal('editCommunity', { communityEvent: communikeyEvent });
	}

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

<div class="bg-base-100">
	<!-- Community Context Header -->
	{#if profileEvent && communityId}
		<CompactCommunityHeader communityProfile={profileEvent} communityPubkey={communityId} />
	{/if}

	<div class="p-6">
		<div class="container mx-auto max-w-4xl">
			<div class="flex items-center gap-3 mb-6">
				<SettingsIcon class_="w-6 h-6 text-primary" />
				<h1 class="text-2xl font-bold">{m.community_views_settings_title()}</h1>
			</div>

		{#if profileEvent && communikeyEvent}
			<!-- Community Information -->
			<div class="card bg-base-200 shadow-xl mb-6">
				<div class="card-body">
					<h2 class="card-title mb-4">{m.community_views_settings_info_title()}</h2>

					<div class="space-y-4">
						<div class="flex items-center gap-4">
							<div class="avatar">
								<div class="w-16 h-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
									<img
										src={getProfilePicture(profileEvent) || `https://robohash.org/${communityId}`}
										alt={getDisplayName(profileEvent)}
										onerror={(e) => e.target.src = `https://robohash.org/${communityId}`}
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
								<h4 class="font-medium mb-2">{m.community_views_settings_description_label()}</h4>
								<p class="text-base-content/80">{communikeyEvent.content}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Community Actions -->
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body">
					<h2 class="card-title mb-4">{m.community_views_settings_actions_title()}</h2>

					<div class="space-y-3">
						<button
							onclick={handleLeaveClick}
							disabled={isLeaving || !getJoined()}
							class="btn btn-outline btn-error w-full"
						>
							{#if isLeaving}
								<span class="loading loading-spinner loading-xs"></span>
								{m.community_views_settings_leaving()}
							{:else}
								{m.community_views_settings_leave_button()}
							{/if}
						</button>
						<p class="text-xs text-base-content/60 text-center">
							{m.community_views_settings_leave_help()}
						</p>
					</div>
				</div>
			</div>

			<!-- Admin Settings -->
			{#if isOwner}
				<div class="card bg-base-200 shadow-xl mt-6">
					<div class="card-body">
						<h2 class="card-title mb-4">{m.community_views_settings_admin_title?.() || 'Admin Settings'}</h2>
						<p class="text-sm text-base-content/70 mb-4">
							{m.community_views_settings_admin_description?.() || 'As the community owner, you can edit community settings.'}
						</p>

						<div class="space-y-3">
							<button
								onclick={handleEditCommunity}
								class="btn btn-primary w-full"
							>
								{m.community_views_settings_edit_button?.() || 'Edit Community Settings'}
							</button>
							<p class="text-xs text-base-content/60 text-center">
								{m.community_views_settings_edit_help?.() || 'Configure relays, content types, badge requirements, and more.'}
							</p>
						</div>
					</div>
				</div>
			{/if}
		{:else}
			<div class="flex items-center justify-center py-12">
				<div class="loading loading-spinner loading-lg text-primary"></div>
			</div>
		{/if}
		</div>
	</div>
</div>
