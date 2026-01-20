<script>
	import * as m from '$lib/paraglide/messages';
	import LandingHero from '$lib/components/landing/LandingHero.svelte';
	import FeatureHighlights from '$lib/components/landing/FeatureHighlights.svelte';
	import CommunityCarousel from '$lib/components/landing/CommunityCarousel.svelte';
</script>

<svelte:head>
	<title>{m.landing_meta_title()}</title>
	<meta
		name="description"
		content={m.landing_meta_description()}
	/>
</svelte:head>

<LandingHero />
<FeatureHighlights />
<CommunityCarousel />
