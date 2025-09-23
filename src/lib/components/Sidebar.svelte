<script>
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import { getTagValue } from 'applesauce-core/helpers';
	import { relationshipTimelineLoader } from '$lib/loaders';
	import { eventStore } from '$lib/store.svelte';

	const activeUser = useActiveUser();

	// Use $state instead of trying to manage state inside $derived.by()
	let joinedCommunities = $state(/** @type {import('nostr-tools').Event[]} */ ([]));

	// Use $effect to handle the async subscription lifecycle
	$effect(() => {
		const user = activeUser();
		console.log("Active user in sidebar: ", user);

		if (!user?.pubkey) {
			joinedCommunities = [];
			return;
		}

		// Bootstrap the loader (this is important for EventStore intelligence)
		const relationshipSub = relationshipTimelineLoader(user.pubkey).subscribe();

		// Subscribe to the timeline
		const subscription = eventStore.timeline({
			kinds: [30382], // Relationship events
			authors: [user.pubkey],
			limit: 100
		}).subscribe({
			next: (/** @type {import('nostr-tools').Event[]} */ events) => {
				console.log('📋 JoinedCommunities: Loaded relationship events:', events.length);
				joinedCommunities = events; // Update the reactive state
			},
			error: (/** @type {any} */ error) => {
				console.error('📋 JoinedCommunities: Error loading relationship events:', error);
				joinedCommunities = [];
			}
		});

		// Cleanup function - this runs when the effect re-runs or component unmounts
		return () => {
			subscription.unsubscribe();
			// relationshipSub.unsubscribe(); // or keep it open?
		};
	});

	console.log("Relationships in sidebar: ", joinedCommunities);

	
</script>

<!-- Sidebar -->
<div class="mb-4 flex items-center justify-between">
	<h2>Joined Communities</h2>
	{#if activeUser()}
		<button class="btn btn-sm btn-primary" onclick={() => modalStore.openModal('createCommunity')}>
			New Group
		</button>
	{/if}
</div>

<div class="space-y-2">
	{#each joinedCommunities as community}
		<div class="card bg-base-100 p-3 shadow-sm">
			<div class="flex items-center gap-2">
				<div class="avatar">
					<div class="w-8 rounded-full">
						<img src={`https://robohash.org/${getTagValue(community, 'd')}`} alt="Community" />
					</div>
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium">
						{getTagValue(community, 'd')?.slice(0, 8)}...
					</p>
				</div>
				<a href={`/c/${community.pubkey}`} class="btn btn-xs btn-primary">Visit</a>
			</div>
		</div>
	{/each}
	{#if joinedCommunities.length === 0}
		<p class="text-sm text-base-content/60">No joined communities yet</p>
	{/if}
</div>
