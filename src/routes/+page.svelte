<script>
	import CommunikeyCard from '$lib/components/CommunikeyCard.svelte';
	import { useAllCommunities } from '$lib/stores/all-communities.svelte.js';

	import Sidebar from '$lib/components/Sidebar.svelte';

	const getAllCommunities = useAllCommunities();

</script>

<svelte:head>
	<title>Nostr Feed - Communikey</title>
	<meta name="description" content="Real-time Nostr feed powered by SvelteKit" />
</svelte:head>

<div class="flex flex-row gap-8">
	<!-- Sidebar -->
	<div class="w-1/4">
		<Sidebar />
		
	</div>
	<div class="w-3/4">
		<div class="flex flex-wrap gap-2">
			{#each getAllCommunities() as community}
				<CommunikeyCard pubkey={community.pubkey} />
			{/each}
		</div>
	</div>
</div>
