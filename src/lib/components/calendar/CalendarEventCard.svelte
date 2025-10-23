<!--
  CalendarEventCard Component
  Displays individual calendar events in a card format
  Unified component used in both CalendarGrid and CalendarEventsList
-->

<script>
	import { formatCalendarDate } from '../../helpers/calendar.js';
	import EventTags from './EventTags.svelte';
	import LocationLink from '../shared/LocationLink.svelte';
	import MarkdownRenderer from '../shared/MarkdownRenderer.svelte';
	import ReactionBar from '../reactions/ReactionBar.svelte';

	/**
	 * @typedef {import('../../types/calendar.js').CalendarEvent} CalendarEvent
	 */

	let {
		event,
		compact = false,
		onEventClick = () => {}
	} = $props();

	// Format event times for display
	// event.start and event.end are now UNIX timestamps (seconds) from applesauce helpers
	let startDate = $derived(new Date(event.start * 1000));
	let endDate = $derived(event.end ? new Date(event.end * 1000) : null);
	let isAllDay = $derived(event.kind === 31922); // Date-based events are all-day
	let isMultiDay = $derived(endDate && startDate.toDateString() !== endDate.toDateString());

	/**
	 * @param {Event} e
	 */
	function handleClick(e) {
		e.stopPropagation(); // Prevent event from bubbling up to parent date cell
		onEventClick(event);
	}

	/**
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick(e);
		}
	}

</script>

<div
	class="calendar-event-card bg-base-100 border border-base-300 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 {compact
		? 'p-2 text-sm'
		: 'p-4'} {isAllDay ? 'border-l-4 border-l-info' : ''} {isMultiDay
		? 'border-l-4 border-l-secondary'
		: ''}"
	role="button"
	tabindex="0"
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	<div class="flex gap-3">
		<!-- Event Image (full mode only) -->
		{#if event.image && !compact}
			<div class="flex-shrink-0">
				<img
					src={event.image}
					alt={event.title}
					loading="lazy"
					class="w-20 h-20 object-cover rounded-lg"
				/>
			</div>
		{/if}

		<!-- Content area -->
		<div class="flex-1 min-w-0">
			<!-- Event Title -->
			<div
				class="font-semibold text-base-content {compact
					? 'text-xs font-medium mb-0 truncate'
					: 'text-base mb-2 line-clamp-2'}"
			>
				{event.title}
			</div>

	<!-- Event Date and Time -->
	{#if !compact}
		<div class="flex items-center gap-4 text-sm text-base-content/70 mb-2">
			<!-- Date -->
			<div class="flex items-center gap-1">
				<span class="text-xs">📅</span>
				<span>
					{formatCalendarDate(startDate, 'short')}
					{#if isMultiDay && endDate}
						- {formatCalendarDate(endDate, 'short')}
					{/if}
				</span>
			</div>

			<!-- Time -->
			<div class="flex items-center gap-1">
				<span class="text-xs">🕐</span>
				<span>
					{#if isAllDay}
						All Day
					{:else}
						{formatCalendarDate(startDate, 'time')}
						{#if endDate}
							- {formatCalendarDate(endDate, 'time')}
						{/if}
					{/if}
				</span>
			</div>
		</div>
	{:else}
		<!-- Compact time display -->
		{#if !isAllDay}
			<div class="text-xs text-base-content/70 mb-1">
				{formatCalendarDate(startDate, 'time')}
				{#if endDate}
					- {formatCalendarDate(endDate, 'time')}
				{/if}
			</div>
		{/if}

		<!-- Compact date display for multi-day -->
		{#if isMultiDay}
			<div class="text-xs text-base-content/50 mb-1">
				{formatCalendarDate(startDate, 'short')}
				{#if endDate}
					- {formatCalendarDate(endDate, 'short')}
				{/if}
			</div>
		{/if}
	{/if}

	<!-- Event Location -->
	{#if event.locations && event.locations.length > 0 && !compact}
		<div class="text-sm text-base-content/70 mb-2 flex items-center gap-1">
			<span class="text-xs">📍</span>
			<LocationLink location={event.locations[0]} />
			{#if event.locations.length > 1}
				<span class="text-xs text-base-content/40 ml-1">+{event.locations.length - 1}</span>
			{/if}
		</div>
	{/if}

	<!-- Event Summary (full mode only) -->
	{#if event.summary && !compact}
		<div class="text-sm text-base-content/80 mb-3 line-clamp-2">
			{event.summary}
		</div>
	{/if}

	<!-- Event Type Badge and Creation Date (full mode only) -->
	{#if !compact}
		<div class="flex items-center gap-2 text-xs text-base-content/60 mb-2">
			<span class="badge badge-outline badge-xs">
				{event.kind === 31922 ? 'Date Event' : 'Time Event'}
			</span>
			{#if event.createdAt}
				<div class="text-xs text-base-content/50">
					<span>Created {formatCalendarDate(new Date(event.createdAt * 1000), 'short')}</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Event Tags (clickable) -->
	{#if event.hashtags && event.hashtags.length > 0}
		<div class="mb-2">
			<EventTags 
				tags={event.hashtags} 
				size={compact ? 'xs' : 'sm'} 
				maxDisplay={compact ? 3 : undefined}
			/>
		</div>
	{/if}

	<!-- RSVP Count -->
	{#if (event.rsvpCount || (event.rsvps && event.rsvps.length > 0)) && !compact}
		<div class="flex items-center gap-1 mb-2">
			<span class="text-xs">👥</span>
			<span class="text-sm text-base-content/70">
				{event.rsvpCount || event.rsvps.length} RSVP{(event.rsvpCount || event.rsvps.length) !==
				1
					? 's'
					: ''}
			</span>
		</div>
	{/if}

	<!-- Reactions -->
	{#if !compact}
		<div class="mt-2">
			<ReactionBar event={event.originalEvent || event} />
		</div>
	{/if}
		</div>
	</div>
</div>
