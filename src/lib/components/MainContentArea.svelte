<script>
	import { onMount } from 'svelte';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import Chat from '$lib/components/Chat.svelte';
	import CalendarView from '$lib/components/calendar/CalendarView.svelte';
	import HomeView from '$lib/components/HomeView.svelte';
	import ActivityView from '$lib/components/ActivityView.svelte';
	import SettingsView from '$lib/components/SettingsView.svelte';

	let { selectedCommunityId, selectedContentType } = $props();

	let communikeyEvent = $state(/** @type {any} */ (null));
	let profileEvent = $state(/** @type {any} */ (null));
	let isLoading = $state(true);

	// Communikey Creation Pointer
	$effect(() => {
		if (selectedCommunityId) {
			isLoading = true;
			
			const pointer = {
				kind: 10222,
				pubkey: selectedCommunityId
			};

			eventStore.replaceable(pointer).subscribe((event) => {
				communikeyEvent = event || null;
				isLoading = false;
			});

			eventStore.profile(selectedCommunityId).subscribe((event) => {
				profileEvent = event || null;
			});
		} else {
			communikeyEvent = null;
			profileEvent = null;
			isLoading = false;
		}
	});
</script>

<!-- Main Content Area -->
<div class="flex-1 lg:ml-[304px] overflow-auto pb-16 lg:pb-0 transition-all duration-300">
	{#if !selectedCommunityId}
		<!-- Empty state: No community selected -->
		<div class="flex flex-col items-center justify-center h-full text-center p-8">
			<div class="max-w-md">
				<h2 class="text-2xl font-bold text-base-content mb-4">Welcome to Communikey</h2>
				<p class="text-base-content/60 mb-6">
					Select a community from the sidebar to get started, or create a new one to begin your journey.
				</p>
			</div>
		</div>
	{:else if isLoading}
		<!-- Loading state -->
		<div class="flex items-center justify-center h-full">
			<div class="loading loading-spinner loading-lg text-primary"></div>
		</div>
	{:else if selectedContentType === 'home'}
		<HomeView {communikeyEvent} {profileEvent} communityId={selectedCommunityId} />
	{:else if selectedContentType === 'chat'}
		<Chat {communikeyEvent} />
	{:else if selectedContentType === 'calendar'}
		<CalendarView communityPubkey={selectedCommunityId} communityMode={true} />
	{:else if selectedContentType === 'activity'}
		<ActivityView communityId={selectedCommunityId} {communikeyEvent} />
	{:else if selectedContentType === 'settings'}
		<SettingsView communityId={selectedCommunityId} {communikeyEvent} {profileEvent} />
	{/if}
</div>
