<script>
	import { onMount } from 'svelte';
	import CommunikeyHeader from '$lib/components/CommunikeyHeader.svelte';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	import { eventStore } from '$lib/store.svelte';
	import { getCommunityContentTypes } from '$lib/helpers';
	import Chat from '$lib/components/Chat.svelte';

	let communikeyEvent = $state(null);
	let profileEvent = $state(null);

	// Communikey Creation Pointer
	const pointer = {
		kind: 10222,
		pubkey: data.pubkey
	};

	onMount(() => {
		eventStore.replaceable(pointer).subscribe((event) => {
			communikeyEvent = event;
		});

		eventStore.profile(data.pubkey).subscribe((event) => {
			profileEvent = event;
		});
	});

	let contentTypes = $derived(communikeyEvent ? getCommunityContentTypes(communikeyEvent) : []);
</script>

{#if profileEvent && communikeyEvent}
	<CommunikeyHeader
		{communikeyEvent}
		profile={profileEvent}
		communikeyContentTypes={contentTypes}
	/>
{/if}


<!-- {#if contentTypes && contentTypes.map(ct => ct.name).includes("Chat")} -->
	<Chat {communikeyEvent} />
<!-- {/if} -->
