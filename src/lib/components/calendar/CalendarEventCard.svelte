<!--
  CalendarEventCard Component
  Displays individual calendar events in a card format
-->

<script>
	import { formatCalendarDate } from '../../helpers/calendar.js';

	/**
	 * @typedef {import('../../types/calendar.js').CalendarEvent} CalendarEvent
	 */

	/** @type {CalendarEvent} */
	export let event;
	
	/** @type {boolean} */
	export let compact = false;
	
	/** @type {function(CalendarEvent): void} */
	export let onEventClick = () => {};

	// Format event times for display
	$: startDate = new Date(event.start * 1000);
	$: endDate = event.end ? new Date(event.end * 1000) : null;
	$: isAllDay = event.kind === 31922; // Date-based events are all-day
	$: isMultiDay = endDate && startDate.toDateString() !== endDate.toDateString();

	function handleClick() {
		onEventClick(event);
	}

	/**
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}
</script>

	<div
		class="bg-base-100 border border-base-300 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 {compact ? 'p-2 text-sm' : 'p-3'} {isAllDay ? 'border-l-4 border-l-info' : ''} {isMultiDay ? 'border-l-4 border-l-secondary' : ''}"
		role="button"
		tabindex="0"
		onclick={handleClick}
		onkeydown={handleKeydown}
	>
	<!-- Event Title -->
	<div class="font-semibold text-base-content mb-1 {compact ? 'text-xs font-medium mb-0 truncate' : 'line-clamp-2'}">
		{event.title}
	</div>

	<!-- Event Time (for time-based events) -->
	{#if !isAllDay && !compact}
		<div class="text-sm text-base-content/70 mb-1">
			{formatCalendarDate(startDate, 'time')}
			{#if endDate}
				- {formatCalendarDate(endDate, 'time')}
			{/if}
		</div>
	{/if}

	<!-- Event Date (for compact view or multi-day events) -->
	{#if compact || isMultiDay}
		<div class="text-xs text-base-content/50 mb-1">
			{formatCalendarDate(startDate, 'short')}
			{#if isMultiDay && endDate}
				- {formatCalendarDate(endDate, 'short')}
			{/if}
		</div>
	{/if}

	<!-- Event Location -->
	{#if event.locations && event.locations.length > 0 && !compact}
		<div class="text-sm text-base-content/70 mb-2 flex items-center gap-1">
			<span class="text-xs">📍</span>
			{event.locations[0]}
			{#if event.locations.length > 1}
				<span class="text-xs text-base-content/40 ml-1">+{event.locations.length - 1}</span>
			{/if}
		</div>
	{/if}

	<!-- Event Summary (truncated for compact view) -->
	{#if event.summary && !compact}
		<div class="text-sm text-base-content/80 mb-2 line-clamp-3">
			{event.summary}
		</div>
	{/if}

	<!-- Event Image -->
	{#if event.image && !compact}
		<div class="mb-2">
			<img src={event.image} alt={event.title} loading="lazy" class="w-full h-24 object-cover rounded" />
		</div>
	{/if}

	<!-- Event Tags -->
	{#if event.hashtags && event.hashtags.length > 0 && !compact}
		<div class="flex flex-wrap gap-1">
			{#each event.hashtags.slice(0, 3) as tag}
				<span class="badge badge-outline text-xs">#{tag}</span>
			{/each}
			{#if event.hashtags.length > 3}
				<span class="text-xs text-base-content/40">+{event.hashtags.length - 3}</span>
			{/if}
		</div>
	{/if}
</div>
