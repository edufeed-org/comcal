<script>
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import AppLayout from '$lib/components/AppLayout.svelte';
	import LandingHero from '$lib/components/LandingHero.svelte';
	import FeatureHighlights from '$lib/components/FeatureHighlights.svelte';
	import CommunityCarousel from '$lib/components/CommunityCarousel.svelte';

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
	<!-- Logged-in view: New two-sidebar layout -->
	<AppLayout />
{:else}
	<!-- Landing page: For non-logged-in users -->
	<LandingHero />
	<FeatureHighlights />
	<CommunityCarousel />
{/if}
