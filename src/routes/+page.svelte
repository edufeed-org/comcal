<script>
	import CommunikeyCard from '$lib/components/CommunikeyCard.svelte';
	import { communikeyLoader } from '$lib/store';
	import { writable } from 'svelte/store';

	const events = writable([]);

	communikeyLoader().subscribe({
		next: (event) => {
			console.log(event);
			// Update the events store with the new event
			events.update((prev) => [...prev, event]);
		},
		complete: () => {
			console.log('complete');
		}
	});
</script>

<svelte:head>
	<title>Nostr Feed - Communikey</title>
	<meta name="description" content="Real-time Nostr feed powered by SvelteKit" />
</svelte:head>

<div class="flex flex-wrap gap-2">
	{#each $events as event}
		<CommunikeyCard pubkey={event.pubkey} />
	{/each}
</div>
