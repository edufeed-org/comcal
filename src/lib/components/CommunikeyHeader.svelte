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

<div class="flex items-center gap-2">
	<div class="avatar">
		<div class="mask w-12 mask-hexagon-2">
			<img src={getProfilePicture(profile)} />
		</div>
	</div>

	<div class="flex gap-2">
		<span>{profile.name}</span>

		<div class="flex flex-wrap">
			{#each communikeyContentTypes as contentType}
				<div class="badge badge-soft badge-primary">{contentType.name}</div>
			{/each}
		</div>
	</div>
	<div class="mr-2 ml-auto">
		{#if getJoined()}
			<div class="badge badge-soft badge-success">Joined</div>
		{:else}
			<div class="badge badge-soft badge-outline">Not Joined</div>
			<button onclick={joinCommunity} class="btn btn-primary">Join</button>
		{/if}
	</div>
</div>
