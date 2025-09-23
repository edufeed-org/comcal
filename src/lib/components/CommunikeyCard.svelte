<script>
	let { pubkey } = $props();

	import { getProfilePicture, getProfileContent } from 'applesauce-core/helpers';
	import { useCommunityMembership } from '$lib/stores/joined-communities-list.svelte.js';
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
	import BookmarkIcon from '$lib/components/icons/social/BookmarkIcon.svelte';

	// Use the reusable user profile hook
	const getProfile = useUserProfile(pubkey);

	// Use the reusable community membership hook
	const getJoined = useCommunityMembership(pubkey);
</script>

<a href={pubkey ? `/c/${pubkey}` : '#'} class="card w-48 bg-base-100 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 flex flex-col items-center gap-2 justify-center p-4 rounded-xl border border-base-200 hover:border-primary/20">
	<div class="absolute top-3 right-3 z-10">
		{#if getJoined()}
			<div class="bg-emerald-500 shadow-sm border border-emerald-600/20 rounded-full w-6 h-6 flex items-center justify-center">
				<BookmarkIcon class_="w-3 h-3 text-white" title="Joined Community" />
			</div>
		{:else}
			<!-- <div class="bg-base-200 text-base-content/70 text-xs font-medium px-2 py-1 rounded-md shadow-sm border border-base-300/50 hover:bg-base-300/50 transition-colors duration-200">
				Join
			</div> -->
		{/if}
	</div>

	<figure class="mb-2">
		<img
			src={getProfilePicture(getProfile()) || `https://robohash.org/${pubkey}`}
			alt="Profile"
			class="rounded-full object-cover w-20 h-20 ring-2 ring-base-300 hover:ring-primary/50 transition-colors duration-300"
		/>
	</figure>
	<div class="card-body items-center text-center p-0">
		<h2 class="card-title text-lg font-semibold text-base-content hover:text-primary transition-colors duration-300 mb-1">
			{getProfile()?.name || 'Unknown User'}
		</h2>
		<p class="text-sm text-base-content/70 w-full max-w-40 leading-relaxed relative" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; mask-image: linear-gradient(to bottom, black 0%, black 70%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 0%, black 70%, transparent 100%);" title={getProfile()?.about || 'No bio available'}>
			{getProfile()?.about || 'No bio available'}
		</p>
	</div>
</a>
