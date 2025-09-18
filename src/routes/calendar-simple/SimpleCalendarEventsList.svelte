<!--
  SimpleCalendarEventsList Component
  Simple list view of calendar events using the direct timeline loader approach
-->

<script>
	import { onDestroy, onMount } from 'svelte';
	import { TimelineModel } from 'applesauce-core/models';
	import { createTimelineLoader } from 'applesauce-loaders/loaders';
	import { pool, relays, eventStore } from '$lib/store.svelte';
	import { getCalendarEventTitle, getCalendarEventStart, getCalendarEventEnd, getCalendarEventImage } from 'applesauce-core/helpers/calendar-event';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	
	// Import existing UI components
	import CalendarEventCard from '$lib/components/calendar/CalendarEventCard.svelte';

	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
	 */

	// Props
	let { limit = 50, showLoadMore = true } = $props();

	// Simple reactive state using Svelte 5 runes
	let events = $state(/** @type {CalendarEvent[]} */ ([]));
	let loading = $state(false);
	let error = $state(/** @type {string | null} */ (null));

	// Timeline loader and subscription
	let subscription = $state();
	let timelineLoader = $state();

	/**
	 * Create calendar timeline loader following the simple pattern
	 */
	function createCalendarLoader() {
		return createTimelineLoader(
			pool,
			relays,
			{ kinds: [31922, 31923], limit },
			{ eventStore }
		);
	}

	/**
	 * Convert raw event to CalendarEvent format
	 * @param {any} event
	 * @returns {CalendarEvent}
	 */
	function convertToCalendarEvent(event) {
		const startTimestamp = getCalendarEventStart(event);
		const endTimestamp = getCalendarEventEnd(event);
		const validStartTimestamp = startTimestamp || Math.floor(Date.now() / 1000);

		const dTag = Array.isArray(event.tags)
			? (event.tags.find((/** @type {any[]} */ t) => t && t[0] === 'd')?.[1] || undefined)
			: undefined;

		return {
			id: event.id,
			pubkey: event.pubkey,
			kind: /** @type {import('$lib/types/calendar.js').CalendarEventKind} */ (event.kind),
			title: getCalendarEventTitle(event) || 'Untitled Event',
			summary: event.content || '',
			image: getCalendarEventImage(event) || '',
			start: validStartTimestamp,
			end: endTimestamp,
			startTimezone: undefined,
			endTimezone: undefined,
			locations: [],
			participants: [],
			hashtags: [],
			references: [],
			geohash: undefined,
			communityPubkey: '',
			createdAt: event.created_at,
			dTag,
			originalEvent: event
		};
	}

	// Initialize loader
	timelineLoader = createCalendarLoader();

	// Mount: Subscribe to events using the simple pattern
	onMount(() => {
		console.log('📅 SimpleCalendarEventsList: Mounting and subscribing to events');
		
		subscription = eventStore
			.model(TimelineModel, { kinds: [31922, 31923], limit })
			.subscribe((timeline) => {
				console.log(`📅 SimpleCalendarEventsList: Timeline updated: ${timeline.length} events`);
				
				// Convert raw events to CalendarEvent format
				const calendarEvents = timeline.map(convertToCalendarEvent);
				events = calendarEvents;
				
				loading = false;
			});
	});

	onDestroy(() => {
		if (subscription) {
			subscription.unsubscribe();
		}
	});

	/**
	 * Load more events
	 */
	function loadMore() {
		if (loading) return;
		
		loading = true;
		console.log('📅 SimpleCalendarEventsList: Loading more events');
		
		timelineLoader().subscribe({
			complete: () => {
				loading = false;
				console.log('📅 SimpleCalendarEventsList: Load more completed');
			},
			error: (/** @type {any} */ err) => {
				console.error('📅 SimpleCalendarEventsList: Load more error:', err);
				error = 'Failed to load more events';
				loading = false;
			}
		});
	}

	/**
	 * Handle event click
	 * @param {CalendarEvent} event
	 */
	function handleEventClick(event) {
		modalStore.openModal('eventDetails', { event });
		console.log('📅 SimpleCalendarEventsList: Event clicked, opening details modal:', event.title);
	}

	/**
	 * Format event date for display
	 * @param {CalendarEvent} event
	 * @returns {string}
	 */
	function formatEventDate(event) {
		const date = new Date(event.start * 1000);
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	/**
	 * Format event time for display
	 * @param {CalendarEvent} event
	 * @returns {string}
	 */
	function formatEventTime(event) {
		if (event.kind === 31922) return 'All Day'; // Date-based events
		
		const startDate = new Date(event.start * 1000);
		const endDate = event.end ? new Date(event.end * 1000) : null;
		
		const startTime = startDate.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
		
		if (endDate) {
			const endTime = endDate.toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: '2-digit'
			});
			return `${startTime} - ${endTime}`;
		}
		
		return startTime;
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-base-content">
			Calendar Events ({events.length})
		</h2>
		{#if showLoadMore}
			<button
				class="btn btn-outline btn-sm"
				onclick={loadMore}
				disabled={loading}
			>
				{#if loading}
					<span class="loading loading-spinner loading-sm"></span>
					Loading...
				{:else}
					Load More
				{/if}
			</button>
		{/if}
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="alert alert-error">
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>{error}</span>
			<button
				class="btn btn-ghost btn-xs"
				onclick={() => (error = null)}
			>
				Dismiss
			</button>
		</div>
	{/if}

	<!-- Events List -->
	{#if events.length > 0}
		<div class="grid gap-4">
			{#each events as event (event.id)}
				<div class="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
					<div class="card-body p-4">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<h3 class="card-title text-base font-semibold text-base-content mb-2">
									{event.title}
								</h3>
								
								<div class="flex items-center gap-4 text-sm text-base-content/70 mb-2">
									<div class="flex items-center gap-1">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
										<span>{formatEventDate(event)}</span>
									</div>
									
									<div class="flex items-center gap-1">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										<span>{formatEventTime(event)}</span>
									</div>
								</div>
								
								{#if event.summary}
									<p class="text-sm text-base-content/80 line-clamp-2 mb-2">
										{event.summary}
									</p>
								{/if}
								
								<div class="flex items-center gap-2 text-xs text-base-content/60">
									<span class="badge badge-outline badge-xs">
										{event.kind === 31922 ? 'Date Event' : 'Time Event'}
									</span>
									<span>Created {new Date(event.createdAt * 1000).toLocaleDateString()}</span>
								</div>
							</div>
							
							{#if event.image}
								<div class="flex-shrink-0">
									<img 
										src={event.image} 
										alt={event.title}
										class="w-16 h-16 object-cover rounded-lg"
										loading="lazy"
									/>
								</div>
							{/if}
						</div>
						
						<div class="card-actions justify-end mt-3">
							<button 
								class="btn btn-primary btn-sm"
								onclick={() => handleEventClick(event)}
							>
								View Details
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if !loading}
		<!-- Empty State -->
		<div class="text-center py-12">
			<div class="mb-4 text-base-content/30">
				<svg class="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1"
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</div>
			<h3 class="text-lg font-medium text-base-content mb-2">No calendar events found</h3>
			<p class="text-base-content/60">No calendar events found from connected relays.</p>
		</div>
	{/if}

	<!-- Loading indicator -->
	{#if loading && events.length === 0}
		<div class="text-center py-12">
			<span class="loading loading-lg loading-spinner text-primary"></span>
			<p class="mt-4 text-base-content/60">Loading calendar events...</p>
		</div>
	{/if}
</div>
