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

	// Store the actual event data, not the subscription/observable
	let relationshipEvent = $state(
		/** @type {import('nostr-tools').Event | null | undefined} */ (null)
	);

	// Subscribe to manager.active$ and handle relationship subscription
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;

			// Reset relationship event when user changes
			relationshipEvent = null;

			if (user?.pubkey) {
				// Subscribe to the relationship observable and update state
				const relationshipSubscription = eventStore.replaceable(30382, user.pubkey, communikeyEvent.pubkey)
					.subscribe(event => {
						relationshipEvent = event; // Store the actual event data
					});

				// Store the subscription for cleanup
				subscription.add(relationshipSubscription);
			}
		});

		return () => subscription.unsubscribe(); // Cleans up both subscriptions
	});

	// React to relationship event changes
	$effect(() => {
		if (!userPubkey || !communikeyEvent?.pubkey) {
			joined = false;
			return;
		}

		if (relationshipEvent) {
			const relationship = getTagValue(relationshipEvent, 'n');
			const community = getTagValue(relationshipEvent, 'd');
			// Check if this is a follow relationship for this community
			joined = community === communikeyEvent.pubkey && relationship === 'follow';
		} else {
			joined = false;
		}
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
