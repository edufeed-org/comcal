<script>
	import CommunikeyCard from '$lib/components/CommunikeyCard.svelte';
	import { eventStore, pool, relays, communities } from '$lib/store.svelte';
	import { onMount } from 'svelte';
	import { createTimelineLoader } from 'applesauce-loaders/loaders';

	const timeline = createTimelineLoader(pool, relays, { kinds: [10222] }, { eventStore });

	onMount(() => {
		timeline().subscribe();
		eventStore.timeline({ kinds: [10222] }).subscribe((events) => {
			communities.communities = events;
		});
	});
</script>

<svelte:head>
	<title>Nostr Feed - Communikey</title>
	<meta name="description" content="Real-time Nostr feed powered by SvelteKit" />
</svelte:head>

<div class="flex flex-row gap-8">
	<div class="w-1/4">
		<h2>Joined Communities</h2>
		<!-- Add any additional content for joined communities here -->
	</div>
	<div class="w-3/4">
		<div class="flex flex-wrap gap-2">
			{#each communities.communities as event}
				<CommunikeyCard pubkey={event.pubkey} />
			{/each}
		</div>
	</div>
</div>
