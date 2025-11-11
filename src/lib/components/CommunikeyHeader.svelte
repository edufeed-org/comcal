<script>
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { useCommunityMembership } from '$lib/stores/joined-communities-list.svelte.js';
	import { EventFactory } from 'applesauce-factory';
	import { manager } from '$lib/stores/accounts.svelte';
	import { publishEvent } from '$lib/helpers/publisher';
	import * as m from '$lib/paraglide/messages';

	let { profile, communikeyEvent, communikeyContentTypes, activeTab, onTabChange } = $props();

	// Create a reactive reference to the community pubkey
	const communityPubkey = $derived(communikeyEvent?.pubkey);
	
	// Use the reusable community membership hook with reactive pubkey
	const getJoined = useCommunityMembership(communityPubkey);

	/**
	 * Handle tab click
	 * @param {number} kind - The content type kind number
	 * @param {boolean} enabled - Whether the content type is enabled
	 */
	function handleTabClick(kind, enabled) {
		if (enabled && onTabChange) {
			onTabChange(kind);
		}
	}

	/**
	 * Join the community
	 */
	async function joinCommunity() {
		const factory = new EventFactory({ signer: manager.active?.signer });
		const joinEvent = await factory.build({
			kind: 30382,
			tags: [
				['d', communikeyEvent.pubkey],
				['n', 'follow']
			]
		});
		// Sign the event
		const signedEvent = await factory.sign(joinEvent);
		console.log('Signed Join Event:', signedEvent);

		// Get default relays from config
		const { appConfig } = await import('$lib/config.js');
		const allRelays = [...new Set([...appConfig.calendar.defaultRelays])];

		const result = await publishEvent(signedEvent, {
			relays: allRelays,
			logPrefix: 'JoinCommunity'
		});

		return result.success;
	}
</script>

<div class="bg-base-100 rounded-xl border border-base-200 shadow-sm">
	<!-- Top Section: Community Info -->
	<div class="flex items-center gap-2 p-3">
		<div class="avatar">
			<div class="mask w-12 mask-hexagon-2 ring-2 ring-base-300">
				<img src={getProfilePicture(profile)} alt={m.communikey_header_profile_alt()} class="object-cover" />
			</div>
		</div>

		<div class="flex-1 min-w-0">
			<h1 class="text-base font-bold text-base-content truncate">{profile.name}</h1>
		</div>

		<div class="flex items-center gap-2 ml-auto">
			{#if getJoined()}
				<div class="badge badge-success gap-1">
					<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
					</svg>
					{m.communikey_header_joined_badge()}
				</div>
			{:else}
				<div class="badge badge-ghost gap-1">
					{m.communikey_header_not_joined_badge()}
				</div>
				<button onclick={joinCommunity} class="btn btn-primary btn-sm">
					{m.communikey_header_join_button()}
				</button>
			{/if}
		</div>
	</div>

	<!-- Bottom Section: Interactive Content Type Tabs -->
	<div class="border-t border-base-200">
		<div class="tabs tabs-bordered overflow-x-auto">
			{#each communikeyContentTypes as contentType}
				<button
					class="tab tab-bordered {activeTab === contentType.kind ? 'tab-active' : ''} {!contentType.enabled ? 'opacity-50 cursor-not-allowed' : ''}"
					onclick={() => handleTabClick(contentType.kind, contentType.enabled)}
					disabled={!contentType.enabled}
					title={contentType.description}
				>
					<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={contentType.icon} />
					</svg>
					{contentType.name}
					{#if !contentType.enabled}
						<span class="ml-1 text-xs">🔒</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</div>
