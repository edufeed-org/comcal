<script>
	import { eventStore, pool } from '$lib/stores/nostr-infrastructure.svelte.js';
	import { createBadgeDefinitionLoader } from '$lib/loaders/badge-loaders.js';
	import { BadgeModel } from '$lib/models/badge-model.js';
	import { getWriteRelays } from '$lib/services/relay-service.svelte.js';
	import * as m from '$lib/paraglide/messages';

	/**
	 * @type {{
	 *   authorPubkey: string,
	 *   selectedBadge?: string | null,
	 *   label?: string,
	 *   placeholder?: string
	 * }}
	 */
	let {
		authorPubkey,
		selectedBadge = $bindable(null),
		label = m.badge_selector_label?.() || 'Select Badge',
		placeholder = m.badge_selector_placeholder?.() || 'Anyone (no badge required)'
	} = $props();

	let badges = $state(/** @type {Array<{id: string, pubkey: string, identifier: string, name: string, description: string, image: string, thumb: string, address: string}>} */ ([]));
	let isLoading = $state(true);

	// Store subscriptions for cleanup
	/** @type {import('rxjs').Subscription | undefined} */
	let loaderSub;
	/** @type {import('rxjs').Subscription | undefined} */
	let modelSub;

	$effect(() => {
		if (!authorPubkey) {
			isLoading = false;
			badges = [];
			return;
		}

		isLoading = true;

		// Discover author's write relays (where they publish badges) using NIP-65 outbox model
		getWriteRelays(authorPubkey).then((relays) => {
			// Create and subscribe to loader (populates EventStore)
			const loader = createBadgeDefinitionLoader(pool, relays, eventStore, authorPubkey);
			loaderSub = loader()().subscribe();

			// Subscribe to model (reactive updates from EventStore)
			modelSub = eventStore.model(BadgeModel, authorPubkey).subscribe((loadedBadges) => {
				badges = loadedBadges;
				isLoading = false;
			});
		});

		return () => {
			loaderSub?.unsubscribe();
			modelSub?.unsubscribe();
		};
	});
</script>

<div class="form-control">
	<label class="label">
		<span class="label-text">{label}</span>
	</label>
	<select class="select select-bordered" bind:value={selectedBadge} disabled={isLoading}>
		<option value={null}>{placeholder}</option>
		{#each badges as badge (badge.address)}
			<option value={badge.address}>
				{badge.name || badge.identifier || badge.address.split(':')[2]}
			</option>
		{/each}
	</select>
	{#if isLoading}
		<label class="label">
			<span class="label-text-alt">{m.badge_selector_loading?.() || 'Loading badges...'}</span>
		</label>
	{:else if badges.length === 0 && authorPubkey}
		<label class="label">
			<span class="label-text-alt text-warning">
				{m.badge_selector_none?.() || 'No badges found. Create badges in a badge management app first.'}
			</span>
		</label>
	{/if}
</div>
