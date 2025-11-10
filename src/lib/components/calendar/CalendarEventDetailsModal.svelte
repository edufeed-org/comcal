<!--
  CalendarEventDetailsModal Component
  Modal for displaying calendar event details in read-only format
-->

<script>
	import { formatCalendarDate } from '../../helpers/calendar.js';
	import { modalStore } from '../../stores/modal.svelte.js';
	import { registerCalendarEventsRefreshCallback } from '../../stores/calendar-management-store.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import { showToast } from '$lib/helpers/toast.js';
	import {
		CloseIcon,
		CalendarIcon,
		ClockIcon,
		LocationIcon,
		ExternalLinkIcon,
		CopyIcon,
		UserIcon
	} from '$lib/components/icons';
	import EventDebugInfo from './EventDebugInfo.svelte';
	import { encodeEventToNaddr } from '$lib/helpers/nostrUtils.js';
	import LocationLink from '../shared/LocationLink.svelte';
	import MarkdownRenderer from '../shared/MarkdownRenderer.svelte';
	import PersonalCalendarShare from './PersonalCalendarShare.svelte';
	import CommunityCalendarShare from './CommunityCalendarShare.svelte';
	import ReactionBar from '../reactions/ReactionBar.svelte';
	import ProfileCard from '../shared/ProfileCard.svelte';
	import EventManagementActions from './EventManagementActions.svelte';

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

	// Generate unique modal ID
	const modalId = 'event-details-modal';

	/**
	 * Sync modal close with store state
	 * This effect ensures that when the dialog closes (via ESC, backdrop, etc.),
	 * the modal store state is updated accordingly
	 */
	$effect(() => {
		const dialog = /** @type {HTMLDialogElement} */ (document.getElementById(modalId));
		if (!dialog) return;

		const handleDialogClose = () => {
			// Only update store if this modal is currently active
			if (modal.activeModal === 'eventDetails') {
				console.log('CalendarEventDetailsModal: Dialog closed, syncing with store');
				modal.closeModal();
			}
		};

		dialog.addEventListener('close', handleDialogClose);
		return () => {
			dialog.removeEventListener('close', handleDialogClose);
		};
	});

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
	let event = $derived(
		modal.modalProps && /** @type {any} */ (modal.modalProps).event
			? /** @type {any} */ (modal.modalProps).event
			: null
	);

	// Format event data for display
	let startDate = $derived(event ? new Date(event.start * 1000) : null);
	let endDate = $derived(event && event.end ? new Date(event.end * 1000) : null);
	let isAllDay = $derived(event ? event.kind === 31922 : false);
	let isMultiDay = $derived(
		event && endDate && startDate ? startDate.toDateString() !== endDate.toDateString() : false
	);

	// Check if user owns this event
	let isUserEvent = $derived(event && activeUser && event.pubkey === activeUser.pubkey);

	// Generate URL for event detail page
	let eventDetailUrl = $derived(
		event?.originalEvent ? `/calendar/event/${encodeEventToNaddr(event.originalEvent)}` : ''
	);

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
	 * Copy event naddr to clipboard
	 */
	async function copyNaddr() {
		if (event?.originalEvent) {
			try {
				const naddr = encodeEventToNaddr(event.originalEvent);
				await navigator.clipboard.writeText(naddr);
				console.log('Event naddr copied to clipboard:', naddr);
				showToast('Event link copied to clipboard!', 'success');
			} catch (err) {
				console.error('Failed to copy event naddr:', err);
				showToast('Failed to copy link', 'error');
			}
		}
	}

	/**
	 * Handle edit action - navigate to event detail page
	 */
	function handleEdit() {
		if (eventDetailUrl) {
			window.location.href = eventDetailUrl;
		}
	}

	/**
	 * Handle delete success - close modal
	 */
	function handleDeleteSuccess() {
		modal.closeModal();
		// The event will be automatically removed from the calendar view
		// since eventStore.add() in deleteCalendarEvent removes it
	}

	/**
	 * Handle modal close
	 */
	function handleClose() {
		modal.closeModal();
	}
</script>

<!-- Event Details Modal -->
{#if modal.activeModal === 'eventDetails' && event}
	<dialog
		id={modalId}
		class="modal"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		aria-labelledby="event-title"
	>
		<div class="modal-box max-h-screen w-full max-w-2xl overflow-y-auto">
			<!-- Modal Header -->
			<div class="mb-6 flex items-center justify-between">
				<h2 id="event-title" class="text-2xl font-bold text-base-content">
					{event.title}
				</h2>
				<div class="flex items-center gap-2">
					<button
						class="btn btn-circle btn-ghost btn-sm"
						onclick={copyNaddr}
						aria-label="Copy event address"
						title="Copy naddr"
					>
						<CopyIcon class_="w-5 h-5" />
					</button>
					<a
						href={eventDetailUrl}
						class="btn btn-circle btn-ghost btn-sm"
						aria-label="Open event details page"
						onclick={handleClose}
					>
						<ExternalLinkIcon class_="w-6 h-6" />
					</a>
					{#if isUserEvent}
						<EventManagementActions
							{event}
							{activeUser}
							onEdit={handleEdit}
							onDeleteSuccess={handleDeleteSuccess}
						/>
					{/if}
					<button
						class="btn btn-circle btn-ghost btn-sm"
						onclick={handleClose}
						aria-label="Close modal"
					>
						<CloseIcon class_="w-6 h-6" />
					</button>
				</div>
			</div>

			<!-- Event Image -->
			{#if event.image}
				<div class="mb-6">
					<img
						src={event.image}
						alt={event.title}
						class="h-48 w-full rounded-lg object-cover"
						loading="lazy"
					/>
				</div>
			{/if}

			<!-- Event Author -->
			<div class="mb-6">
				<h3 class="mb-3 text-lg font-semibold text-base-content">Event Author</h3>
				<ProfileCard pubkey={event.pubkey} onClose={handleClose} />
			</div>

			<!-- Event Description -->
			{#if event.summary}
				<div class="mb-6">
					<h3 class="mb-2 text-lg font-semibold text-base-content">Description</h3>
					<MarkdownRenderer content={event.summary} class="prose max-w-none" />
				</div>
			{/if}

			<!-- Event Date and Time -->
			<div class="mb-6">
				<h3 class="mb-3 text-lg font-semibold text-base-content">Date & Time</h3>
				<div class="rounded-lg bg-base-200 p-4">
					{#if isAllDay}
						<div class="mb-2 flex items-center gap-2">
							<CalendarIcon class_="w-5 h-5 text-info" />
							<span class="font-medium text-base-content">All Day Event</span>
						</div>
						<div class="ml-7 text-base-content/70">
							{isMultiDay && endDate && startDate
								? `${formatCalendarDate(startDate, 'long')} - ${formatCalendarDate(endDate, 'long')}`
								: startDate
									? formatCalendarDate(startDate, 'long')
									: ''}
						</div>
					{:else}
						<div class="space-y-2">
							{#if startDate}
								<div class="flex items-center gap-2">
									<ClockIcon class_="w-5 h-5 text-primary" />
									<span class="font-medium text-base-content">Start:</span>
									<span class="text-base-content/80">
										{formatCalendarDate(startDate, 'long')} at {formatCalendarDate(
											startDate,
											'time'
										)}
										{#if event.startTimezone}
											<span class="text-xs text-base-content/60">({event.startTimezone})</span>
										{/if}
									</span>
								</div>
							{/if}
							{#if endDate}
								<div class="flex items-center gap-2">
									<ClockIcon class_="w-5 h-5 text-secondary" />
									<span class="font-medium text-base-content">End:</span>
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
					<h3 class="mb-3 text-lg font-semibold text-base-content">
						Location{#if event.locations.length > 1}s{/if}
					</h3>
					<div class="space-y-2">
						{#each event.locations as location}
							<div class="flex items-start gap-3 rounded-lg bg-base-200 p-3">
								<LocationIcon class_="w-5 h-5 text-base-content/60 mt-0.5" />
								<div class="text-base-content/80">
									<LocationLink {location} />
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Event Participants -->
			{#if event.participants && event.participants.length > 0}
				<div class="mb-6">
					<h3 class="mb-3 text-lg font-semibold text-base-content">
						Participant{#if event.participants.length > 1}s{/if}
					</h3>
					<div class="space-y-2">
						{#each event.participants as participant}
							<div class="rounded-lg bg-base-200 p-3">
								<ProfileCard 
									pubkey={participant.pubkey}
									showNpub={false}
									onClose={handleClose}
								/>
								{#if participant.role}
									<div class="mt-2 flex items-center gap-2">
										<span class="badge badge-primary badge-sm">{participant.role}</span>
									</div>
								{/if}
								{#if participant.relay}
									<div class="mt-1 text-xs text-base-content/50">
										Relay: {participant.relay}
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
					<h3 class="mb-3 text-lg font-semibold text-base-content">Tags</h3>
					<div class="flex flex-wrap gap-2">
						{#each event.hashtags as tag}
							<a
								href="/calendar?view=list&tags={encodeURIComponent(tag)}"
								class="badge badge-outline badge-lg transition-colors hover:badge-primary"
								title="View all events with #{tag}"
							>
								#{tag}
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Further Links -->
			{#if event.references && event.references.length > 0}
				<div class="mb-6">
					<h3 class="mb-3 text-lg font-semibold text-base-content">Further Links</h3>
					<div class="space-y-2">
						{#each event.references as reference}
							<a
								href={reference}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-2 rounded-lg bg-base-200 p-3 transition hover:bg-base-300"
							>
								<ExternalLinkIcon class_="w-5 h-5 text-base-content/60" />
								<span class="break-all text-base-content/80">{reference}</span>
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Reactions -->
			<div class="mb-6">
				<h3 class="mb-3 text-lg font-semibold text-base-content">Reactions</h3>
				<ReactionBar event={event?.originalEvent || event} />
			</div>

			<!-- Personal Calendar Sharing Section -->
			{#if activeUser}
				<div class="mb-4 border-t border-base-300 pt-4">
					<h3 class="mb-3 text-lg font-semibold text-base-content">Manage Calendar Events</h3>
					<PersonalCalendarShare {event} {activeUser} />
				</div>
			{/if}

			<!-- Community Sharing Section -->
			{#if activeUser}
				<div class="mb-4 border-t border-base-300 pt-4">
					<h3 class="mb-3 text-lg font-semibold text-base-content">Share with Communities</h3>
					<CommunityCalendarShare {event} {activeUser} />
				</div>
			{/if}

			<!-- Debug Information Component -->
			<EventDebugInfo {event} />

			<!-- Modal Actions -->
			<div class="flex justify-end gap-3 border-t border-base-300 pt-6">
				<button class="btn btn-outline" onclick={handleClose}> Close </button>
			</div>
		</div>
	</dialog>
{/if}
