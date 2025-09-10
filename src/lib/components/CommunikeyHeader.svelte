<script>
	import { manager } from '$lib/accounts.svelte';
	import { joinedCommunities, userJoinedCommunity } from '$lib/shared.svelte';
	import { eventStore } from '$lib/store.svelte';
	import { getProfilePicture, getTagValue } from 'applesauce-core/helpers';

	let { profile, communikeyEvent, communikeyContentTypes } = $props();

	const contentTypes = {
		30023: 'long-form-content'
	};

	// Bridge RxJS observable to Svelte reactivity
	let activeUser = $state(
		/** @type {import('applesauce-accounts').IAccount | undefined} */ (undefined)
	);
	let userPubkey = $derived(activeUser?.pubkey);
	let joined = $state(false);

	$inspect(userPubkey);

	let relationshipSub = $state(null);
	const relationshipEvent = $derived($relationshipSub);
	$inspect('test relationship', relationshipEvent);

	// Subscribe to manager.active$ observable and update reactive state
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
			relationshipSub = eventStore.replaceable(30382, user?.pubkey, communikeyEvent.pubkey);
		});
		return () => subscription.unsubscribe();
	});

	$effect(() => {
		if (!userPubkey || !communikeyEvent?.pubkey) {
			joined = false;
			return;
		}
		if (relationshipEvent) {
			$inspect('relationship event', relationshipEvent);
			const relationship = getTagValue(relationshipEvent, 'n');
			const community = getTagValue(relationshipEvent, 'd');
			// Check if this is a follow relationship for this community
			joined = community === communikeyEvent.pubkey && relationship === 'follow';
		} else {
			joined = false;
		}
		// const subscription = eventStore.replaceable(30382, userPubkey, communikeyEvent.pubkey)
		// 	.subscribe(event => {
		// 		console.log("relationship event for", userPubkey, "and", communikeyEvent.pubkey, event);
		// 		if (event) {
		// 			const relationship = getTagValue(event, "n");
		// 			const community = getTagValue(event, "d");
		// 			// Check if this is a follow relationship for this community
		// 			joined = (community === communikeyEvent.pubkey && relationship === "follow");
		// 		} else {
		// 			joined = false;
		// 		}
		// 	});

		// // Cleanup subscription when effect re-runs or component unmounts
		// return () => subscription.unsubscribe();
	});
</script>

<div class="flex items-center gap-2">
	<div class="avatar">
		<div class="mask w-12 mask-hexagon-2">
			<img src={getProfilePicture(profile)} />
		</div>
	</div>

	<span>{profile.name}</span>

	<div class="flex flex-wrap">
		{#each communikeyContentTypes as contentType}
			<div class="badge badge-soft badge-primary">{contentType.name}</div>
		{/each}
	</div>

	{#if joined}
		<div class="badge badge-soft badge-success">Joined</div>
	{:else}
		<div class="badge badge-soft badge-outline">Not Joined</div>
	{/if}
</div>
