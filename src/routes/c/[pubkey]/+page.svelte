<script>
	import { onMount } from 'svelte';
	import CommunikeyHeader from '$lib/components/CommunikeyHeader.svelte';
	import Chat from '$lib/components/community/views/Chat.svelte';
	import CalendarView from '$lib/components/calendar/CalendarView.svelte';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { getCommunityAvailableContentTypes } from '$lib/helpers/contentTypes';

	let communikeyEvent = $state(/** @type {any} */ (null));
	let profileEvent = $state(/** @type {any} */ (null));
	let activeTab = $state(9); // Active tab by kind number (9 = Chat)

	// Communikey Creation Pointer
	const pointer = {
		kind: 10222,
		pubkey: data.pubkey
	};

	onMount(() => {
		eventStore.replaceable(pointer).subscribe((event) => {
			communikeyEvent = event || null;
		});

		eventStore.profile(data.pubkey).subscribe((event) => {
			profileEvent = event || null;
		});
	});

	// Get available content types (including always-available Chat & Calendar)
	let availableContentTypes = $derived(
		communikeyEvent ? getCommunityAvailableContentTypes(communikeyEvent) : []
	);

	/**
	 * Handle tab change
	 * @param {number} kind - The content type kind number
	 */
	function handleTabChange(kind) {
		activeTab = kind;
	}
</script>

{#if profileEvent && communikeyEvent}
	<CommunikeyHeader
		{communikeyEvent}
		profile={profileEvent}
		communikeyContentTypes={availableContentTypes}
		{activeTab}
		onTabChange={handleTabChange}
	/>

	<!-- Tab Content -->
	<div class="mx-auto max-w-5xl px-4 py-6">
		{#if activeTab === 9}
			<Chat {communikeyEvent} />
		{:else if activeTab === 31923}
			<CalendarView communityPubkey={data.pubkey} communityMode={true} />
		{:else}
			<div class="flex items-center justify-center p-8 text-base-content/60">
				<div class="text-center">
					<svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p class="text-lg font-medium">This content type is not yet available</p>
					<p class="mt-2">Check back soon for updates!</p>
				</div>
			</div>
		{/if}
	</div>
{/if}
