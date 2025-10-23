<script>
	import { getWeekDates, getMonthDates, formatCalendarDate, isToday, isCurrentMonth, getWeekdayHeaders, createDateKey, groupEventsByDate } from '../../helpers/calendar.js';
	import CalendarEventCard from './CalendarEventCard.svelte';
	import { cEvents } from '$lib/stores/calendar-events.svelte.js';

	/**
	 * @typedef {import('../../types/calendar.js').CalendarEvent} CalendarEvent
	 * @typedef {import('../../types/calendar.js').CalendarViewMode} CalendarViewMode
	 */

	let {
		currentDate,
		viewMode,
		events,
		onEventClick = () => {},
		onDateClick = () => {}
	} = $props();

	// Get dates for current view (reactive to prop changes)
	let viewDates = $derived(getViewDates(currentDate, viewMode));
	let weekdays = $derived(getWeekdayHeaders());

	let groupedEvents = $derived.by(() => {
		const grouped = groupEventsByDate(events)
		return grouped
		
	})

	/**
	 * Get dates array for current view mode
	 * @param {Date} date
	 * @param {CalendarViewMode} mode
	 * @returns {Date[]}
	 */
	function getViewDates(date, mode) {
		switch (mode) {
			case 'month':
				return getMonthDates(date);
			case 'week':
				return getWeekDates(date);
			case 'day':
				return [new Date(date)];
			default:
				return getMonthDates(date);
		}
	}

	/**
	 * Get events for a specific date
	 * @param {Date} date
	 * @returns {CalendarEvent[]}
	 */
	function getEventsForDate(date) {
		// Use UTC-based date key to match how events are grouped
		// This ensures consistent date key generation between calendar grid and event grouping
		const dateKey = createDateKey(date); // UTC-based YYYY-MM-DD format

		const eventsMap = groupedEvents;
		const eventsForDate = eventsMap.get(dateKey) || [];

		return eventsForDate;
	}

	/**
	 * @param {MouseEvent | KeyboardEvent} e
	 * @param {Date} date
	 */
	function handleDateClick(e, date) {
		// Prevent date navigation if clicking on an event
		if (e.target && /** @type {Element} */ (e.target).closest('.calendar-event-card')) {
			return;
		}
		onDateClick(date);
	}

	/**
	 * @param {CalendarEvent} event
	 */
	function handleEventClick(event) {
		onEventClick(event);
	}

	/**
	 * @param {KeyboardEvent} e
	 * @param {Date} date
	 */
	function handleDateKeydown(e, date) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleDateClick(e, date);
		}
	}
</script>

<div class="bg-base-100 border border-base-300 rounded-lg overflow-hidden">
	<!-- Weekday Headers (for month and week views) -->
	{#if viewMode !== 'day'}
		<div class="grid grid-cols-7 bg-base-200 border-b border-base-300">
			{#each weekdays as weekday}
				<div class="p-3 text-center text-sm font-medium text-base-content border-r border-base-300 last:border-r-0">
					{weekday}
				</div>
			{/each}
		</div>
	{/if}
	<!-- Calendar Grid -->
	<div class="grid {viewMode === 'month' ? 'grid-cols-7' : viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-1'} gap-px bg-base-300">
		{#each viewDates as date}
			{@const dayEvents = getEventsForDate(date)}
			{@const isCurrentDay = isToday(date)}
			{@const isInCurrentMonth = viewMode !== 'month' || isCurrentMonth(date, currentDate)}
			
			{@const cellClasses = [
				'min-h-24 p-2 hover:bg-base-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset cursor-pointer transition-colors duration-200',
				viewMode === 'day' ? 'min-h-96 p-4' : viewMode === 'week' ? 'min-h-32' : '',
				isCurrentDay ? 'bg-primary/10 border-primary' : '',
				!isInCurrentMonth ? 'bg-base-200 text-base-content/40' : '',
				dayEvents.length > 0 ? 'bg-info/10' : '',
				isCurrentDay && dayEvents.length > 0 ? 'bg-primary/20' : ''
			].filter(Boolean).join(' ')}

			<div
				class={cellClasses}
				role="button"
				tabindex="0"
				onclick={(e) => handleDateClick(e, date)}
				onkeydown={(e) => handleDateKeydown(e, date)}
			>
				<!-- Date Number -->
				<div class="text-sm font-medium mb-1 {isCurrentDay ? 'text-primary' : ''}">
					{#if viewMode === 'day'}
						<div class="text-center mb-4">
							<div class="text-lg font-semibold text-base-content">{formatCalendarDate(date, 'long')}</div>
							<div class="text-3xl font-bold text-primary">{date.getDate()}</div>
						</div>
					{:else}
						{date.getDate()}
					{/if}
				</div>

				<!-- Events for this date -->
				<div class="space-y-1 {viewMode === 'day' ? 'space-y-2' : ''}">
					{#if viewMode === 'month'}
						<!-- Month view: Show compact event indicators -->
						{#each dayEvents.slice(0, 3) as event}
							<CalendarEventCard
								{event}
								compact={true}
								onEventClick={handleEventClick}
							/>
						{/each}
						{#if dayEvents.length > 3}
							<div class="text-xs text-base-content/50 text-center py-1">
								+{dayEvents.length - 3} more
							</div>
						{/if}
					{:else}
						<!-- Week/Day view: Show full event cards -->
						{#each dayEvents as event}
							<CalendarEventCard
								{event}
								compact={viewMode === 'week'}
								onEventClick={handleEventClick}
							/>
						{/each}
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
