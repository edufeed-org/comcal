<script>
	import CommunikeyCard from '$lib/components/CommunikeyCard.svelte';
	import { communikeyLoader } from '$lib/store';
	import { communities } from '$lib/shared.svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		communikeyLoader().subscribe({
			next: (event) => {
				communities.push(event);
		},
		complete: () => {
			console.log('complete');
		}
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
		<h2>Live Feed</h2>
		<div class="flex flex-wrap gap-2">
			{#each communities as event}
				<CommunikeyCard pubkey={event.pubkey} />
			{/each}
		</div>
	</div>
</div>