<script>
	import { onMount } from 'svelte';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { ProfileModel } from 'applesauce-core/models';
	import { profileLoader } from '$lib/loaders/profile.js';
	import { addressLoader } from '$lib/loaders/base.js';
	import { getConfig } from '$lib/stores/config.svelte.js';
	import Chat from '../views/Chat.svelte';
	import CalendarView from '$lib/components/calendar/CalendarView.svelte';
	import LearningView from '../views/LearningView.svelte';
	import HomeView from '../views/HomeView.svelte';
	import ActivityView from '../views/ActivityView.svelte';
	import SettingsView from '../views/SettingsView.svelte';
	import * as m from '$lib/paraglide/messages';

	let { selectedCommunityId, selectedContentType, onKindNavigation } = $props();

	let communikeyEvent = $state(/** @type {any} */ (null));
	let communityProfile = $state(/** @type {any} */ (null));
	let isLoading = $state(true);

	// Load community profile with proper reactivity to selectedCommunityId changes
	$effect(() => {
		// Reset profile when community changes
		communityProfile = null;

		if (selectedCommunityId) {
			// 1. Trigger loader to fetch profile from relays
			const config = getConfig();
			const loaderSub = profileLoader({ 
				kind: 0, 
				pubkey: selectedCommunityId, 
				relays: config.calendar.defaultRelays 
			}).subscribe(() => {
				// Loader automatically populates eventStore
			});

			// 2. Subscribe to model for reactive parsed profile from eventStore
			const modelSub = eventStore
				.model(ProfileModel, selectedCommunityId)
				.subscribe((profileContent) => {
					communityProfile = profileContent;
				});

			// Cleanup subscriptions when community changes
			return () => {
				loaderSub.unsubscribe();
				modelSub.unsubscribe();
			};
		}
	});

	// Communikey Creation Pointer
	$effect(() => {
		if (selectedCommunityId) {
			isLoading = true;
			
			const pointer = {
				kind: 10222,
				pubkey: selectedCommunityId
			};

			const config = getConfig();
			
			// 1. Trigger loader to fetch community event from relays
			const loaderSub = addressLoader({ 
				...pointer, 
				relays: config.calendar.defaultRelays 
			}).subscribe(() => {
				// Loader automatically populates eventStore
			});

			// 2. Subscribe to eventStore for reactive updates
			const sub = eventStore.replaceable(pointer).subscribe((event) => {
				communikeyEvent = event || null;
				isLoading = false;
			});

			return () => {
				loaderSub.unsubscribe();
				sub.unsubscribe();
			};
		} else {
			communikeyEvent = null;
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
				<h2 class="text-2xl font-bold text-base-content mb-4">{m.community_layout_main_content_welcome_title()}</h2>
				<p class="text-base-content/60 mb-6">
					{m.community_layout_main_content_welcome_description()}
				</p>
			</div>
		</div>
	{:else if isLoading}
		<!-- Loading state -->
		<div class="flex items-center justify-center h-full">
			<div class="loading loading-spinner loading-lg text-primary"></div>
		</div>
	{:else}
		<!-- Key block ensures views remount when community changes -->
		{#key selectedCommunityId}
			{#if selectedContentType === 'home'}
				<HomeView {communikeyEvent} profileEvent={communityProfile} communityId={selectedCommunityId} {onKindNavigation} />
			{:else if selectedContentType === 'chat'}
				<Chat {communikeyEvent} communityProfile={communityProfile} communityPubkey={selectedCommunityId} />
			{:else if selectedContentType === 'calendar'}
				<CalendarView communityPubkey={selectedCommunityId} communityMode={true} communityProfile={communityProfile} />
			{:else if selectedContentType === 'learning'}
				<LearningView communityPubkey={selectedCommunityId} communityProfile={communityProfile} />
			{:else if selectedContentType === 'activity'}
				<ActivityView communityId={selectedCommunityId} {communikeyEvent} communityProfile={communityProfile} communityPubkey={selectedCommunityId} />
			{:else if selectedContentType === 'settings'}
				<SettingsView communityId={selectedCommunityId} {communikeyEvent} profileEvent={communityProfile} />
			{/if}
		{/key}
	{/if}
</div>
