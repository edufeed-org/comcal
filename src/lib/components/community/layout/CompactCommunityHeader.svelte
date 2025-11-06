<script>
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { useCommunityMembership } from '$lib/stores/joined-communities-list.svelte.js';

	/**
	 * @typedef {Object} Props
	 * @property {any} communityProfile - Community profile data with name, avatar, etc.
	 * @property {string} communityPubkey - Community pubkey for membership status
	 * @property {boolean} [hideJoinedBadge] - Optional: Hide the "Joined" badge
	 */

	/** @type {Props} */
	let { communityProfile, communityPubkey, hideJoinedBadge = false } = $props();

	// Use the reusable community membership hook with reactive pubkey
	const getJoined = useCommunityMembership(communityPubkey);

	// Derive display name and avatar
	let displayName = $derived(
		communityProfile?.name || 
		communityProfile?.display_name || 
		'Community'
	);
	
	let avatarUrl = $derived(getProfilePicture(communityProfile));
</script>

<div class="flex items-center gap-3 px-4 py-3 bg-base-200 border-b border-base-300">
	<!-- Community Avatar -->
	<div class="avatar">
		<div class="w-10 rounded-full ring-2 ring-base-300">
			<img src={avatarUrl} alt={displayName} class="object-cover" />
		</div>
	</div>

	<!-- Community Name -->
	<div class="flex-1 min-w-0">
		<h2 class="text-sm font-semibold text-base-content truncate">
			{displayName}
		</h2>
	</div>

	<!-- Joined Badge (optional) -->
	{#if !hideJoinedBadge && getJoined()}
		<div class="badge badge-success badge-sm gap-1">
			<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
				<path 
					fill-rule="evenodd" 
					d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
					clip-rule="evenodd"
				/>
			</svg>
			Joined
		</div>
	{/if}
</div>
