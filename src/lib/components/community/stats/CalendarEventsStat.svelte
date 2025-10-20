<script>
	import { CalendarIcon } from '$lib/components/icons';
	import { targetedPublicationTimelineLoader, eventLoader } from '$lib/loaders';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { getTagValue } from 'applesauce-core/helpers';
	import { parseAddressReference } from '$lib/helpers/eventUtils';
	import { appConfig } from '$lib/config.js';

	// Props
	let { communityId } = $props();

	// Store event references from publications
	const eventRefs = new Set();
	const addressableRefs = new Set();
	
	// Local state
	let isLoading = $state(true);
	let publicationsLoaded = $state(false);
	
	// Guard to prevent redundant loads
	/** @type {string | null} */
	let lastLoadedCommunityId = $state(null);

	// Subscription
	let subscription = $state();

	// Count unique calendar events from EventStore
	const eventCount = $derived.by(() => {
		const uniqueEventIds = new Set();
		const events = []
		
		// Check e-tag references (events by ID)
		for (const id of eventRefs) {
			const event = eventStore.getEvent(id);
			if (event && (event.kind === 31922 || event.kind === 31923)) {
				uniqueEventIds.add(event.id);
				events.push(event);
			}
		}
		
		// Check a-tag references (addressable events)
		for (const aTag of addressableRefs) {
			const parsed = parseAddressReference(aTag);
			if (parsed && (parsed.kind === 31922 || parsed.kind === 31923)) {
				const event = eventStore.getReplaceable(parsed.kind, parsed.pubkey, parsed.dTag);
				if (event) {
					uniqueEventIds.add(event.id);
					events.push(event);
				}
			}
		}
		console.log(events)
		return uniqueEventIds.size;
	});

	// Load targeted publications when communityId changes
	$effect(() => {
		if (!communityId) {
			console.log('🔍 CalendarEventsStat: No communityId provided');
			lastLoadedCommunityId = null;
			eventRefs.clear();
			addressableRefs.clear();
			isLoading = false;
			publicationsLoaded = false;
			return;
		}
	
		console.log('🔍 CalendarEventsStat: Loading targeted publications for community:', communityId);
		lastLoadedCommunityId = communityId;
		isLoading = true;
		publicationsLoaded = false;
		eventRefs.clear();
		addressableRefs.clear();
		
		// Subscribe to targeted publications (kind 30222)
		subscription = targetedPublicationTimelineLoader(communityId)().subscribe({
			next: (/** @type {any} */ pubEvent) => {
				console.log('🔍 CalendarEventsStat: Targeted publication received:', pubEvent.id);
				
				// Extract e-tag (event reference)
				const eTag = getTagValue(pubEvent, 'e');
				if (eTag) {
					console.log('🔍 CalendarEventsStat: Found e-tag:', eTag);
					eventRefs.add(eTag);
					// Trigger loader to fetch the event
					eventLoader({ id: eTag, relays: appConfig.calendar.defaultRelays });
				}
				
				// Extract a-tag (addressable reference)
				const aTag = getTagValue(pubEvent, 'a');
				if (aTag) {
					console.log('🔍 CalendarEventsStat: Found a-tag:', aTag);
					addressableRefs.add(aTag);
					// Trigger loader to fetch the addressable event
					const parsed = parseAddressReference(aTag);
					if (parsed) {
						eventStore.addressableLoader?.({ 
							kind: parsed.kind, 
							pubkey: parsed.pubkey, 
							identifier: parsed.dTag 
						});
					}
				}
			},
			error: (/** @type {any} */ err) => {
				console.error('🔍 CalendarEventsStat: Error loading targeted publications:', err);
				isLoading = false;
				publicationsLoaded = true;
			},
			complete: () => {
				console.log('🔍 CalendarEventsStat: Publications loading complete');
				console.log('🔍 CalendarEventsStat: Total e-tags:', eventRefs.size);
				console.log('🔍 CalendarEventsStat: Total a-tags:', addressableRefs.size);
				isLoading = false;
				publicationsLoaded = true;
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
	{:else if publicationsLoaded}
		<div class="stat-value text-secondary">{eventCount}</div>
		<div class="stat-desc">calendar events</div>
	{:else}
		<div class="stat-value text-secondary">0</div>
		<div class="stat-desc">no data</div>
	{/if}
</div>
