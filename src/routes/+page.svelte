<script>
	import CommunikeyCard from '$lib/components/CommunikeyCard.svelte';
	import { useAllCommunities } from '$lib/stores/all-communities.svelte.js';
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import LandingHero from '$lib/components/LandingHero.svelte';
	import FeatureHighlights from '$lib/components/FeatureHighlights.svelte';
	import CommunityCarousel from '$lib/components/CommunityCarousel.svelte';

	const getAllCommunities = useAllCommunities();
	const activeUser = useActiveUser();
</script>

<svelte:head>
	<title>Communikey - Decentralized Communities on Nostr</title>
	<meta
		name="description"
		content="Connect, organize, and collaborate in decentralized communities powered by Nostr protocol"
	/>
</svelte:head>

{#if activeUser()}
	<!-- Logged-in view: Original layout with sidebar -->
	<div class="container mx-auto px-4 py-8">
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
	</div>
{:else}
	<!-- Landing page: New layout for non-logged-in users -->
	<LandingHero />
	<FeatureHighlights />
	<CommunityCarousel />
{/if}
