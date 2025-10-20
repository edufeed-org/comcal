<script>
	import { ChatIcon } from '$lib/components/icons';
	import { pool } from '$lib/stores/nostr-infrastructure.svelte';
	import { appConfig } from '$lib/config.js';

	// Props
	let { communityId } = $props();

	// Local state - completely isolated
	/** @type {any[]} */
	let messages = $state([]);
	let isLoading = $state(true);
	let error = $state(null);

	// Load messages
	$effect(() => {
		if (!communityId) {
			console.log('💬 MessagesStat: No communityId provided, skipping load');
			return;
		}

		console.log('💬 MessagesStat: Starting to load messages for community:', communityId);

		// Reset state
		messages = [];
		isLoading = true;
		error = null;

		const sub = pool
			.group(appConfig.calendar.defaultRelays)
			.subscription({ kinds: [9], '#h': [communityId] })
			.subscribe({
				next: (/** @type {any} */ response) => {
					if (response === 'EOSE') {
						console.log('💬 MessagesStat: EOSE received, messages loaded:', messages.length);
						isLoading = false;
					} else if (response && typeof response === 'object' && response.kind === 9) {
						messages = [...messages, response];
						console.log('💬 MessagesStat: Message added, total:', messages.length);
					}
				},
				error: (/** @type {any} */ err) => {
					console.error('💬 MessagesStat: Error loading messages:', err);
					error = err.message || 'Failed to load messages';
					isLoading = false;
				}
			});

		return () => {
			console.log('💬 MessagesStat: Cleaning up subscription');
			sub.unsubscribe();
		};
	});

	let messageCount = $derived(messages.length);
</script>

<div class="stat bg-base-200 rounded-lg shadow">
	<div class="stat-figure text-accent">
		<ChatIcon class_="w-8 h-8" />
	</div>
	<div class="stat-title">Messages</div>
	{#if isLoading}
		<div class="stat-value text-accent">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
	{:else if error}
		<div class="stat-value text-error text-sm">Error</div>
		<div class="stat-desc text-xs text-error">{error}</div>
	{:else}
		<div class="stat-value text-accent">{messageCount}</div>
	{/if}
	<div class="stat-desc">Recent activity</div>
</div>
