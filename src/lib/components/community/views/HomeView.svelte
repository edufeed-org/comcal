<script>
	import { getDisplayName, getProfilePicture } from 'applesauce-core/helpers';
	import CommunikeyHeader from '$lib/components/CommunikeyHeader.svelte';
	import { getCommunityAvailableContentTypes } from '$lib/helpers/contentTypes.js';
	
	// Import stat components
	import MembersStat from '$lib/components/community/stats/MembersStat.svelte';
	import CalendarEventsStat from '$lib/components/community/stats/CalendarEventsStat.svelte';
	import MessagesStat from '$lib/components/community/stats/MessagesStat.svelte';

	let { communikeyEvent, profileEvent, communityId, onKindNavigation } = $props();

	let contentTypes = $derived(communikeyEvent ? getCommunityAvailableContentTypes(communikeyEvent) : []);
</script>

{#if profileEvent && communikeyEvent}
	<div class="min-h-screen bg-base-100">
		<!-- Community Header -->
		<CommunikeyHeader
			{communikeyEvent}
			profile={profileEvent}
			communikeyContentTypes={contentTypes}
			activeTab={undefined}
			onTabChange={onKindNavigation}
		/>

		<!-- Main Content -->
		<div class="container mx-auto px-4 py-8 max-w-4xl">
			<!-- Quick Stats -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
				<MembersStat {communityId} />
				<CalendarEventsStat {communityId} />
				<MessagesStat {communityId} />
			</div>

			<!-- Community Description -->
			{#if communikeyEvent?.content}
				<div class="card bg-base-200 shadow-xl mb-8">
					<div class="card-body">
						<h2 class="card-title">About this community</h2>
						<p class="text-base-content/80">{communikeyEvent.content}</p>
					</div>
				</div>
			{/if}

			<!-- Recent Activity Section (Placeholder) -->
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body">
					<h2 class="card-title mb-4">Recent Activity</h2>
					<div class="text-center py-8 text-base-content/60">
						<p class="text-sm">No recent activity to display</p>
						<p class="text-xs mt-2">Activity will appear here as members interact with the community</p>
					</div>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="flex items-center justify-center h-full">
		<div class="loading loading-spinner loading-lg text-primary"></div>
	</div>
{/if}
