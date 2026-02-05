<!--
  LearningView Component
  Displays educational resources (AMB/kind:30142) shared with a community
  Follows the loader/model pattern used by CalendarView
-->

<script>
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { useAMBCommunityLoader } from '$lib/loaders/amb.js';
	import { CommunityAMBResourceModel } from '$lib/models/community-amb-resource.js';
	import { useProfileMap } from '$lib/stores/profile-map.svelte.js';
	import AMBResourceCard from '$lib/components/educational/AMBResourceCard.svelte';
	import EducationalFAB from '$lib/components/educational/EducationalFAB.svelte';
	import * as m from '$lib/paraglide/messages';

	/**
	 * @typedef {Object} Props
	 * @property {string} communityPubkey - The community's public key
	 * @property {any} [communityProfile] - The community's profile (optional)
	 */

	/** @type {Props} */
	let { communityPubkey, communityProfile = null } = $props();

	// State
	let resources = $state(/** @type {any[]} */ ([]));
	let isLoading = $state(true);
	let error = $state(/** @type {string | null} */ (null));
	const getAuthorProfiles = useProfileMap(() => resources.map((r) => r.pubkey));
	let authorProfiles = $derived(getAuthorProfiles());

	// Loader cleanup reference (plain let - not $state to avoid triggering $effect re-runs)
	let loaderCleanup = /** @type {(() => void) | null} */ (null);

	// Load resources when community changes
	$effect(() => {
		// Reset state
		resources = [];
		isLoading = true;
		error = null;

		// Cleanup previous loader
		if (loaderCleanup) {
			loaderCleanup();
			loaderCleanup = null;
		}

		if (!communityPubkey) {
			isLoading = false;
			return;
		}

		console.log('📚 LearningView: Loading resources for community', communityPubkey.slice(0, 8));

		try {
			// Start the community loader
			const { cleanup } = useAMBCommunityLoader(communityPubkey);
			loaderCleanup = cleanup;

			// Subscribe to the model for reactive updates
			const modelSub = eventStore
				.model(CommunityAMBResourceModel, communityPubkey)
				.subscribe({
					next: (loadedResources) => {
						console.log('📚 LearningView: Received', loadedResources.length, 'resources');
						resources = loadedResources;
						isLoading = false;
					},
					error: (err) => {
						console.error('📚 LearningView: Error loading resources:', err);
						error = 'Failed to load educational resources';
						isLoading = false;
					}
				});

			// Update cleanup to include model subscription
			const originalCleanup = cleanup;
			loaderCleanup = () => {
				modelSub.unsubscribe();
				originalCleanup();
			};
		} catch (err) {
			console.error('📚 LearningView: Error setting up loader:', err);
			error = 'Failed to connect to relay';
			isLoading = false;
		}

		// Cleanup on effect teardown
		return () => {
			if (loaderCleanup) {
				loaderCleanup();
				loaderCleanup = null;
			}
		};
	});

</script>

<div class="learning-view p-4">
	<!-- Header -->
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-base-content">
			{m.community_learning_title()}
		</h2>
		<p class="text-base-content/60 mt-1">
			{m.community_learning_description()}
		</p>
	</div>

	<!-- Loading State -->
	{#if isLoading}
		<div class="flex flex-col items-center justify-center py-16">
			<span class="loading loading-spinner loading-lg text-primary"></span>
			<p class="mt-4 text-base-content/60">{m.community_learning_loading()}</p>
		</div>
	<!-- Error State -->
	{:else if error}
		<div class="alert alert-error">
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{error}</span>
		</div>
	<!-- Empty State -->
	{:else if resources.length === 0}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<div class="w-24 h-24 mb-6 rounded-full bg-base-200 flex items-center justify-center">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
				</svg>
			</div>
			<h3 class="text-lg font-semibold text-base-content mb-2">
				{m.community_learning_empty_title()}
			</h3>
			<p class="text-base-content/60 max-w-md">
				{m.community_learning_empty_description()}
			</p>
		</div>
	<!-- Resource List -->
	{:else}
		<div class="space-y-4">
			{#each resources as resource (resource.id)}
				<AMBResourceCard
					{resource}
					authorProfile={authorProfiles.get(resource.pubkey) || null}
					compact={false}
				/>
			{/each}
		</div>

		<!-- Resource Count -->
		<div class="mt-6 text-center text-sm text-base-content/60">
			{m.community_learning_count({ count: resources.length })}
		</div>
	{/if}
</div>

<!-- Floating Action Button for creating new resources -->
<EducationalFAB {communityPubkey} />

<style>
	.learning-view {
		min-height: calc(100vh - 16rem);
	}
</style>
