<script>
	let { pubkey, showJoinButton = false } = $props();

	import * as m from '$lib/paraglide/messages';
	import { getProfilePicture, getProfileContent } from 'applesauce-core/helpers';
	import { useCommunityMembership } from '$lib/stores/joined-communities-list.svelte.js';
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import BookmarkIcon from '$lib/components/icons/social/BookmarkIcon.svelte';
	import { hexToNpub } from '$lib/helpers/nostrUtils';
	import { joinCommunity, leaveCommunity } from '$lib/helpers/community';
	import { showToast } from '$lib/helpers/toast';

	// Use the reusable user profile hook
	const getProfile = useUserProfile(pubkey);

	// Use the reusable community membership hook
	const getJoined = useCommunityMembership(pubkey);
	
	// Get active user for authentication
	const getActiveUser = useActiveUser();
	const activeUser = $derived(getActiveUser());

	let isJoining = $state(false);

	async function handleJoinClick(/** @type {MouseEvent} */ e) {
		e.preventDefault();
		e.stopPropagation();

		if (!activeUser) {
			showToast(m.communikey_card_toast_login_required(), 'error');
			return;
		}

		if (isJoining) return;

		isJoining = true;
		try {
			if (getJoined()) {
				const result = await leaveCommunity(pubkey);
				if (result.success) {
					showToast(m.communikey_card_toast_left(), 'success');
				} else {
					showToast(result.error || m.communikey_card_toast_left_failed(), 'error');
				}
			} else {
				const result = await joinCommunity(pubkey);
				if (result.success) {
					showToast(m.communikey_card_toast_joined(), 'success');
				} else {
					showToast(result.error || m.communikey_card_toast_joined_failed(), 'error');
				}
			}
		} catch (error) {
			console.error('Error toggling community membership:', error);
			showToast(m.communikey_card_toast_error(), 'error');
		} finally {
			isJoining = false;
		}
	}
</script>

<a href={pubkey ? `/c/${hexToNpub(pubkey) || pubkey}` : '#'} class="card bg-base-100 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 flex flex-col items-center gap-3 justify-center p-6 rounded-xl border {getJoined() ? 'border-emerald-500/30 bg-emerald-50/5 dark:bg-emerald-950/10' : 'border-base-200'} hover:border-primary/20 min-w-[240px]">
	<div class="absolute top-3 right-3 z-10">
		{#if getJoined()}
			<div class="bg-emerald-500 shadow-sm border border-emerald-600/20 rounded-full w-6 h-6 flex items-center justify-center">
				<BookmarkIcon class_="w-3 h-3 text-white" title={m.communikey_card_joined_badge()} />
			</div>
		{:else}
			<!-- <div class="bg-base-200 text-base-content/70 text-xs font-medium px-2 py-1 rounded-md shadow-sm border border-base-300/50 hover:bg-base-300/50 transition-colors duration-200">
				Join
			</div> -->
		{/if}
	</div>

	<figure class="mb-3">
		<img
			src={getProfilePicture(getProfile()) || `https://robohash.org/${pubkey}`}
			alt={m.communikey_card_profile_alt()}
			class="rounded-full object-cover w-24 h-24 ring-2 ring-base-300 hover:ring-primary/50 transition-colors duration-300"
		/>
	</figure>
	<div class="card-body items-center text-center p-0 w-full">
		<h2 class="card-title text-xl font-semibold text-base-content hover:text-primary transition-colors duration-300 mb-2">
			{getProfile()?.name || m.communikey_card_unknown_user()}
		</h2>
		<p class="text-sm text-base-content/70 w-full leading-relaxed relative" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; mask-image: linear-gradient(to bottom, black 0%, black 70%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 0%, black 70%, transparent 100%);" title={getProfile()?.about || m.communikey_card_no_bio()}>
			{getProfile()?.about || m.communikey_card_no_bio()}
		</p>
		
		{#if showJoinButton && activeUser}
			<button
				onclick={handleJoinClick}
				disabled={isJoining}
				class="btn btn-sm mt-3 w-full {getJoined() ? 'btn-outline' : 'btn-primary'}"
			>
				{#if isJoining}
					<span class="loading loading-spinner loading-xs"></span>
				{:else if getJoined()}
					{m.communikey_card_button_leave()}
				{:else}
					{m.communikey_card_button_join()}
				{/if}
			</button>
		{/if}
	</div>
</a>
