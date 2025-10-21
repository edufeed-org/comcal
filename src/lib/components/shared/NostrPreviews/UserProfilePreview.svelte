<!--
  UserProfilePreview Component
  Displays an inline mention for user profiles (npub/nprofile identifiers)
  Shows @username inline with text, similar to Twitter/X mentions
-->

<script>
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
	import { getDisplayName } from 'applesauce-core/helpers';
	import { hexToNpub } from '$lib/helpers/nostrUtils';

	let { identifier, decoded } = $props();

	// Extract pubkey from decoded identifier
	let pubkey = $derived.by(() => {
		if (!decoded.success) return null;
		if (decoded.type === 'npub') return decoded.data;
		if (decoded.type === 'nprofile') return decoded.data.pubkey;
		return null;
	});

	// Load profile using applesauce store - reactively subscribe when pubkey changes
	const getUserProfile = useUserProfile(pubkey);
	let profile = $derived(getUserProfile());

	// Derive display name with fallbacks
	let displayName = $derived(
		profile
			? getDisplayName(profile) || (pubkey ? `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}` : 'Unknown')
			: pubkey
				? `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`
				: 'Unknown'
	);

	// Determine link href
	let profileUrl = $derived(pubkey ? `/p/${hexToNpub(pubkey) || pubkey}` : '#');
</script>

{#if !decoded.success || !pubkey}
	<!-- Error state: Invalid identifier -->
	<span class="text-error font-medium">⚠️ @invalid</span>
{:else if !profile}
	<!-- Loading state: Show placeholder while profile loads -->
	<a href={profileUrl} class="text-info hover:underline font-medium">@...</a>
{:else}
	<!-- Loaded state: Simple inline mention -->
	<a href={profileUrl} class="text-info hover:underline font-medium no-underline">@{displayName}</a>
{/if}
