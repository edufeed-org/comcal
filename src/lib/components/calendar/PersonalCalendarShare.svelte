<!--
  PersonalCalendarShare Component
  Manages adding/removing calendar events to/from personal calendars
  Features:
  - Automatically checks which calendars contain the event
  - Shows correct checkbox states
  - Handles add/remove operations
  - Built-in debug logging
  - Supports compact mode for different layouts
-->

<script>
	import { manager } from '$lib/stores/accounts.svelte';
	import {
		useCalendarManagement,
		registerCalendarEventsRefreshCallback
	} from '../../stores/calendar-management-store.svelte.js';
	import { PlusIcon, CheckIcon, AlertIcon } from '../icons';

	/**
	 * @typedef {Object} Props
	 * @property {any} event - Calendar event to share
	 * @property {any} activeUser - Current active user
	 * @property {boolean} [compact=false] - Use compact layout for dropdowns
	 */

	/** @type {Props} */
	let { event, activeUser, compact = false } = $props();

	// Get calendar management store
	let calendarManagement = $derived(activeUser ? useCalendarManagement(activeUser.pubkey) : null);

	// State management
	let selectedCalendarIds = $state(/** @type {string[]} */ ([]));
	let isProcessingChanges = $state(false);
	let calendarChangesError = $state('');
	let calendarChangesSuccess = $state(false);

	/**
	 * Generate event reference for NIP-52 (addressable format)
	 * Handles missing dTag by extracting from originalEvent or generating one
	 * @param {any} evt
	 * @returns {string | null}
	 */
	function getEventReference(evt) {
		console.log('📅 PersonalCalendarShare: Checking event reference for:', evt?.title || 'Unknown');
		
		if (!evt || !evt.kind || !evt.pubkey) {
			console.warn('📅 PersonalCalendarShare: Missing required event properties (kind or pubkey)');
			return null;
		}

		// Try to get dTag from event
		let dTag = evt.dTag;
		
		// If no dTag, try to extract from originalEvent tags
		if (!dTag && evt.originalEvent?.tags) {
			const dTagArray = evt.originalEvent.tags.find((/** @type {string[]} */ t) => t[0] === 'd');
			dTag = dTagArray?.[1];
			console.log('📅 PersonalCalendarShare: Extracted dTag from originalEvent:', dTag);
		}
		
		// If still no dTag, generate one from event ID
		if (!dTag && evt.id) {
			dTag = `event-${evt.id.slice(0, 8)}`;
			console.log('📅 PersonalCalendarShare: Generated dTag from event ID:', dTag);
		}

		if (!dTag) {
			console.warn('📅 PersonalCalendarShare: Unable to determine dTag for event');
			return null;
		}

		const reference = `${evt.kind}:${evt.pubkey}:${dTag}`;
		console.log('📅 PersonalCalendarShare: Event reference:', reference);
		return reference;
	}

	/**
	 * Check which calendars already contain this event
	 * Returns a Set of calendar IDs
	 */
	let calendarsContainingEvent = $derived(() => {
		if (!calendarManagement || !event) {
			console.log('📅 PersonalCalendarShare: No calendar management or event');
			return new Set();
		}

		const eventRef = getEventReference(event);
		if (!eventRef) {
			console.log('📅 PersonalCalendarShare: No event reference available');
			return new Set();
		}

		const containingCalendars = calendarManagement.calendars
			.filter((calendar) => {
				const contains = calendar.eventReferences.includes(eventRef);
				if (contains) {
					console.log(`📅 PersonalCalendarShare: Calendar "${calendar.title}" contains event`);
				}
				return contains;
			})
			.map((calendar) => calendar.id);

		console.log(`📅 PersonalCalendarShare: Found ${containingCalendars.length} calendars containing event`);
		return new Set(containingCalendars);
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
		console.log('📅 PersonalCalendarShare: Selected calendars:', selectedCalendarIds);
	}

	/**
	 * Select all calendars that don't already contain the event
	 */
	function selectAllCalendars() {
		if (calendarManagement) {
			const availableCalendars = calendarManagement.calendars
				.filter((calendar) => !calendarsContainingEvent().has(calendar.id))
				.map((calendar) => calendar.id);
			selectedCalendarIds = availableCalendars;
			console.log('📅 PersonalCalendarShare: Selected all available calendars:', availableCalendars);
		}
	}

	/**
	 * Deselect all calendars
	 */
	function deselectAllCalendars() {
		selectedCalendarIds = [];
		console.log('📅 PersonalCalendarShare: Deselected all calendars');
	}

	/**
	 * Handle applying calendar changes (add/remove events)
	 */
	async function handleApplyCalendarChanges() {
		if (selectedCalendarIds.length === 0 || !calendarManagement || !event) {
			console.log('📅 PersonalCalendarShare: Nothing to apply');
			return;
		}

		isProcessingChanges = true;
		calendarChangesError = '';
		calendarChangesSuccess = false;

		console.log(`📅 PersonalCalendarShare: Applying changes to ${selectedCalendarIds.length} calendars`);

		try {
			// Ensure event has a dTag
			const eventRef = getEventReference(event);
			if (!eventRef) {
				throw new Error('Cannot process event: missing required properties');
			}

			// Extract dTag from the reference
			const parts = eventRef.split(':');
			const dTag = parts[2];

			const eventWithDTag = {
				...event,
				dTag: dTag
			};

			console.log('📅 PersonalCalendarShare: Event prepared with dTag:', dTag);

			// Process each selected calendar
			const results = await Promise.allSettled(
				selectedCalendarIds.map(async (calendarId) => {
					const isAlreadyInCalendar = calendarsContainingEvent().has(calendarId);
					const calendar = calendarManagement.calendars.find((c) => c.id === calendarId);

					if (isAlreadyInCalendar) {
						console.log(`📅 PersonalCalendarShare: Removing event from calendar "${calendar?.title}"`);
						return await calendarManagement.removeEventFromCalendar(calendarId, eventWithDTag);
					} else {
						console.log(`📅 PersonalCalendarShare: Adding event to calendar "${calendar?.title}"`);
						return await calendarManagement.addEventToCalendar(calendarId, eventWithDTag);
					}
				})
			);

			// Check results
			const successful = results.filter(
				(result) => result.status === 'fulfilled' && result.value === true
			).length;

			console.log(`📅 PersonalCalendarShare: ${successful}/${results.length} operations successful`);

			if (successful > 0) {
				calendarChangesSuccess = true;
				selectedCalendarIds = []; // Reset selection
				
				// Note: Calendar events refresh is handled automatically by the store
				console.log('📅 PersonalCalendarShare: Calendar changes applied successfully');
			} else {
				calendarChangesError = 'Failed to apply changes to any calendar';
			}
		} catch (error) {
			console.error('📅 PersonalCalendarShare: Error applying changes:', error);
			calendarChangesError =
				error instanceof Error ? error.message : 'Failed to apply calendar changes';
		} finally {
			isProcessingChanges = false;
		}
	}
</script>

<!-- Calendar Selection UI -->
<div class="personal-calendar-share" class:compact>
	<div class="mb-3">
		<div class="mb-2 flex items-center justify-between">
			<label class="block text-sm font-medium text-base-content">
				{compact ? 'Personal Calendars' : 'Select Calendars'}
			</label>
			{#if calendarManagement && calendarManagement.calendars.length > 1}
				<div class="flex gap-2">
					<button
						class="btn btn-ghost btn-xs"
						onclick={selectAllCalendars}
						disabled={selectedCalendarIds.length === calendarManagement.calendars.length}
					>
						Select All
					</button>
					<button
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
		{#if calendarManagement}
			{#if calendarManagement.loading}
				<div class="flex items-center justify-center py-8">
					<span class="loading loading-spinner {compact ? 'loading-sm' : 'loading-md'}"></span>
				</div>
			{:else if calendarManagement.calendars.length > 0}
				<div class="max-h-40 overflow-y-auto rounded-lg border border-base-300 p-3">
					{#each calendarManagement.calendars as calendar}
						{@const isAlreadyInCalendar = calendarsContainingEvent().has(calendar.id)}
						{@const isSelected = selectedCalendarIds.includes(calendar.id)}
						<label class="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-base-200">
							<input
								type="checkbox"
								class="checkbox checkbox-primary {compact ? 'checkbox-sm' : ''}"
								checked={isSelected || isAlreadyInCalendar}
								onchange={() => toggleCalendarSelection(calendar.id)}
							/>
							<span class="font-medium {compact ? 'text-sm' : ''}">{calendar.title}</span>
							{#if calendar.description && !compact}
								<span class="truncate text-xs text-base-content/60">{calendar.description}</span>
							{/if}
							{#if isAlreadyInCalendar && !isSelected}
								<span class="text-xs font-medium text-success">(Added - click to remove)</span>
							{:else if isAlreadyInCalendar && isSelected}
								<span class="text-xs font-medium text-warning">(Will be removed)</span>
							{:else if isSelected}
								<span class="text-xs font-medium text-info">(Will be added)</span>
							{/if}
						</label>
					{/each}
				</div>

				<!-- Selected Calendars Summary -->
				{#if selectedCalendarIds.length > 0}
					<div class="mt-2 text-sm text-base-content/70">
						{selectedCalendarIds.length} calendar{selectedCalendarIds.length > 1 ? 's' : ''} selected
					</div>
				{/if}
			{:else}
				<div class="py-4 text-center text-base-content/60 {compact ? 'text-sm' : ''}">
					No calendars available. <a href="/calendar/manage" class="link">Create one</a>.
				</div>
			{/if}
		{/if}
	</div>

	<!-- Apply Changes Button -->
	<div class="flex items-center gap-3">
		<button
			class="btn btn-primary {compact ? 'btn-sm btn-block' : ''}"
			disabled={selectedCalendarIds.length === 0 || isProcessingChanges}
			onclick={handleApplyCalendarChanges}
		>
			{#if isProcessingChanges}
				<span class="loading loading-spinner {compact ? 'loading-sm' : ''}"></span>
				Applying changes to {selectedCalendarIds.length} calendar{selectedCalendarIds.length > 1
					? 's'
					: ''}...
			{:else}
				<PlusIcon class_="w-4 h-4 mr-2" />
				Apply Changes to {selectedCalendarIds.length || 'Selected'} Calendar{selectedCalendarIds.length !==
				1
					? 's'
					: ''}
			{/if}
		</button>
	</div>

	<!-- Success Message -->
	{#if calendarChangesSuccess}
		<div class="alert alert-success mt-3 {compact ? 'py-2' : ''}">
			<CheckIcon class_="{compact ? 'w-4 h-4' : 'w-5 h-5'}" />
			<span class="{compact ? 'text-sm' : ''}">Calendar changes applied successfully!</span>
		</div>
	{/if}

	<!-- Error Message -->
	{#if calendarChangesError}
		<div class="alert alert-error mt-3 {compact ? 'py-2' : ''}">
			<AlertIcon class_="{compact ? 'w-4 h-4' : 'w-5 h-5'}" />
			<span class="{compact ? 'text-sm' : ''}">{calendarChangesError}</span>
		</div>
	{/if}
</div>

<style>
	.personal-calendar-share.compact {
		/* Compact mode adjustments can be added here if needed */
	}
</style>
