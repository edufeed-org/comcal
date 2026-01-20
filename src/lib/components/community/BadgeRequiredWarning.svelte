<!--
  BadgeRequiredWarning Component
  Displays a warning when a badge is required to publish content.
  Shows badge information and provides admin contact links.
-->
<script>
	import { eventStore, pool } from '$lib/stores/nostr-infrastructure.svelte';
	import { BadgeModel } from '$lib/models/badge-model.js';
	import { createBadgeDefinitionLoader } from '$lib/loaders/badge-loaders.js';
	import { getWriteRelays } from '$lib/services/relay-service.svelte.js';
	import { npubEncode } from 'nostr-tools/nip19';
	import * as m from '$lib/paraglide/messages';

	/**
	 * @typedef {Object} Props
	 * @property {string} badgeAddress - Badge address in format "30009:pubkey:identifier"
	 * @property {Object} [communityEvent] - Community definition event (kind 10222)
	 * @property {string} [contentTypeName] - Human-readable content type name
	 */

	/** @type {Props} */
	let { badgeAddress, communityEvent = null, contentTypeName = 'content' } = $props();

	// Badge info state
	let badgeInfo = $state(/** @type {any} */ (null));
	let isLoading = $state(true);

	// Parse badge address to get issuer pubkey
	let issuerPubkey = $derived(badgeAddress?.split(':')[1] || '');
	let badgeIdentifier = $derived(badgeAddress?.split(':')[2] || '');

	// Get community admins (pubkeys with admin role or just the community owner)
	let admins = $derived(() => {
		if (!communityEvent) return [];

		const adminPubkeys = new Set();

		// Community owner is always an admin
		if (communityEvent.pubkey) {
			adminPubkeys.add(communityEvent.pubkey);
		}

		// Look for p tags with admin role marker
		const tags = communityEvent.tags || [];
		for (const tag of tags) {
			if (tag[0] === 'p' && tag[3] === 'admin') {
				adminPubkeys.add(tag[1]);
			}
		}

		return Array.from(adminPubkeys);
	});

	// Load badge definition
	$effect(() => {
		if (!issuerPubkey || !badgeIdentifier) {
			isLoading = false;
			return;
		}

		isLoading = true;

		// Get relays for the badge issuer
		getWriteRelays(issuerPubkey).then((relays) => {
			// Start loader
			const loader = createBadgeDefinitionLoader(pool, relays, eventStore, issuerPubkey);
			const loaderSub = loader()().subscribe();

			// Subscribe to model
			const modelSub = eventStore.model(BadgeModel, issuerPubkey).subscribe((badges) => {
				const badge = badges.find((b) => b.identifier === badgeIdentifier);
				if (badge) {
					badgeInfo = badge;
					isLoading = false;
				}
			});

			// Timeout fallback
			const timeout = setTimeout(() => {
				isLoading = false;
			}, 5000);

			return () => {
				loaderSub?.unsubscribe();
				modelSub?.unsubscribe();
				clearTimeout(timeout);
			};
		});
	});

	/**
	 * Format pubkey for display
	 * @param {string} pubkey
	 */
	function formatPubkey(pubkey) {
		try {
			const npub = npubEncode(pubkey);
			return `${npub.slice(0, 12)}...${npub.slice(-6)}`;
		} catch {
			return `${pubkey.slice(0, 8)}...`;
		}
	}
</script>

<div class="alert alert-warning shadow-lg">
	<div class="flex flex-col gap-3 w-full">
		<div class="flex items-start gap-3">
			<!-- Badge icon or image -->
			{#if isLoading}
				<div class="w-12 h-12 rounded-lg bg-warning/20 flex items-center justify-center">
					<span class="loading loading-spinner loading-sm"></span>
				</div>
			{:else if badgeInfo?.image}
				<img
					src={badgeInfo.image}
					alt={badgeInfo.name || 'Badge'}
					class="w-12 h-12 rounded-lg object-cover"
				/>
			{:else}
				<div class="w-12 h-12 rounded-lg bg-warning/20 flex items-center justify-center">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-6 h-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
						/>
					</svg>
				</div>
			{/if}

			<!-- Warning text -->
			<div class="flex-1">
				<h3 class="font-bold text-warning-content">{m.badge_required_title()}</h3>
				<p class="text-sm text-warning-content/80">
					{#if badgeInfo?.name}
						{m.badge_required_message_with_name({
							badgeName: badgeInfo.name,
							contentType: contentTypeName
						})}
					{:else}
						{m.badge_required_message({ contentType: contentTypeName })}
					{/if}
				</p>

				{#if badgeInfo?.description}
					<p class="text-xs text-warning-content/60 mt-1">
						{badgeInfo.description}
					</p>
				{/if}
			</div>
		</div>

		<!-- Admin contacts -->
		{#if admins().length > 0}
			<div class="border-t border-warning-content/20 pt-3">
				<p class="text-xs text-warning-content/70 mb-2">
					{m.badge_required_contact_admin()}
				</p>
				<div class="flex flex-wrap gap-2">
					{#each admins() as adminPubkey}
						<a
							href="/p/{adminPubkey}"
							class="btn btn-sm btn-outline border-warning-content/30 text-warning-content hover:bg-warning-content/10"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="w-4 h-4 mr-1"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
								/>
							</svg>
							{formatPubkey(adminPubkey)}
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
