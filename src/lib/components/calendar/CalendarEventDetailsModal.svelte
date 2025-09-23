<!--
  CalendarEventDetailsModal Component
  Modal for displaying calendar event details in read-only format
-->

<script>
	import { formatCalendarDate } from '../../helpers/calendar.js';
	import { modalStore } from '../../stores/modal.svelte.js';
	import {
		useCalendarManagement,
		registerCalendarEventsRefreshCallback
	} from '../../stores/calendar-management-store.svelte.js';
	import { useJoinedCommunitiesList } from '../../stores/joined-communities-list.svelte.js';
	import { manager } from '../../accounts.svelte.js';
	import { eventStore } from '../../store.svelte.js';
	import { EventFactory } from 'applesauce-factory';
	import { publishEvent } from '../../helpers/publisher.js';
	import { getTagValue, getProfileContent, getDisplayName } from 'applesauce-core/helpers';
	import {
		CloseIcon,
		CalendarIcon,
		ClockIcon,
		LocationIcon,
		PlusIcon,
		CheckIcon,
		AlertIcon
	} from '$lib/components/icons';
	import EventDebugInfo from './EventDebugInfo.svelte';
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';

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
	let calendarManagement = $derived(activeUser ? useCalendarManagement(activeUser.pubkey) : null);

	// Add to calendar state
	let selectedCalendarIds = $state(/** @type {string[]} */ ([]));
	let isProcessingChanges = $state(false);
	let calendarChangesError = $state('');
	let calendarChangesSuccess = $state(false);

	// Community sharing state
	let selectedCommunityIds = $state(/** @type {string[]} */ ([]));
	let communitiesWithShares = $state(new Set());
	let isProcessingCommunityShares = $state(false);
	let communityShareError = $state('');
	let communityShareSuccess = $state('');
	let communityShareResults = $state({
		successful: /** @type {string[]} */ ([]),
		failed: /** @type {string[]} */ ([])
	});

	// get all communities?

	// Get joined communities

	const getJoinedCommunities = useJoinedCommunitiesList(); // gets the getter function
	const joinedCommunities = $derived(getJoinedCommunities()); // reactive value

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
				.filter((calendar) => calendar.eventReferences.includes(eventRef))
				.map((calendar) => calendar.id)
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
			// Check for existing community shares when modal opens
			if (activeUser && event) {
				// checkExistingCommunityShares();
			}
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
			const successful = results.filter(
				(result) => result.status === 'fulfilled' && result.value === true
			).length;

			if (successful > 0) {
				calendarChangesSuccess = true;
				selectedCalendarIds = []; // Reset selection
				console.log(
					`Calendar changes applied successfully to ${successful}/${selectedCalendarIds.length} calendars`
				);
			} else {
				calendarChangesError = 'Failed to apply changes to any calendar';
			}
		} catch (error) {
			console.error('Error applying calendar changes:', error);
			calendarChangesError =
				error instanceof Error ? error.message : 'Failed to apply calendar changes';
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
			selectedCalendarIds = selectedCalendarIds.filter((id) => id !== calendarId);
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
				.filter((calendar) => !calendarsContainingEvent().has(calendar.id))
				.map((calendar) => calendar.id);
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

	// /**
	//  * Generate consistent d-tag for community sharing events
	//  * @param {string} eventId
	//  * @param {string} communityPubkey
	//  * @returns {string}
	//  */
	// function generateShareDTag(eventId, communityPubkey) {
	// 	return `calendar-share-${eventId}-${communityPubkey}`;
	// }

	// /**
	//  * Get community name from profile
	//  * @param {string} communityPubkey
	//  * @returns {Promise<string>}
	//  */
	// async function getCommunityName(communityPubkey) {
	// 	try {
	// 		const profile = await eventStore.profile(communityPubkey);
	// 		return profile?.name || profile?.display_name || communityPubkey.slice(0, 8);
	// 	} catch (error) {
	// 		console.warn(`Failed to get community name for ${communityPubkey}:`, error);
	// 		return communityPubkey.slice(0, 8);
	// 	}
	// }

	// /**
	//  * Check which communities already have sharing events for this calendar event
	//  */
	// async function checkExistingCommunityShares() {
	// 	if (!activeUser || !event || !joinedCommunities.length) {
	// 		communitiesWithShares = new Set();
	// 		return;
	// 	}

	// 	const shares = new Set();

	// 	// Check each joined community for existing share events
	// 	// TODO turn off for now
	// 	// for (const community of joinedCommunities) {
	// 	// 	const dTag = generateShareDTag(event.id, community.pubkey);
	// 	// 	try {
	// 	// 		// Use RxJS toPromise() to convert observable to promise
	// 	// 		const shareEvent = await eventStore.replaceable(30222, activeUser.pubkey, dTag);
	// 	// 		if (shareEvent) {
	// 	// 			shares.add(community.pubkey);
	// 	// 		}
	// 	// 	} catch (error) {
	// 	// 		console.warn(`Failed to check share for community ${community.pubkey}:`, error);
	// 	// 	}
	// 	// }

	// 	communitiesWithShares = shares;
	// }

	// /**
	//  * Create a community sharing event (kind 30222)
	//  * @param {string} communityPubkey
	//  * @returns {Promise<boolean>}
	//  */
	// async function createCommunityShare(communityPubkey) {
	// 	if (!activeUser || !event) {
	// 		throw new Error('Missing user or event data');
	// 	}

	// 	// Get community relay from community metadata
	// 	let communityRelay = '';
	// 	try {
	// 		const communityEvent = await eventStore.replaceable(10222, communityPubkey, communityPubkey).toPromise();
	// 		if (communityEvent) {
	// 			communityRelay = getTagValue(communityEvent, 'r') || '';
	// 		}
	// 	} catch (error) {
	// 		console.warn(`Failed to get community relay for ${communityPubkey}:`, error);
	// 	}

	// 	// Create EventFactory for the user
	// 	const factory = new EventFactory({
	// 		signer: activeUser.signer
	// 	});

	// 	// Generate d-tag
	// 	const dTag = generateShareDTag(event.id, communityPubkey);

	// 	// Create the sharing event using proper EventFactory API
	// 	const shareEvent = await factory.build(
	// 		{ kind: 30222, tags: [
	// 			['d', dTag],
	// 			['e', event.id],
	// 			['k', event.kind.toString()],
	// 			['p', communityPubkey],
	// 			...(communityRelay ? [['r', communityRelay]] : [])
	// 		] }
	// 	);

	// 	// Sign the event
	// 	const signedEvent = await factory.sign(shareEvent);

	// 	// Get user relays from the relays store
	// 	const { relays: userRelays } = await import('../../store.svelte.js');
	// 	const communityRelays = communityRelay ? [communityRelay] : [];
	// 	const allRelays = [...new Set([...userRelays, ...communityRelays])];

	// 	const result = await publishEvent(signedEvent, {
	// 		relays: allRelays,
	// 		logPrefix: 'CommunityShare'
	// 	});

	// 	return result.success;
	// }

	// /**
	//  * Delete a community sharing event
	//  * @param {string} communityPubkey
	//  * @returns {Promise<boolean>}
	//  */
	// async function deleteCommunityShare(communityPubkey) {
	// 	if (!activeUser || !event) {
	// 		throw new Error('Missing user or event data');
	// 	}

	// 	// Get the existing share event
	// 	const dTag = generateShareDTag(event.id, communityPubkey);
	// 	const shareEvent = await eventStore.replaceable(30222, activeUser.pubkey, dTag).toPromise();

	// 	if (!shareEvent) {
	// 		console.warn(`No share event found for community ${communityPubkey}`);
	// 		return true; // Consider it successful if already gone
	// 	}

	// 	// Create EventFactory for deletion
	// 	const factory = new EventFactory({
	// 		signer: activeUser.signer
	// 	});

	// 	// Create deletion event (kind 5)
	// 	const deleteEvent = await factory.delete([shareEvent]);

	// 	// Publish deletion
	// 	const result = await publishEvent(deleteEvent, {
	// 		logPrefix: 'CommunityShareDelete'
	// 	});

	// 	return result.success;
	// }

	// /**
	//  * Handle applying community sharing changes
	//  */
	// async function handleApplyCommunityShares() {
	// 	if (selectedCommunityIds.length === 0 || !activeUser || !event) {
	// 		return;
	// 	}

	// 	isProcessingCommunityShares = true;
	// 	communityShareError = '';
	// 	communityShareSuccess = '';
	// 	communityShareResults = { successful: [], failed: [] };

	// 	try {
	// 		const results = [];

	// 		// Process each selected community
	// 		for (const communityPubkey of selectedCommunityIds) {
	// 			const isAlreadyShared = communitiesWithShares.has(communityPubkey);

	// 			try {
	// 				let success = false;
	// 				if (isAlreadyShared) {
	// 					// Remove share
	// 					success = await deleteCommunityShare(communityPubkey);
	// 				} else {
	// 					// Create share
	// 					success = await createCommunityShare(communityPubkey);
	// 				}

	// 				const communityName = await getCommunityName(communityPubkey);

	// 				if (success) {
	// 					communityShareResults.successful.push(communityName);
	// 				} else {
	// 					communityShareResults.failed.push(communityName);
	// 				}
	// 			} catch (error) {
	// 				console.error(`Failed to process community share for ${communityPubkey}:`, error);
	// 				const communityName = await getCommunityName(communityPubkey);
	// 				communityShareResults.failed.push(communityName);
	// 			}
	// 		}

	// 		// Update success message
	// 		const successfulCount = communityShareResults.successful.length;
	// 		const failedCount = communityShareResults.failed.length;

	// 		if (successfulCount > 0) {
	// 			communityShareSuccess = `Successfully shared with ${successfulCount} community${successfulCount > 1 ? 'ies' : ''}`;
	// 			if (failedCount > 0) {
	// 				communityShareSuccess += `, failed for ${failedCount}`;
	// 			}
	// 		} else if (failedCount > 0) {
	// 			communityShareError = `Failed to share with ${failedCount} community${failedCount > 1 ? 'ies' : ''}`;
	// 		}

	// 		// Refresh existing shares and reset selection
	// 		await checkExistingCommunityShares();
	// 		selectedCommunityIds = [];

	// 	} catch (error) {
	// 		console.error('Error applying community shares:', error);
	// 		communityShareError = error instanceof Error ? error.message : 'Failed to apply community sharing changes';
	// 	} finally {
	// 		isProcessingCommunityShares = false;
	// 	}
	// }

	/**
	 * Toggle community selection
	 * @param {string} communityPubkey
	 */
	function toggleCommunitySelection(communityPubkey) {
		if (selectedCommunityIds.includes(communityPubkey)) {
			selectedCommunityIds = selectedCommunityIds.filter(id => id !== communityPubkey);
		} else {
			selectedCommunityIds = [...selectedCommunityIds, communityPubkey];
		}
	}

	// /**
	//  * Select all communities that don't already have shares
	//  */
	// function selectAllCommunities() {
	// 	const availableCommunities = joinedCommunities
	// 		.filter(community => !communitiesWithShares.has(community.pubkey))
	// 		.map(community => community.pubkey);
	// 	selectedCommunityIds = availableCommunities;
	// }

	// /**
	//  * Deselect all communities
	//  */
	// function deselectAllCommunities() {
	// 	selectedCommunityIds = [];
	// }

	// /**
	//  * Reset community sharing state when modal closes
	//  */
	// function resetCommunitySharingState() {
	// 	selectedCommunityIds = [];
	// 	communitiesWithShares = new Set();
	// 	isProcessingCommunityShares = false;
	// 	communityShareError = '';
	// 	communityShareSuccess = '';
	// 	communityShareResults = { successful: [], failed: [] };
	// }

	/**
	 * Handle modal close with state reset
	 */
	function handleClose() {
		resetCalendarChangesState();
		// resetCommunitySharingState();
		modal.closeModal();
	}
</script>

<!-- Event Details Modal -->
{#if modal.activeModal === 'eventDetails' && event}
	<div
		class="modal-open modal"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="event-title"
		tabindex="0"
	>
		<div class="modal-box max-h-screen w-full max-w-2xl overflow-y-auto">
			<!-- Modal Header -->
			<div class="mb-6 flex items-center justify-between">
				<h2 id="event-title" class="text-2xl font-bold text-base-content">
					{event.title}
				</h2>
				<button
					class="btn btn-circle btn-ghost btn-sm"
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
						class="h-48 w-full rounded-lg object-cover"
						loading="lazy"
					/>
				</div>
			{/if}

			<!-- Event Description -->
			{#if event.summary}
				<div class="mb-6">
					<h3 class="mb-2 text-lg font-semibold text-base-content">Description</h3>
					<p class="leading-relaxed whitespace-pre-wrap text-base-content/80">
						{event.summary}
					</p>
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
								<span class="text-base-content/80">{location}</span>
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
							<div class="flex items-center gap-3 rounded-lg bg-base-200 p-3">
								<div
									class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-content"
								>
									{participant.pubkey.slice(0, 2).toUpperCase()}
								</div>
								<div class="flex-1">
									<div class="font-medium text-base-content">
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
					<h3 class="mb-3 text-lg font-semibold text-base-content">Tags</h3>
					<div class="flex flex-wrap gap-2">
						{#each event.hashtags as tag}
							<span class="badge badge-outline badge-lg">#{tag}</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Add to Calendar Section (only for authenticated users) -->
			{#if activeUser && calendarManagement}
				<div class="mb-4 border-t border-base-300 pt-4">
					<h3 class="mb-3 text-lg font-semibold text-base-content">Manage Calendar Events</h3>

					<!-- Calendar Selection -->
					<div class="mb-3">
						<div class="mb-2 flex items-center justify-between">
							<label class="block text-sm font-medium text-base-content"> Select Calendars </label>
							{#if calendarManagement.calendars.length > 1}
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
						<div class="max-h-40 overflow-y-auto rounded-lg border border-base-300 p-3">
							{#each calendarManagement.calendars as calendar}
								{@const isAlreadyInCalendar = calendarsContainingEvent().has(calendar.id)}
								{@const isSelected = selectedCalendarIds.includes(calendar.id)}
								<label class="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-base-200">
									<input
										type="checkbox"
										class="checkbox checkbox-primary"
										checked={isSelected || isAlreadyInCalendar}
										onchange={() => toggleCalendarSelection(calendar.id)}
									/>
									<span class="text-sm font-medium">{calendar.title}</span>
									{#if calendar.description}
										<span class="truncate text-xs text-base-content/60">{calendar.description}</span
										>
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
							{#if calendarManagement.calendars.length === 0}
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

					<!-- Apply Changes Button -->
					<div class="flex items-center gap-3">
						<button
							class="btn btn-primary"
							disabled={selectedCalendarIds.length === 0 || isProcessingChanges}
							onclick={handleApplyCalendarChanges}
						>
							{#if isProcessingChanges}
								<span class="loading loading-sm loading-spinner"></span>
								Applying changes to {selectedCalendarIds.length} calendar{selectedCalendarIds.length >
								1
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
						<div class="mt-3 alert alert-success">
							<CheckIcon class_="w-5 h-5" />
							<span>Calendar changes applied successfully!</span>
						</div>
					{/if}

					<!-- Error Message -->
					{#if calendarChangesError}
						<div class="mt-3 alert alert-error">
							<AlertIcon class_="w-5 h-5" />
							<span>{calendarChangesError}</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Share with Communities Section (only for authenticated users with joined communities) -->
			{#if activeUser && joinedCommunities.length > 0}
				<div class="mb-4 border-t border-base-300 pt-4">
					<h3 class="mb-3 text-lg font-semibold text-base-content">Share with Communities</h3>
					<!-- Community Selection -->
					<div class="mb-3">
						<div class="mb-2 flex items-center justify-between">
							<label class="block text-sm font-medium text-base-content">
								Select Communities
							</label>
							{#if joinedCommunities.length > 1}
								<div class="flex gap-2">
									<button
										class="btn btn-ghost btn-xs"
										onclick={selectAllCommunities}
										disabled={selectedCommunityIds.length === joinedCommunities.length}
									>
										Select All
									</button>
									<button
										class="btn btn-ghost btn-xs"
										onclick={deselectAllCommunities}
										disabled={selectedCommunityIds.length === 0}
									>
										Deselect All
									</button>
								</div>
							{/if}
						</div>
					</div>

					<!-- Community Checkboxes -->
					<div class="max-h-40 overflow-y-auto rounded-lg border border-base-300 p-3">
						{#each joinedCommunities as community}
							{@const isAlreadyShared = communitiesWithShares.has(community.pubkey)}
							{@const isSelected = selectedCommunityIds.includes(community.pubkey)}
							{@const communityPubKey = getTagValue(community, 'd') || ''}
							{@const getCommunityProfile = useUserProfile(communityPubKey)}
							{@const communityProfile = getCommunityProfile()}
							{console.log('Community Profile:', communityProfile)}
							<label class="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-base-200">
								<input
									type="checkbox"
									class="checkbox checkbox-secondary"
									checked={isSelected || isAlreadyShared}
									onchange={() => toggleCommunitySelection(community.pubkey)}
								/>
								<span class="text-sm font-medium"
									>{getDisplayName(communityProfile) || (`${communityPubKey.slice(0, 8)}...${communityPubKey.slice(-4)}`)}</span
								>
								{#if isAlreadyShared && !isSelected}
									<span class="text-xs font-medium text-success">(Shared - click to unshare)</span>
								{:else if isAlreadyShared && isSelected}
									<span class="text-xs font-medium text-warning">(Will be unshared)</span>
								{:else if isSelected}
									<span class="text-xs font-medium text-info">(Will be shared)</span>
								{/if}
							</label>
						{/each}
						{#if joinedCommunities.length === 0}
							<div class="py-4 text-center text-base-content/60">
								No joined communities available
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Debug Information Component -->
			<EventDebugInfo {event} />

			<!-- Modal Actions -->
			<div class="flex justify-end gap-3 border-t border-base-300 pt-6">
				<button class="btn btn-outline" onclick={handleClose}> Close </button>
			</div>
		</div>
	</div>
{/if}
