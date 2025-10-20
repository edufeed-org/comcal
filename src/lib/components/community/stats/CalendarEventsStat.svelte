<script>
	import { CalendarIcon } from '$lib/components/icons';
	import { targetedPublicationTimelineLoader } from '$lib/loaders';

	// Props
	let { communityId } = $props();

	// Local state
	let publicationCount = $state(0);
	let isLoading = $state(true);
	
	// Guard to prevent redundant loads
	/** @type {string | null} */
	let lastLoadedCommunityId = $state(null);

	// Subscription
	let subscription = $state();

	// Load targeted publications when communityId changes
	$effect(() => {
		if (!communityId) {
			console.log('🔍 CalendarEventsStat: No communityId provided');
			lastLoadedCommunityId = null;
			publicationCount = 0;
			isLoading = false;
			return;
		}
		
		console.log('🔍 CalendarEventsStat: Loading targeted publications for community:', communityId);
		lastLoadedCommunityId = communityId;
		isLoading = true;
		publicationCount = 0;
		
		// Subscribe to targeted publications (kind 30222)
		subscription = targetedPublicationTimelineLoader(communityId)().subscribe({
			next: (/** @type {any} */ pubEvent) => {
				publicationCount++;
				console.log('🔍 CalendarEventsStat: Targeted publication received. Total:', publicationCount);
			},
			error: (/** @type {any} */ err) => {
				console.error('🔍 CalendarEventsStat: Error loading targeted publications:', err);
				isLoading = false;
			},
			complete: () => {
				console.log('🔍 CalendarEventsStat: Loading complete. Total publications:', publicationCount);
				isLoading = false;
			}
		});
		
		// Cleanup function
		return () => {
			console.log('🔍 CalendarEventsStat: Cleaning up subscription');
			subscription?.unsubscribe();
		};
	});
</script>

<div class="stat bg-base-200 rounded-lg shadow">
	<div class="stat-figure text-secondary">
		<CalendarIcon class_="w-8 h-8" />
	</div>
	<div class="stat-title">Events</div>
	{#if isLoading}
		<div class="stat-value text-secondary">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
		<div class="stat-desc text-xs opacity-70">Loading...</div>
	{:else}
		<div class="stat-value text-secondary">{publicationCount}</div>
		<div class="stat-desc">targeted publications</div>
	{/if}
</div>
