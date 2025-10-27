<!--
  SimpleCalendarEventsList Component
  Simple list view of calendar events that accepts events as props
-->

<script>
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { CalendarIcon, AlertIcon, ChevronDownIcon } from '$lib/components/icons';
	import { filterEventsByViewMode } from '$lib/helpers/calendar.js';
	
	// Import existing UI components
	import CalendarEventCard from '$lib/components/calendar/CalendarEventCard.svelte';

	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
	 * @typedef {import('$lib/types/calendar.js').CalendarViewMode} CalendarViewMode
	 */

	// Props
	let { 
		events = /** @type {CalendarEvent[]} */ ([]),
		viewMode = /** @type {CalendarViewMode} */ ('month'),
		currentDate = new Date(),
		loading = false,
		error = /** @type {string | null} */ (null)
	} = $props();

	// Filter events based on current view mode and date using shared helper
	let filteredEvents = $derived.by(() => filterEventsByViewMode(events, viewMode, currentDate));

	// Current timestamp for comparison
	let now = $derived(Date.now());

	// Upcoming events (start time is in the future)
	let upcomingEvents = $derived.by(() => {
		return filteredEvents.filter((/** @type {CalendarEvent} */ event) => event.start * 1000 >= now);
		// Already sorted chronologically (earliest first) from filteredEvents
	});

	// Past events (start time is in the past)
	let pastEvents = $derived.by(() => {
		const past = filteredEvents.filter((/** @type {CalendarEvent} */ event) => event.start * 1000 < now);
		// Sort in reverse chronological order (most recent first)
		return past.reverse();
	});

	/**
	 * Handle event click
	 * @param {CalendarEvent} event
	 */
	function handleEventClick(event) {
		modalStore.openModal('eventDetails', { event });
		console.log('📅 SimpleCalendarEventsList: Event clicked, opening details modal:', event.title);
	}

	/**
	 * Scroll to past events section
	 */
	function scrollToPastEvents() {
		const element = document.getElementById('past-events');
		element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	/**
	 * Scroll back to top
	 */
	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-base-content">
			Calendar Events ({filteredEvents.length})
		</h2>
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="alert alert-error">
			<AlertIcon class_="h-5 w-5" />
			<span>{error}</span>
			<button
				class="btn btn-ghost btn-xs"
				onclick={() => (error = null)}
			>
				Dismiss
			</button>
		</div>
	{/if}

	<!-- Upcoming Events Section -->
	<section class="space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-base-content">
				Upcoming Events ({upcomingEvents.length})
			</h3>
			{#if pastEvents.length > 0}
				<button
					type="button"
					onclick={scrollToPastEvents}
					class="link link-primary link-hover flex items-center gap-1 text-sm"
					aria-label="Jump to past events section"
				>
					<span>Jump to Past ({pastEvents.length})</span>
					<ChevronDownIcon class_="h-4 w-4" />
				</button>
			{/if}
		</div>
		
		{#if upcomingEvents.length > 0}
			<div class="grid gap-4">
				{#each upcomingEvents as event (event.id)}
					<CalendarEventCard 
						{event} 
						compact={false} 
						onEventClick={handleEventClick}
					/>
				{/each}
			</div>
		{:else if !loading}
			<!-- Empty State for Upcoming Events -->
			<div class="text-center py-8">
				<div class="mb-3 text-base-content/30">
					<CalendarIcon class_="h-12 w-12 mx-auto" />
				</div>
				<p class="text-base-content/60">No upcoming events scheduled</p>
			</div>
		{/if}
	</section>

	<!-- Divider -->
	{#if filteredEvents.length > 0}
		<div class="divider"></div>
	{/if}

	<!-- Past Events Section -->
	<section id="past-events" class="space-y-4">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-base-content">
				Past Events ({pastEvents.length})
			</h3>
			<button
				type="button"
				onclick={scrollToTop}
				class="link link-primary link-hover flex items-center gap-1 text-sm"
				aria-label="Back to top"
			>
				<ChevronDownIcon class_="h-4 w-4 rotate-180" />
				<span>Back to Top</span>
			</button>
		</div>
		
		{#if pastEvents.length > 0}
			<div class="grid gap-4">
				{#each pastEvents as event (event.id)}
					<CalendarEventCard 
						{event} 
						compact={false} 
						onEventClick={handleEventClick}
					/>
				{/each}
			</div>
		{:else if !loading}
			<!-- Empty State for Past Events -->
			<div class="text-center py-8">
				<div class="mb-3 text-base-content/30">
					<CalendarIcon class_="h-12 w-12 mx-auto" />
				</div>
				<p class="text-base-content/60">No past events found</p>
			</div>
		{/if}
	</section>

	<!-- Global Empty State (when no events at all) -->
	{#if filteredEvents.length === 0 && !loading}
		<div class="text-center py-12">
			<div class="mb-4 text-base-content/30">
				<CalendarIcon class_="h-16 w-16 mx-auto" />
			</div>
			<h3 class="text-lg font-medium text-base-content mb-2">No calendar events found</h3>
			<p class="text-base-content/60">No calendar events found from connected relays.</p>
		</div>
	{/if}

	<!-- Loading indicator -->
	{#if loading && filteredEvents.length === 0}
		<div class="text-center py-12">
			<span class="loading loading-lg loading-spinner text-primary"></span>
			<p class="mt-4 text-base-content/60">Loading calendar events...</p>
		</div>
	{/if}
</div>
