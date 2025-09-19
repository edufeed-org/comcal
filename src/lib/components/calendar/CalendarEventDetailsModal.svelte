<!--
  CalendarEventDetailsModal Component
  Modal for displaying calendar event details in read-only format
-->

<script>
	import { formatCalendarDate } from '../../helpers/calendar.js';
	import { modalStore } from '../../stores/modal.svelte.js';
	import { useCalendarManagement, registerCalendarEventsRefreshCallback } from '../../stores/calendar-management-store.svelte.js';
	import { manager } from '../../accounts.svelte.js';
	import { CloseIcon, CalendarIcon, ClockIcon, LocationIcon, PlusIcon, CheckIcon, AlertIcon } from '$lib/components/icons';
	import EventDebugInfo from './EventDebugInfo.svelte';

	/**
	 * @typedef {import('../../types/calendar.js').CalendarEvent} CalendarEvent
	 */

	// Get modal store
	const modal = modalStore;

	// Reactive user state
	let activeUser = $state(manager.active);
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

	// Get calendar management store for authenticated user
	let calendarManagement = $derived(
		activeUser ? useCalendarManagement(activeUser.pubkey) : null
	);

	// Add to calendar state
	let selectedCalendarIds = $state(/** @type {string[]} */ ([]));
	let isProcessingChanges = $state(false);
	let calendarChangesError = $state('');
	let calendarChangesSuccess = $state(false);

	// Helper function to generate event reference for NIP-52
	/**
	 * @param {any} event
	 * @returns {string | null}
	 */
	function getEventReference(event) {
		if (!event || !event.kind || !event.pubkey || !event.dTag) {
			return null;
		}
		return `${event.kind}:${event.pubkey}:${event.dTag}`;
	}

	// Check which calendars already contain this event
	let calendarsContainingEvent = $derived(() => {
		if (!calendarManagement || !event) {
			return new Set();
		}
		const eventRef = getEventReference(event);
		if (!eventRef) {
			return new Set();
		}
		return new Set(
			calendarManagement.calendars
				.filter(calendar => calendar.eventReferences.includes(eventRef))
				.map(calendar => calendar.id)
		);
	});

	// Generate unique modal ID
	const modalId = 'event-details-modal';

	// Reactive effect to handle modal opening/closing
	$effect(() => {
		const currentModal = modal.activeModal;
		const dialog = /** @type {HTMLDialogElement} */ (document.getElementById(modalId));

		if (currentModal === 'eventDetails' && dialog && !dialog.open) {
			console.log('CalendarEventDetailsModal: Opening event details modal');
			// Register refresh callback to update calendar display when events are added
			if (activeUser) {
				registerCalendarEventsRefreshCallback(() => {
					console.log('📅 Modal: Refreshing calendar events after calendar update');
					// The simplified calendar architecture will automatically refresh
					// when calendar management changes occur
				});
			}
			dialog.showModal();
		} else if (currentModal !== 'eventDetails' && dialog && dialog.open) {
			console.log('CalendarEventDetailsModal: Closing event details modal');
			dialog.close();
		}
	});

	// Get event from modal props
	let event = $derived(modal.modalProps && /** @type {any} */ (modal.modalProps).event ? /** @type {any} */ (modal.modalProps).event : null);

	// Format event data for display
	let startDate = $derived(event ? new Date(event.start * 1000) : null);
	let endDate = $derived(event && event.end ? new Date(event.end * 1000) : null);
	let isAllDay = $derived(event ? event.kind === 31922 : false);
	let isMultiDay = $derived(event && endDate && startDate ? startDate.toDateString() !== endDate.toDateString() : false);



	/**
	 * Handle backdrop click
	 * @param {MouseEvent} e
	 */
	function handleBackdropClick(e) {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}

	/**
	 * Handle escape key
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}

	/**
	 * Copy event ID to clipboard
	 */
	async function copyEventId() {
		if (event && event.id) {
			try {
				await navigator.clipboard.writeText(event.id);
				// Could add a toast notification here if desired
				console.log('Event ID copied to clipboard:', event.id);
			} catch (err) {
				console.error('Failed to copy event ID:', err);
			}
		}
	}

	/**
	 * Handle applying calendar changes (add/remove events)
	 */
	async function handleApplyCalendarChanges() {
		if (selectedCalendarIds.length === 0 || !calendarManagement || !event) {
			return;
		}

		isProcessingChanges = true;
		calendarChangesError = '';
		calendarChangesSuccess = false;

		try {
			// Check if event already has a dTag, if not generate one
			const eventWithDTag = {
				...event,
				dTag: event.dTag || `event-${event.id.slice(0, 8)}`
			};

			// Process each selected calendar
			const results = await Promise.allSettled(
				selectedCalendarIds.map(async (calendarId) => {
					const isAlreadyInCalendar = calendarsContainingEvent().has(calendarId);

					if (isAlreadyInCalendar) {
						// Remove event from calendar
						return await calendarManagement.removeEventFromCalendar(calendarId, eventWithDTag);
					} else {
						// Add event to calendar
						return await calendarManagement.addEventToCalendar(calendarId, eventWithDTag);
					}
				})
			);

			// Check results
			const successful = results.filter(result =>
				result.status === 'fulfilled' && result.value === true
			).length;

			if (successful > 0) {
				calendarChangesSuccess = true;
				selectedCalendarIds = []; // Reset selection
				console.log(`Calendar changes applied successfully to ${successful}/${selectedCalendarIds.length} calendars`);
			} else {
				calendarChangesError = 'Failed to apply changes to any calendar';
			}
		} catch (error) {
			console.error('Error applying calendar changes:', error);
			calendarChangesError = error instanceof Error ? error.message : 'Failed to apply calendar changes';
		} finally {
			isProcessingChanges = false;
		}
	}

	/**
	 * Toggle calendar selection
	 * @param {string} calendarId
	 */
	function toggleCalendarSelection(calendarId) {
		if (selectedCalendarIds.includes(calendarId)) {
			selectedCalendarIds = selectedCalendarIds.filter(id => id !== calendarId);
		} else {
			selectedCalendarIds = [...selectedCalendarIds, calendarId];
		}
	}

	/**
	 * Select all calendars that don't already contain the event
	 */
	function selectAllCalendars() {
		if (calendarManagement) {
			const availableCalendars = calendarManagement.calendars
				.filter(calendar => !calendarsContainingEvent().has(calendar.id))
				.map(calendar => calendar.id);
			selectedCalendarIds = availableCalendars;
		}
	}

	/**
	 * Deselect all calendars
	 */
	function deselectAllCalendars() {
		selectedCalendarIds = [];
	}

	/**
	 * Reset calendar changes state when modal closes
	 */
	function resetCalendarChangesState() {
		selectedCalendarIds = [];
		isProcessingChanges = false;
		calendarChangesError = '';
		calendarChangesSuccess = false;
	}

	/**
	 * Handle modal close with state reset
	 */
	function handleClose() {
		resetCalendarChangesState();
		modal.closeModal();
	}
</script>

<!-- Event Details Modal -->
{#if modal.activeModal === 'eventDetails' && event}
	<div
		class="modal modal-open"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="event-title"
	>
		<div class="modal-box max-w-2xl w-full max-h-screen overflow-y-auto">
			<!-- Modal Header -->
			<div class="flex items-center justify-between mb-6">
				<h2 id="event-title" class="text-2xl font-bold text-base-content">
					{event.title}
				</h2>
				<button
					class="btn btn-sm btn-circle btn-ghost"
					onclick={handleClose}
					aria-label="Close modal"
				>
					<CloseIcon class_="w-6 h-6" />
				</button>
			</div>

			<!-- Event Image -->
			{#if event.image}
				<div class="mb-6">
					<img
						src={event.image}
						alt={event.title}
						class="w-full h-48 object-cover rounded-lg"
						loading="lazy"
					/>
				</div>
			{/if}

			<!-- Event Description -->
			{#if event.summary}
				<div class="mb-6">
					<h3 class="text-lg font-semibold text-base-content mb-2">Description</h3>
					<p class="text-base-content/80 leading-relaxed whitespace-pre-wrap">
						{event.summary}
					</p>
				</div>
			{/if}

			<!-- Event Date and Time -->
			<div class="mb-6">
				<h3 class="text-lg font-semibold text-base-content mb-3">Date & Time</h3>
				<div class="bg-base-200 rounded-lg p-4">
					{#if isAllDay}
						<div class="flex items-center gap-2 mb-2">
							<CalendarIcon class_="w-5 h-5 text-info" />
							<span class="text-base-content font-medium">All Day Event</span>
						</div>
						<div class="text-base-content/70 ml-7">
							{isMultiDay && endDate && startDate
								? `${formatCalendarDate(startDate, 'long')} - ${formatCalendarDate(endDate, 'long')}`
								: startDate ? formatCalendarDate(startDate, 'long') : ''
							}
						</div>
					{:else}
						<div class="space-y-2">
							{#if startDate}
								<div class="flex items-center gap-2">
									<ClockIcon class_="w-5 h-5 text-primary" />
									<span class="text-base-content font-medium">Start:</span>
									<span class="text-base-content/80">
										{formatCalendarDate(startDate, 'long')} at {formatCalendarDate(startDate, 'time')}
										{#if event.startTimezone}
											<span class="text-xs text-base-content/60">({event.startTimezone})</span>
										{/if}
									</span>
								</div>
							{/if}
							{#if endDate}
								<div class="flex items-center gap-2">
									<ClockIcon class_="w-5 h-5 text-secondary" />
									<span class="text-base-content font-medium">End:</span>
									<span class="text-base-content/80">
										{formatCalendarDate(endDate, 'long')} at {formatCalendarDate(endDate, 'time')}
										{#if event.endTimezone}
											<span class="text-xs text-base-content/60">({event.endTimezone})</span>
										{/if}
									</span>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Event Locations -->
			{#if event.locations && event.locations.length > 0}
				<div class="mb-6">
					<h3 class="text-lg font-semibold text-base-content mb-3">Location{#if event.locations.length > 1}s{/if}</h3>
					<div class="space-y-2">
						{#each event.locations as location}
							<div class="flex items-start gap-3 bg-base-200 rounded-lg p-3">
								<LocationIcon class_="w-5 h-5 text-base-content/60 mt-0.5" />
								<span class="text-base-content/80">{location}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Event Participants -->
			{#if event.participants && event.participants.length > 0}
				<div class="mb-6">
					<h3 class="text-lg font-semibold text-base-content mb-3">Participant{#if event.participants.length > 1}s{/if}</h3>
					<div class="space-y-2">
						{#each event.participants as participant}
							<div class="flex items-center gap-3 bg-base-200 rounded-lg p-3">
								<div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-content font-semibold text-sm">
									{participant.pubkey.slice(0, 2).toUpperCase()}
								</div>
								<div class="flex-1">
									<div class="text-base-content font-medium">
										{participant.pubkey.slice(0, 8)}...{participant.pubkey.slice(-4)}
									</div>
									{#if participant.role}
										<div class="text-xs text-base-content/60">{participant.role}</div>
									{/if}
								</div>
								{#if participant.relay}
									<div class="text-xs text-base-content/50">
										{participant.relay}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Event Tags -->
			{#if event.hashtags && event.hashtags.length > 0}
				<div class="mb-6">
					<h3 class="text-lg font-semibold text-base-content mb-3">Tags</h3>
					<div class="flex flex-wrap gap-2">
						{#each event.hashtags as tag}
							<span class="badge badge-outline badge-lg">#{tag}</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Add to Calendar Section (only for authenticated users) -->
			{#if activeUser && calendarManagement}
				<div class="border-t border-base-300 pt-4 mb-4">
					<h3 class="text-lg font-semibold text-base-content mb-3">Manage Calendar Events</h3>

					<!-- Calendar Selection -->
					<div class="mb-3">
						<div class="flex items-center justify-between mb-2">
							<label class="block text-sm font-medium text-base-content">
								Select Calendars
							</label>
							{#if calendarManagement.calendars.length > 1}
								<div class="flex gap-2">
									<button
										class="btn btn-xs btn-ghost"
										onclick={selectAllCalendars}
										disabled={selectedCalendarIds.length === calendarManagement.calendars.length}
									>
										Select All
									</button>
									<button
										class="btn btn-xs btn-ghost"
										onclick={deselectAllCalendars}
										disabled={selectedCalendarIds.length === 0}
									>
										Deselect All
									</button>
								</div>
							{/if}
						</div>

						<!-- Calendar Checkboxes -->
						<div class="max-h-40 overflow-y-auto border border-base-300 rounded-lg p-3">
							{#each calendarManagement.calendars as calendar}
								{@const isAlreadyInCalendar = calendarsContainingEvent().has(calendar.id)}
								{@const isSelected = selectedCalendarIds.includes(calendar.id)}
								<label class="flex items-center gap-3 cursor-pointer hover:bg-base-200 p-2 rounded">
									<input
										type="checkbox"
										class="checkbox checkbox-primary"
										checked={isSelected || isAlreadyInCalendar}
										onchange={() => toggleCalendarSelection(calendar.id)}
									/>
									<span class="text-sm font-medium">{calendar.title}</span>
									{#if calendar.description}
										<span class="text-xs text-base-content/60 truncate">{calendar.description}</span>
									{/if}
									{#if isAlreadyInCalendar && !isSelected}
										<span class="text-xs text-success font-medium">(Added - click to remove)</span>
									{:else if isAlreadyInCalendar && isSelected}
										<span class="text-xs text-warning font-medium">(Will be removed)</span>
									{:else if isSelected}
										<span class="text-xs text-info font-medium">(Will be added)</span>
									{/if}
								</label>
							{/each}
							{#if calendarManagement.calendars.length === 0}
								<div class="text-center py-4 text-base-content/60">
									No calendars available
								</div>
							{/if}
						</div>

						<!-- Selected Calendars Summary -->
						{#if selectedCalendarIds.length > 0}
							<div class="mt-2 text-sm text-base-content/70">
								{selectedCalendarIds.length} calendar{selectedCalendarIds.length > 1 ? 's' : ''} selected
							</div>
						{/if}
					</div>

					<!-- Apply Changes Button -->
					<div class="flex items-center gap-3">
						<button
							class="btn btn-primary"
							disabled={selectedCalendarIds.length === 0 || isProcessingChanges}
							onclick={handleApplyCalendarChanges}
						>
							{#if isProcessingChanges}
								<span class="loading loading-spinner loading-sm"></span>
								Applying changes to {selectedCalendarIds.length} calendar{selectedCalendarIds.length > 1 ? 's' : ''}...
							{:else}
								<PlusIcon class_="w-4 h-4 mr-2" />
								Apply Changes to {selectedCalendarIds.length || 'Selected'} Calendar{selectedCalendarIds.length !== 1 ? 's' : ''}
							{/if}
						</button>
					</div>

					<!-- Success Message -->
					{#if calendarChangesSuccess}
						<div class="alert alert-success mt-3">
							<CheckIcon class_="w-5 h-5" />
							<span>Calendar changes applied successfully!</span>
						</div>
					{/if}

					<!-- Error Message -->
					{#if calendarChangesError}
						<div class="alert alert-error mt-3">
							<AlertIcon class_="w-5 h-5" />
							<span>{calendarChangesError}</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Debug Information Component -->
			<EventDebugInfo {event} />

			<!-- Modal Actions -->
			<div class="flex justify-end gap-3 pt-6 border-t border-base-300">
				<button
					class="btn btn-outline"
					onclick={handleClose}
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
