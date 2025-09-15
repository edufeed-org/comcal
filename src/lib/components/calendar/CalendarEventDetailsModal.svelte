<!--
  CalendarEventDetailsModal Component
  Modal for displaying calendar event details in read-only format
-->

<script>
	import { formatCalendarDate } from '../../helpers/calendar.js';
	import { modalStore } from '../../stores/modal.svelte.js';
	import { useCalendarManagement, registerCalendarEventsRefreshCallback } from '../../stores/calendar-management-store.svelte.js';
	import { manager } from '../../accounts.svelte.js';

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
	let isAddingToCalendar = $state(false);
	let addToCalendarError = $state('');
	let addToCalendarSuccess = $state(false);

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
				// Import the calendar store dynamically to avoid circular dependencies
				import('../../stores/calendar-store.svelte.js').then(({ useGlobalCalendarEvents }) => {
					const calendarStore = useGlobalCalendarEvents();
					registerCalendarEventsRefreshCallback(() => {
						console.log('📅 Modal: Refreshing calendar events after calendar update');
						calendarStore.refresh();
					});
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
	 * Handle adding event to selected calendars
	 */
	async function handleAddToCalendar() {
		if (selectedCalendarIds.length === 0 || !calendarManagement || !event) {
			return;
		}

		isAddingToCalendar = true;
		addToCalendarError = '';
		addToCalendarSuccess = false;

		try {
			// Check if event already has a dTag, if not generate one
			const eventWithDTag = {
				...event,
				dTag: event.dTag || `event-${event.id.slice(0, 8)}`
			};

			// Add event to each selected calendar
			const results = await Promise.allSettled(
				selectedCalendarIds.map(calendarId =>
					calendarManagement.addEventToCalendar(calendarId, eventWithDTag)
				)
			);

			// Check results
			const successful = results.filter(result =>
				result.status === 'fulfilled' && result.value === true
			).length;

			if (successful > 0) {
				addToCalendarSuccess = true;
				selectedCalendarIds = []; // Reset selection
				console.log(`Event successfully added to ${successful}/${selectedCalendarIds.length} calendars`);
			} else {
				addToCalendarError = 'Failed to add event to any calendar';
			}
		} catch (error) {
			console.error('Error adding event to calendars:', error);
			addToCalendarError = error instanceof Error ? error.message : 'Failed to add event to calendars';
		} finally {
			isAddingToCalendar = false;
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
	 * Select all calendars
	 */
	function selectAllCalendars() {
		if (calendarManagement) {
			selectedCalendarIds = calendarManagement.calendars.map(calendar => calendar.id);
		}
	}

	/**
	 * Deselect all calendars
	 */
	function deselectAllCalendars() {
		selectedCalendarIds = [];
	}

	/**
	 * Reset add to calendar state when modal closes
	 */
	function resetAddToCalendarState() {
		selectedCalendarIds = [];
		isAddingToCalendar = false;
		addToCalendarError = '';
		addToCalendarSuccess = false;
	}

	/**
	 * Handle modal close with state reset
	 */
	function handleClose() {
		resetAddToCalendarState();
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
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
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
							<svg class="w-5 h-5 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
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
									<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
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
									<svg class="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
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
								<svg class="w-5 h-5 text-base-content/60 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
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
					<h3 class="text-lg font-semibold text-base-content mb-3">Add to Calendar</h3>

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
								<label class="flex items-center gap-3 cursor-pointer hover:bg-base-200 p-2 rounded">
									<input
										type="checkbox"
										class="checkbox checkbox-primary"
										checked={selectedCalendarIds.includes(calendar.id)}
										onchange={() => toggleCalendarSelection(calendar.id)}
									/>
									<span class="text-sm font-medium">{calendar.title}</span>
									{#if calendar.description}
										<span class="text-xs text-base-content/60 truncate">{calendar.description}</span>
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

					<!-- Add to Calendar Button -->
					<div class="flex items-center gap-3">
						<button
							class="btn btn-primary"
							disabled={selectedCalendarIds.length === 0 || isAddingToCalendar}
							onclick={handleAddToCalendar}
						>
							{#if isAddingToCalendar}
								<span class="loading loading-spinner loading-sm"></span>
								Adding to {selectedCalendarIds.length} calendar{selectedCalendarIds.length > 1 ? 's' : ''}...
							{:else}
								<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
								</svg>
								Add to {selectedCalendarIds.length || 'Selected'} Calendar{selectedCalendarIds.length !== 1 ? 's' : ''}
							{/if}
						</button>
					</div>

					<!-- Success Message -->
					{#if addToCalendarSuccess}
						<div class="alert alert-success mt-3">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
							<span>Event successfully added to calendar!</span>
						</div>
					{/if}

					<!-- Error Message -->
					{#if addToCalendarError}
						<div class="alert alert-error mt-3">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
							<span>{addToCalendarError}</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Event Metadata -->
			<div class="border-t border-base-300 pt-4">
				<div class="text-xs text-base-content/50 space-y-1">
					<div class="flex items-center justify-between">
						<span>Event ID: {event.id.slice(0, 8)}...{event.id.slice(-4)}</span>
						<button
							class="btn btn-xs btn-ghost text-base-content/50 hover:text-base-content"
							onclick={copyEventId}
							aria-label="Copy event ID to clipboard"
							title="Copy event ID"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
						</button>
					</div>
					<div>Created by: {event.pubkey.slice(0, 8)}...{event.pubkey.slice(-4)}</div>
					<div>Created: {new Date(event.createdAt * 1000).toLocaleString()}</div>
					{#if event.geohash}
						<div>Geohash: {event.geohash}</div>
					{/if}
				</div>
			</div>

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
