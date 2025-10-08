<!--
  CalendarSelector Component
  Reusable component for selecting calendars to add events to
-->

<script>
	import { CheckIcon, PlusIcon } from '../icons';

	/**
	 * @typedef {Object} Calendar
	 * @property {string} id - Calendar ID
	 * @property {string} title - Calendar title
	 * @property {string} [description] - Calendar description
	 * @property {string[]} eventReferences - Array of event references
	 */

	let {
		calendars = [],
		selectedCalendarIds = $bindable([]),
		event = null,
		title = 'Select Calendars',
		showSelectAll = true
	} = $props();

	// Get calendars that already contain this event
	let calendarsContainingEvent = $derived(() => {
		if (!event || !event.kind || !event.pubkey || !event.dTag) {
			return new Set();
		}
		const eventRef = `${event.kind}:${event.pubkey}:${event.dTag}`;
		return new Set(
			calendars
				.filter((calendar) => calendar.eventReferences.includes(eventRef))
				.map((calendar) => calendar.id)
		);
	});

	/**
	 * Toggle calendar selection
	 * @param {string} calendarId
	 */
	function toggleCalendarSelection(calendarId) {
		if (selectedCalendarIds.includes(calendarId)) {
			selectedCalendarIds = selectedCalendarIds.filter((id) => id !== calendarId);
		} else {
			selectedCalendarIds = [...selectedCalendarIds, calendarId];
		}
	}

	/**
	 * Select all calendars that don't already contain the event
	 */
	function selectAllCalendars() {
		const availableCalendars = calendars
			.filter((calendar) => !calendarsContainingEvent().has(calendar.id))
			.map((calendar) => calendar.id);
		selectedCalendarIds = availableCalendars;
	}

	/**
	 * Deselect all calendars
	 */
	function deselectAllCalendars() {
		selectedCalendarIds = [];
	}
</script>

<div class="mb-3">
	<div class="mb-2 flex items-center justify-between">
		<label class="block text-sm font-medium text-base-content">
			{title}
		</label>
		{#if showSelectAll && calendars.length > 1}
			<div class="flex gap-2">
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					onclick={selectAllCalendars}
					disabled={selectedCalendarIds.length === calendars.length}
				>
					Select All
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-xs"
					onclick={deselectAllCalendars}
					disabled={selectedCalendarIds.length === 0}
				>
					Deselect All
				</button>
			</div>
		{/if}
	</div>

	<!-- Calendar Checkboxes -->
	<div class="max-h-40 overflow-y-auto rounded-lg border border-base-300 p-3">
		{#each calendars as calendar}
			{@const isAlreadyInCalendar = event ? calendarsContainingEvent().has(calendar.id) : false}
			{@const isSelected = selectedCalendarIds.includes(calendar.id)}
			<label class="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-base-200">
				<input
					type="checkbox"
					class="checkbox checkbox-primary"
					checked={isSelected || isAlreadyInCalendar}
					onchange={() => toggleCalendarSelection(calendar.id)}
				/>
				<div class="flex-1">
					<span class="text-sm font-medium">{calendar.title}</span>
					{#if calendar.description}
						<span class="ml-2 truncate text-xs text-base-content/60">{calendar.description}</span>
					{/if}
				</div>
				{#if isAlreadyInCalendar && !isSelected}
					<span class="text-xs font-medium text-success">(Added - click to remove)</span>
				{:else if isAlreadyInCalendar && isSelected}
					<span class="text-xs font-medium text-warning">(Will be removed)</span>
				{:else if isSelected}
					<span class="text-xs font-medium text-info">(Will be added)</span>
				{/if}
			</label>
		{/each}
		{#if calendars.length === 0}
			<div class="py-4 text-center text-base-content/60">No calendars available</div>
		{/if}
	</div>

	<!-- Selected Calendars Summary -->
	{#if selectedCalendarIds.length > 0}
		<div class="mt-2 text-sm text-base-content/70">
			{selectedCalendarIds.length} calendar{selectedCalendarIds.length > 1 ? 's' : ''} selected
		</div>
	{/if}
</div>
