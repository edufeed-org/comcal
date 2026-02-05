<!--
  CalendarEventCard Component
  Displays individual calendar events in a card format
  Unified component used in both CalendarGrid and CalendarEventsList
-->

<script>
	import * as m from '$lib/paraglide/messages';
	import { formatCalendarDate } from '../../helpers/calendar.js';
	import EventTags from './EventTags.svelte';
	import LocationLink from '../shared/LocationLink.svelte';
	import ReactionBar from '../reactions/ReactionBar.svelte';
	import AttendeeIndicator from './AttendeeIndicator.svelte';
	import { useCalendarEventRsvps } from '$lib/stores/calendar-event-rsvps.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import { transformRsvps } from '$lib/helpers/rsvpUtils.js';
	import ImageWithFallback from '../shared/ImageWithFallback.svelte';
	import MarkdownRenderer from '../shared/MarkdownRenderer.svelte';

	/**
	 * @typedef {import('../../types/calendar.js').CalendarEvent} CalendarEvent
	 */

	let {
		event,
		compact = false,
		variant = 'card',
		onEventClick = () => {}
	} = $props();

	const isList = $derived(variant === 'list');

	// Load RSVPs for this event
	const rsvpData = $derived(event.originalEvent ? useCalendarEventRsvps(event.originalEvent) : { rsvps: [], loading: false });
	
	// Get current user pubkey
	const userPubkey = $derived(manager.active?.pubkey || null);
	
	// Transform raw RSVPs into grouped data using helper
	const transformedRsvps = $derived(transformRsvps(rsvpData.rsvps, userPubkey));

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

{#if isList}
	<!-- List variant: horizontal row -->
	<div
		class="calendar-event-card-list flex items-center gap-3 p-3 bg-base-100 border border-base-300 rounded-lg hover:shadow-sm hover:border-primary transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 {isAllDay ? 'border-l-4 border-l-info' : ''} {isMultiDay ? 'border-l-4 border-l-secondary' : ''}"
		role="button"
		tabindex="0"
		onclick={handleClick}
		onkeydown={handleKeydown}
	>
		<div class="list-thumbnail w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-base-200">
			{#if event.image}
				<ImageWithFallback
					src={event.image}
					alt={event.title}
					fallbackType="event"
					class="w-full h-full object-cover"
				/>
			{:else}
				<div class="w-full h-full flex items-center justify-center text-base-content/30 text-2xl">📅</div>
			{/if}
		</div>
		<div class="flex-1 min-w-0">
			<div class="font-semibold text-base-content truncate">{event.title}</div>
			<div class="text-sm text-base-content/60 truncate">
				{formatCalendarDate(startDate, 'short')}
				{#if isMultiDay && endDate}
					- {formatCalendarDate(endDate, 'short')}
				{/if}
				{#if !isAllDay}
					· {formatCalendarDate(startDate, 'time')}
					{#if endDate}
						- {formatCalendarDate(endDate, 'time')}
					{/if}
				{:else}
					· {m.event_card_all_day()}
				{/if}
			</div>
			{#if event.locations && event.locations.length > 0}
				<div class="text-sm text-base-content/50 truncate">
					📍 {event.locations[0].name || event.locations[0].address || ''}
				</div>
			{:else if event.summary}
				<div class="text-sm text-base-content/50 truncate">{event.summary}</div>
			{/if}
		</div>
	</div>
{:else}
<div
	class="calendar-event-card w-full max-w-full bg-base-100 border border-base-300 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 {compact
		? 'p-2 text-sm'
		: 'p-3 lg:p-4'} {isAllDay ? 'border-l-4 border-l-info' : ''} {isMultiDay
		? 'border-l-4 border-l-secondary'
		: ''}"
	role="button"
	tabindex="0"
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	<div class="flex flex-col lg:flex-row gap-3 overflow-hidden">
		<!-- Event Image (full mode only) -->
		{#if event.image && !compact}
			<div class="w-full lg:w-auto lg:flex-shrink-0">
				<div class="w-full aspect-[5/2] lg:aspect-square lg:w-20">
					<ImageWithFallback
						src={event.image}
						alt={event.title}
						fallbackType="event"
						class="w-full h-full max-w-full object-cover rounded-lg"
					/>
				</div>
			</div>
		{/if}

		<!-- Content area -->
		<div class="flex-1 min-w-0 overflow-hidden">
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
		<!-- Mobile: Stacked layout -->
		<div class="flex flex-col gap-1 text-sm text-base-content/70 mb-2 lg:hidden">
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
						{m.event_card_all_day()}
					{:else}
						{formatCalendarDate(startDate, 'time')}
						{#if endDate}
							- {formatCalendarDate(endDate, 'time')}
						{/if}
					{/if}
				</span>
			</div>
		</div>

		<!-- Desktop: Horizontal layout -->
		<div class="hidden lg:flex items-center gap-4 text-sm text-base-content/70 mb-2">
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
						{m.event_card_all_day()}
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
		<div class="text-sm text-base-content/70 mb-2 flex items-center gap-1 overflow-hidden">
			<span class="text-xs flex-shrink-0">📍</span>
			<div class="min-w-0 flex-1">
				<LocationLink location={event.locations[0]} />
			</div>
			{#if event.locations.length > 1}
				<span class="text-xs text-base-content/40 ml-1 flex-shrink-0">+{event.locations.length - 1}</span>
			{/if}
		</div>
	{/if}

	<!-- Event Summary (full mode only) -->
	{#if event.summary && !compact}
		<MarkdownRenderer content={event.summary} class="text-sm text-base-content/80 mb-3 line-clamp-2 break-words" />
	{/if}

	<!-- Event Type Badge and Creation Date (full mode only) -->
	{#if !compact}
		<div class="flex flex-wrap items-center gap-2 text-xs text-base-content/60 mb-2">
			<span class="badge badge-outline badge-xs">
				{event.kind === 31922 ? m.event_card_date_event() : m.event_card_time_event()}
			</span>
			{#if event.createdAt}
				<div class="text-xs text-base-content/50">
					<span>{m.event_card_created()} {formatCalendarDate(new Date(event.createdAt * 1000), 'short')}</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Event Tags (clickable) - Only show in full mode -->
	{#if event.hashtags && event.hashtags.length > 0 && !compact}
		<div class="mb-2 overflow-hidden">
			<EventTags 
				tags={event.hashtags} 
				size="sm"
			/>
		</div>
	{/if}

	<!-- Attendee Indicator (replaces old RSVP count) -->
	{#if !compact && transformedRsvps.totalCount > 0}
		<div class="mb-3">
			<AttendeeIndicator
				accepted={transformedRsvps.accepted}
				tentative={transformedRsvps.tentative}
				declined={transformedRsvps.declined}
				totalCount={transformedRsvps.totalCount}
				compact={true}
			/>
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
{/if}
