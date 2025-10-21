<!--
  UserProfilePreview Component
  Displays a compact user profile badge for npub/nprofile identifiers
-->

<script>
	import { nip19 } from 'nostr-tools';

	let { identifier, decoded } = $props();

	/** @type {string | null} */
	let pubkey = $derived.by(() => {
		if (!decoded.success) return null;
		if (decoded.type === 'npub') return decoded.data;
		if (decoded.type === 'nprofile') return decoded.data.pubkey;
		return null;
	});

	/** @type {string} */
	let displayId = $derived(identifier.slice(0, 12) + '...');
</script>

<a
	href="/p/{pubkey}"
	class="inline-flex items-center gap-1 badge badge-outline badge-primary hover:badge-primary transition-colors"
>
	👤 {displayId}
</a>
