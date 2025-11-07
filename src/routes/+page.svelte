<script>
	import * as m from '$lib/paraglide/messages';
	import { goto } from '$app/navigation';
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import { useJoinedCommunitiesList } from '$lib/stores/joined-communities-list.svelte.js';
	import { getTagValue } from 'applesauce-core/helpers';
	import { hexToNpub } from '$lib/helpers/nostrUtils.js';
	import LandingHero from '$lib/components/landing/LandingHero.svelte';
	import FeatureHighlights from '$lib/components/landing/FeatureHighlights.svelte';
	import CommunityCarousel from '$lib/components/landing/CommunityCarousel.svelte';

	const activeUser = useActiveUser();
	const getJoinedCommunities = useJoinedCommunitiesList();

	// Redirect logged-in users to first community or discover page
	$effect(() => {
		if (activeUser()) {
			const communities = getJoinedCommunities();
			if (communities.length > 0) {
				// Redirect to first community
				const firstCommunity = communities.sort()[0];
				const pubkey = getTagValue(firstCommunity, 'd');
				if (pubkey) {
					const npub = hexToNpub(pubkey);
					if (npub) {
						goto(`/c/${npub}`);
					}
				}
			} else {
				// No communities - redirect to discover page
				goto('/discover');
			}
		}
	});
</script>

<svelte:head>
	<title>{m.landing_meta_title()}</title>
	<meta
		name="description"
		content={m.landing_meta_description()}
	/>
</svelte:head>

{#if !activeUser()}
	<!-- Landing page: For non-logged-in users -->
	<LandingHero />
	<FeatureHighlights />
	<CommunityCarousel />
{/if}
