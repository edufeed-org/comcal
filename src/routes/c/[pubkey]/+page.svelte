<script>
	import { onMount } from 'svelte';
	import CommunikeyHeader from '$lib/components/CommunikeyHeader.svelte';
	import Chat from '$lib/components/Chat.svelte';
	import CalendarView from '$lib/components/calendar/CalendarView.svelte';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	import { eventStore } from '$lib/store.svelte';
	import { getCommunityContentTypes } from '$lib/helpers';

	let communikeyEvent = $state(/** @type {any} */ (null));
	let profileEvent = $state(/** @type {any} */ (null));
	let activeTab = $state('chat'); // 'chat' or 'calendar'

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

	let contentTypes = $derived(communikeyEvent ? getCommunityContentTypes(communikeyEvent) : []);

	/**
	 * Handle tab change
	 * @param {string} tab
	 */
	function handleTabChange(tab) {
		activeTab = tab;
	}
</script>

{#if profileEvent && communikeyEvent}
	<CommunikeyHeader
		{communikeyEvent}
		profile={profileEvent}
		communikeyContentTypes={contentTypes}
	/>

	<!-- Community Content Tabs -->
	<div class="bg-base-100">
		<div class="tabs tabs-bordered">
			<button
				class="tab tab-bordered {activeTab === 'chat' ? 'tab-active' : ''}"
				onclick={() => handleTabChange('chat')}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
				</svg>
				Chat
			</button>
			<button
				class="tab tab-bordered {activeTab === 'calendar' ? 'tab-active' : ''}"
				onclick={() => handleTabChange('calendar')}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				Calendar
			</button>
		</div>

		<!-- Tab Content -->
		<div class="min-h-screen">
			{#if activeTab === 'chat'}
				<!-- {#if contentTypes && contentTypes.map(ct => ct.name).includes("Chat")} -->
					<Chat {communikeyEvent} />
				<!-- {/if} -->
			{:else if activeTab === 'calendar'}
				<CalendarView communityPubkey={data.pubkey} communityMode={true} />
			{/if}
		</div>
	</div>
{/if}
