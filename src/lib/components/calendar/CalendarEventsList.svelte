<!--
  SimpleCalendarEventsList Component
  Simple list view of calendar events that accepts events as props
-->

<script>
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { CalendarIcon, ClockIcon, AlertIcon } from '$lib/components/icons';
	
	// Import existing UI components
	import CalendarEventCard from '$lib/components/calendar/CalendarEventCard.svelte';

	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
	 */

	// Props
	let { 
		events = /** @type {CalendarEvent[]} */ ([]), 
		loading = false,
		error = /** @type {string | null} */ (null)
	} = $props();

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
										<CalendarIcon class_="w-4 h-4" />
										<span>{formatEventDate(event)}</span>
									</div>
									
									<div class="flex items-center gap-1">
										<ClockIcon class_="w-4 h-4" />
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
				<CalendarIcon class_="h-16 w-16 mx-auto" />
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
