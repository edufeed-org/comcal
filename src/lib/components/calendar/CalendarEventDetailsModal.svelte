<!--
  CalendarEventDetailsModal Component
  Modal for displaying calendar event details in read-only format
-->

<script>
	import { formatCalendarDate } from '../../helpers/calendar.js';
	import { modalStore } from '../../stores/modal.svelte.js';

	/**
	 * @typedef {import('../../types/calendar.js').CalendarEvent} CalendarEvent
	 */

	// Get modal store
	const modal = modalStore;

	// Generate unique modal ID
	const modalId = 'event-details-modal';

	// Reactive effect to handle modal opening/closing
	$effect(() => {
		const currentModal = modal.activeModal;
		const dialog = /** @type {HTMLDialogElement} */ (document.getElementById(modalId));

		if (currentModal === 'eventDetails' && dialog && !dialog.open) {
			console.log('CalendarEventDetailsModal: Opening event details modal');
			dialog.showModal();
		} else if (currentModal !== 'eventDetails' && dialog && dialog.open) {
			console.log('CalendarEventDetailsModal: Closing event details modal');
			dialog.close();
		}
	});

	// Get event from modal props
	let event = $derived(modal.modalProps && modal.modalProps.event ? modal.modalProps.event : null);

	// Format event data for display
	let startDate = $derived(event ? new Date(event.start * 1000) : null);
	let endDate = $derived(event && event.end ? new Date(event.end * 1000) : null);
	let isAllDay = $derived(event ? event.kind === 31922 : false);
	let isMultiDay = $derived(event && endDate && startDate ? startDate.toDateString() !== endDate.toDateString() : false);

	/**
	 * Handle modal close
	 */
	function handleClose() {
		modal.closeModal();
	}

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
							{isMultiDay && endDate
								? `${formatCalendarDate(startDate, 'long')} - ${formatCalendarDate(endDate, 'long')}`
								: formatCalendarDate(startDate, 'long')
							}
						</div>
					{:else}
						<div class="space-y-2">
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
