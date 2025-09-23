<script>
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { useCommunityMembership } from '$lib/stores/joined-communities-list.svelte.js';
	import { EventFactory } from 'applesauce-factory';
	import { manager } from '$lib/accounts.svelte';
	import { publishEvent } from '$lib/helpers/publisher';

	let { profile, communikeyEvent, communikeyContentTypes } = $props();

	const contentTypes = {
		30023: 'long-form-content'
	};

	// Use the reusable community membership hook
	const getJoined = useCommunityMembership(communikeyEvent.pubkey);

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

		// Get user relays from the relays store
		const { relays: userRelays } = await import('$lib/store.svelte.js');
		const allRelays = [...new Set([...userRelays])];

		const result = await publishEvent(signedEvent, {
			relays: allRelays,
			logPrefix: 'JoinCommunity'
		});

		return result.success;
	}
</script>

<div class="flex items-center gap-3 p-3 bg-base-100 rounded-xl border border-base-200 shadow-sm">
	<div class="avatar">
		<div class="mask w-12 mask-hexagon-2 ring-2 ring-base-300">
			<img src={getProfilePicture(profile)} alt="Community Profile" class="object-cover" />
		</div>
	</div>

	<div class="flex gap-3 items-center">
		<span class="text-base font-semibold text-base-content">{profile.name}</span>

		<div class="flex flex-wrap gap-2">
			{#each communikeyContentTypes as contentType}
				<div class="badge badge-soft badge-primary hover:badge-primary-focus transition-all duration-200 cursor-default px-3 py-1 text-xs font-medium rounded-lg border border-primary/20 hover:border-primary/40 hover:shadow-sm">
					{contentType.name}
				</div>
			{/each}
		</div>
	</div>
	<div class="mr-2 ml-auto flex items-center gap-2">
		{#if getJoined()}
			<div class="badge badge-soft badge-success hover:badge-success-focus transition-all duration-200 cursor-default px-3 py-1 text-xs font-medium rounded-lg border border-success/20 hover:border-success/40 hover:shadow-sm">
				Joined
			</div>
		{:else}
			<div class="badge badge-soft badge-outline hover:badge-outline-focus transition-all duration-200 cursor-default px-3 py-1 text-xs font-medium rounded-lg border border-base-300/50 hover:border-base-300 hover:shadow-sm">
				Not Joined
			</div>
			<button onclick={joinCommunity} class="btn btn-primary hover:btn-primary-focus transition-colors duration-200 px-4 py-2">
				Join
			</button>
		{/if}
	</div>
</div>
