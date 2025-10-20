<script>
	import { getDisplayName } from 'applesauce-core/helpers';
	import { BellIcon } from '$lib/components/icons';

	let { communityId, communikeyEvent } = $props();

	// TODO: Load actual activity data
	/** @type {any[]} */
	const activities = [];
</script>

<div class="min-h-screen bg-base-100 p-6">
	<div class="container mx-auto max-w-4xl">
		<div class="flex items-center gap-3 mb-6">
			<BellIcon class_="w-6 h-6 text-primary" />
			<h1 class="text-2xl font-bold">Community Activity</h1>
		</div>

		{#if activities.length === 0}
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body">
					<div class="text-center py-12 text-base-content/60">
						<BellIcon class_="w-16 h-16 mx-auto mb-4 opacity-30" />
						<p class="text-lg font-medium mb-2">No activity yet</p>
						<p class="text-sm">
							Activity will appear here when members post messages, create events, or join the community.
						</p>
					</div>
				</div>
			</div>
		{:else}
			<!-- Activity Feed -->
			<div class="space-y-4">
				{#each activities as activity}
					<div class="card bg-base-200 shadow">
						<div class="card-body p-4">
							<!-- Activity items would go here -->
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
