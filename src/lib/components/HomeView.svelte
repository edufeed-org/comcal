<script>
	import { getDisplayName, getProfilePicture } from 'applesauce-core/helpers';
	import CommunikeyHeader from '$lib/components/CommunikeyHeader.svelte';
	import { getCommunityContentTypes } from '$lib/helpers';
	import { UserIcon, CalendarIcon, ChatIcon } from '$lib/components/icons';

	let { communikeyEvent, profileEvent, communityId } = $props();

	let contentTypes = $derived(communikeyEvent ? getCommunityContentTypes(communikeyEvent) : []);
	
	// TODO: These would be loaded from actual data
	const stats = {
		members: 0,
		events: 0,
		messages: 0
	};
</script>

{#if profileEvent && communikeyEvent}
	<div class="min-h-screen bg-base-100">
		<!-- Community Header -->
		<CommunikeyHeader
			{communikeyEvent}
			profile={profileEvent}
			communikeyContentTypes={contentTypes}
		/>

		<!-- Main Content -->
		<div class="container mx-auto px-4 py-8 max-w-4xl">
			<!-- Quick Stats -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
				<div class="stat bg-base-200 rounded-lg shadow">
					<div class="stat-figure text-primary">
						<UserIcon class_="w-8 h-8" />
					</div>
					<div class="stat-title">Members</div>
					<div class="stat-value text-primary">{stats.members}</div>
					<div class="stat-desc">Community size</div>
				</div>

				<div class="stat bg-base-200 rounded-lg shadow">
					<div class="stat-figure text-secondary">
						<CalendarIcon class_="w-8 h-8" />
					</div>
					<div class="stat-title">Events</div>
					<div class="stat-value text-secondary">{stats.events}</div>
					<div class="stat-desc">Upcoming</div>
				</div>

				<div class="stat bg-base-200 rounded-lg shadow">
					<div class="stat-figure text-accent">
						<ChatIcon class_="w-8 h-8" />
					</div>
					<div class="stat-title">Messages</div>
					<div class="stat-value text-accent">{stats.messages}</div>
					<div class="stat-desc">Recent activity</div>
				</div>
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
