<script>
	import { UserIcon } from '$lib/components/icons';
	import { pool } from '$lib/stores/nostr-infrastructure.svelte';
	import { appConfig } from '$lib/config.js';

	// Props
	let { communityId } = $props();

	// Local state - completely isolated
	/** @type {Set<string>} */
	let memberPubkeys = $state(new Set());
	let isLoading = $state(true);
	let error = $state(null);

	// Load members
	$effect(() => {
		if (!communityId) {
			console.log('👥 MembersStat: No communityId provided, skipping load');
			return;
		}

		console.log('👥 MembersStat: Starting to load members for community:', communityId);

		// Reset state
		memberPubkeys = new Set();
		isLoading = true;
		error = null;

		const sub = pool
			.group(appConfig.calendar.defaultRelays)
			.subscription({ kinds: [30382], '#d': [communityId] })
			.subscribe({
				next: (/** @type {any} */ response) => {
					if (response === 'EOSE') {
						console.log('👥 MembersStat: EOSE received, members loaded:', memberPubkeys.size);
						isLoading = false;
					} else if (response && typeof response === 'object' && response.kind === 30382) {
						memberPubkeys.add(response.pubkey);
						memberPubkeys = new Set(memberPubkeys); // Trigger reactivity
						console.log('👥 MembersStat: Member added:', response.pubkey, 'Total:', memberPubkeys.size);
					}
				},
				error: (/** @type {any} */ err) => {
					console.error('👥 MembersStat: Error loading members:', err);
					error = err.message || 'Failed to load members';
					isLoading = false;
				}
			});

		return () => {
			console.log('👥 MembersStat: Cleaning up subscription');
			sub.unsubscribe();
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
