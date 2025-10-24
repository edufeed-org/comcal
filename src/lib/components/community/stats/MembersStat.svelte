<script>
	import { UserIcon } from '$lib/components/icons';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { createCommunityMembersLoader } from '$lib/loaders/community';
	import { CommunityMembersModel } from '$lib/models';

	// Props
	let { communityId } = $props();

	// Local state - completely isolated
	/** @type {Set<string>} */
	let memberPubkeys = $state(new Set());
	let isLoading = $state(true);
	let error = $state(null);

	// Load members using loader + model pattern
	$effect(() => {
		if (!communityId) {
			console.log('👥 MembersStat: No communityId provided, skipping load');
			memberPubkeys = new Set();
			isLoading = false;
			return;
		}

		console.log('👥 MembersStat: Starting to load members for community:', communityId);

		// Reset state
		memberPubkeys = new Set();
		isLoading = true;
		error = null;

		// 1. Bootstrap EventStore with community members loader (fetches from relays)
		const loaderSubscription = createCommunityMembersLoader(communityId)().subscribe({
			error: (/** @type {any} */ err) => {
				console.error('👥 MembersStat: Loader error:', err);
				error = err.message || 'Failed to load members';
				isLoading = false;
			}
		});

		// 2. Subscribe to model for reactive filtered data from EventStore
		const modelSubscription = eventStore
			.model(CommunityMembersModel, communityId)
			.subscribe({
				next: (/** @type {Set<string>} */ members) => {
					memberPubkeys = members;
					isLoading = false;
					console.log('👥 MembersStat: Members loaded:', members.size);
				},
				error: (/** @type {any} */ err) => {
					console.error('👥 MembersStat: Model error:', err);
					error = err.message || 'Failed to load members';
					isLoading = false;
				}
			});

		return () => {
			console.log('👥 MembersStat: Cleaning up subscriptions');
			loaderSubscription.unsubscribe();
			modelSubscription.unsubscribe();
		};
	});

	let memberCount = $derived(memberPubkeys.size);
</script>

<div class="stat bg-base-200 rounded-lg shadow">
	<div class="stat-figure text-primary">
		<UserIcon class_="w-8 h-8" />
	</div>
	<div class="stat-title">Members</div>
	{#if isLoading}
		<div class="stat-value text-primary">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
	{:else if error}
		<div class="stat-value text-error text-sm">Error</div>
		<div class="stat-desc text-xs text-error">{error}</div>
	{:else}
		<div class="stat-value text-primary">{memberCount}</div>
	{/if}
	<div class="stat-desc">Community size</div>
</div>
