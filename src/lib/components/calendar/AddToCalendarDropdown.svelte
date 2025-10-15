<!--
  AddToCalendarDropdown Component
  Responsive component for adding events to personal calendars
  - Desktop: Dropdown
  - Mobile: Bottom sheet modal
-->

<script>
	import { manager } from '../../accounts.svelte.js';
	import {
		useCalendarManagement,
		registerCalendarEventsRefreshCallback
	} from '../../stores/calendar-management-store.svelte.js';
	import { useJoinedCommunitiesList } from '../../stores/joined-communities-list.svelte.js';
	import { useUserProfile } from '../../stores/user-profile.svelte.js';
	import { eventStore } from '../../store.svelte.js';
	import { EventFactory } from 'applesauce-factory';
	import { publishEvent } from '../../helpers/publisher.js';
	import { getTagValue, getDisplayName } from 'applesauce-core/helpers';
	import { firstValueFrom } from 'rxjs';
	import { PlusIcon, CheckIcon, AlertIcon, ChevronDownIcon } from '../icons';

	/** @type {{ event: any, disabled?: boolean }} */
	let { event, disabled = false } = $props();

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

	// State management
	let selectedCalendarIds = $state(/** @type {string[]} */ ([]));
	let isProcessingChanges = $state(false);
	let calendarChangesError = $state('');
	let calendarChangesSuccess = $state(false);
	let isOpen = $state(false);
	let isDesktop = $state(true);

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

	// Get joined communities
	const getJoinedCommunities = useJoinedCommunitiesList();
	const joinedCommunities = $derived(getJoinedCommunities());

	// Responsive behavior
	$effect(() => {
		function handleResize() {
			isDesktop = window.innerWidth >= 768;
		}
		handleResize(); // Initial check
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	// Helper function to generate event reference
	/**
	 * @param {any} evt
	 * @returns {string | null}
	 */
	function getEventReference(evt) {
		if (!evt || !evt.kind || !evt.pubkey || !evt.dTag) {
			return null;
		}
		return `${evt.kind}:${evt.pubkey}:${evt.dTag}`;
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
	 * Handle applying calendar changes
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
				
				// Close dropdown/modal after short delay
				setTimeout(() => {
					isOpen = false;
					calendarChangesSuccess = false;
				}, 1500);
				
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
	 * Generate consistent d-tag for community sharing events
	 * @param {string} eventId
	 * @param {string} communityPubkey
	 * @returns {string}
	 */
	function generateShareDTag(eventId, communityPubkey) {
		return `calendar-share-${eventId}-${communityPubkey}`;
	}

	/**
	 * Get community name from profile
	 * @param {string} communityPubkey
	 * @returns {Promise<string>}
	 */
	async function getCommunityName(communityPubkey) {
		try {
			const getProfile = useUserProfile(communityPubkey);
			const profile = await getProfile();
			return profile?.name || profile?.display_name || communityPubkey.slice(0, 8);
		} catch (error) {
			console.warn(`Failed to get community name for ${communityPubkey}:`, error);
			return communityPubkey.slice(0, 8);
		}
	}

	/**
	 * Check which communities already have sharing events for this calendar event
	 */
	async function checkExistingCommunityShares() {
		if (!activeUser || !event || !joinedCommunities.length) {
			communitiesWithShares = new Set();
			return;
		}

		const shares = new Set();
		// Note: Check disabled for now as per modal implementation
		communitiesWithShares = shares;
	}

	/**
	 * Create a community sharing event (kind 30222)
	 * @param {string} communityPubkey
	 * @returns {Promise<boolean>}
	 */
	async function createCommunityShare(communityPubkey) {
		if (!activeUser || !event) {
			throw new Error('Missing user or event data');
		}

		// Create EventFactory for the user
		const factory = new EventFactory({
			signer: activeUser.signer
		});

		// Generate d-tag
		const dTag = generateShareDTag(event.id, communityPubkey);

		// Create the sharing event using proper EventFactory API
		const shareEvent = await factory.build({
			kind: 30222,
			tags: [
				['d', dTag],
				['e', event.id],
				['k', event.kind.toString()],
				['p', communityPubkey]
			]
		});

		// Sign the event
		const signedEvent = await factory.sign(shareEvent);

		// Get user relays from the relays store
		const { relays: userRelays } = await import('../../store.svelte.js');
		const allRelays = [...new Set([...userRelays])];

		const result = await publishEvent(signedEvent, {
			relays: allRelays,
			logPrefix: 'CommunityShare'
		});

		return result.success;
	}

	/**
	 * Delete a community sharing event
	 * @param {string} communityPubkey
	 * @returns {Promise<boolean>}
	 */
	async function deleteCommunityShare(communityPubkey) {
		if (!activeUser || !event) {
			throw new Error('Missing user or event data');
		}

		// Get the existing share event
		const dTag = generateShareDTag(event.id, communityPubkey);
		const shareEvent = await firstValueFrom(eventStore.replaceable(30222, activeUser.pubkey, dTag));

		if (!shareEvent) {
			console.warn(`No share event found for community ${communityPubkey}`);
			return true; // Consider it successful if already gone
		}

		// Create EventFactory for deletion
		const factory = new EventFactory({
			signer: activeUser.signer
		});

		// Create deletion event (kind 5)
		const deleteEvent = await factory.delete([shareEvent]);

		// Publish deletion
		const result = await publishEvent(deleteEvent, {
			logPrefix: 'CommunityShareDelete'
		});

		return result.success;
	}

	/**
	 * Handle applying community sharing changes
	 */
	async function handleApplyCommunityShares() {
		if (selectedCommunityIds.length === 0 || !activeUser || !event) {
			return;
		}

		isProcessingCommunityShares = true;
		communityShareError = '';
		communityShareSuccess = '';
		communityShareResults = { successful: [], failed: [] };

		try {
			// Process each selected community
			for (const communityPubkey of selectedCommunityIds) {
				const isAlreadyShared = communitiesWithShares.has(communityPubkey);

				try {
					let success = false;
					if (isAlreadyShared) {
						// Remove share
						success = await deleteCommunityShare(communityPubkey);
					} else {
						// Create share
						success = await createCommunityShare(communityPubkey);
					}

					const communityName = await getCommunityName(communityPubkey);

					if (success) {
						communityShareResults.successful.push(communityName);
					} else {
						communityShareResults.failed.push(communityName);
					}
				} catch (error) {
					console.error(`Failed to process community share for ${communityPubkey}:`, error);
					const communityName = await getCommunityName(communityPubkey);
					communityShareResults.failed.push(communityName);
				}
			}

			// Update success message
			const successfulCount = communityShareResults.successful.length;
			const failedCount = communityShareResults.failed.length;

			if (successfulCount > 0) {
				const names = communityShareResults.successful.join(', ');
				communityShareSuccess = `Successfully shared with ${successfulCount} communit${successfulCount > 1 ? 'ies' : 'y'}: ${names}`;
				if (failedCount > 0) {
					communityShareSuccess += `. Failed for ${failedCount}: ${communityShareResults.failed.join(', ')}`;
				}

				// Close dropdown/modal after short delay
				setTimeout(() => {
					isOpen = false;
					communityShareSuccess = '';
				}, 2500);
			} else if (failedCount > 0) {
				communityShareError = `Failed to share with ${failedCount} communit${failedCount > 1 ? 'ies' : 'y'}: ${communityShareResults.failed.join(', ')}`;
			}

			// Refresh existing shares and reset selection
			await checkExistingCommunityShares();
			selectedCommunityIds = [];
		} catch (error) {
			console.error('Error applying community shares:', error);
			communityShareError =
				error instanceof Error ? error.message : 'Failed to apply community sharing changes';
		} finally {
			isProcessingCommunityShares = false;
		}
	}

	/**
	 * Toggle community selection
	 * @param {string} communityPubkey
	 */
	function toggleCommunitySelection(communityPubkey) {
		if (selectedCommunityIds.includes(communityPubkey)) {
			selectedCommunityIds = selectedCommunityIds.filter((id) => id !== communityPubkey);
		} else {
			selectedCommunityIds = [...selectedCommunityIds, communityPubkey];
		}
	}

	/**
	 * Toggle dropdown/modal
	 */
	function toggleOpen() {
		if (disabled) return;
		isOpen = !isOpen;
		// Reset state when opening
		if (isOpen) {
			selectedCalendarIds = [];
			calendarChangesError = '';
			calendarChangesSuccess = false;
			selectedCommunityIds = [];
			communityShareError = '';
			communityShareSuccess = '';
			if (activeUser && event) {
				checkExistingCommunityShares();
			}
		}
	}

	/**
	 * Close dropdown/modal
	 */
	function close() {
		isOpen = false;
		selectedCalendarIds = [];
		calendarChangesError = '';
		calendarChangesSuccess = false;
	}

	/**
	 * Handle backdrop click for modal
	 * @param {MouseEvent} e
	 */
	function handleBackdropClick(e) {
		if (e.target === e.currentTarget) {
			close();
		}
	}
</script>

{#if isDesktop}
	<!-- Desktop: Dropdown -->
	<div class="dropdown dropdown-end" class:dropdown-open={isOpen}>
		<button
			tabindex="0"
			class="btn btn-primary btn-sm gap-2"
			onclick={toggleOpen}
			disabled={disabled}
		>
			<PlusIcon class_="w-4 h-4" />
			Add to Calendar
			<ChevronDownIcon class_="w-4 h-4" />
		</button>

		<div
			tabindex="0"
			class="menu dropdown-content z-50 mt-2 w-80 rounded-lg bg-base-100 p-4 shadow-xl"
		>
				<div class="mb-3">
					<h3 class="text-lg font-semibold text-base-content">Personal Calendars</h3>
				</div>

				{#if calendarManagement && calendarManagement.calendars.length > 0}
					<!-- Calendar List -->
					<div class="max-h-60 space-y-2 overflow-y-auto">
						{#each calendarManagement.calendars as calendar}
							{@const isAlreadyInCalendar = calendarsContainingEvent().has(calendar.id)}
							{@const isSelected = selectedCalendarIds.includes(calendar.id)}
							<label
								class="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-base-200"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-primary checkbox-sm"
									checked={isSelected || isAlreadyInCalendar}
									onchange={() => toggleCalendarSelection(calendar.id)}
								/>
								<span class="flex-1 text-sm font-medium">{calendar.title}</span>
								{#if isAlreadyInCalendar && !isSelected}
									<span class="text-xs font-medium text-success">Added</span>
								{:else if isAlreadyInCalendar && isSelected}
									<span class="text-xs font-medium text-warning">Remove</span>
								{:else if isSelected}
									<span class="text-xs font-medium text-info">Add</span>
								{/if}
							</label>
						{/each}
					</div>

					<!-- Apply Button -->
					<div class="mt-4">
						<button
							class="btn btn-primary btn-block btn-sm"
							disabled={selectedCalendarIds.length === 0 || isProcessingChanges}
							onclick={handleApplyCalendarChanges}
						>
							{#if isProcessingChanges}
								<span class="loading loading-sm loading-spinner"></span>
								Applying...
							{:else}
								Apply to {selectedCalendarIds.length || ''} Calendar{selectedCalendarIds.length !==
								1
									? 's'
									: ''}
							{/if}
						</button>
					</div>

					<!-- Success/Error Messages -->
					{#if calendarChangesSuccess}
						<div class="alert alert-success mt-3 py-2">
							<CheckIcon class_="w-4 h-4" />
							<span class="text-sm">Changes applied!</span>
						</div>
					{/if}

					{#if calendarChangesError}
						<div class="alert alert-error mt-3 py-2">
							<AlertIcon class_="w-4 h-4" />
							<span class="text-sm">{calendarChangesError}</span>
						</div>
					{/if}
				{/if}

				<!-- Communities Section -->
				{#if activeUser && joinedCommunities.length > 0}
					<!-- Divider -->
					<div class="divider my-2"></div>

					<div class="mb-3">
						<h4 class="text-md font-semibold text-base-content">Share with Communities</h4>
					</div>

					<!-- Community List -->
					<div class="max-h-40 space-y-2 overflow-y-auto">
						{#each joinedCommunities as community}
							{@const communityPubKey = getTagValue(community, 'd') || ''}
							{@const isAlreadyShared = communitiesWithShares.has(communityPubKey)}
							{@const isSelected = selectedCommunityIds.includes(communityPubKey)}
							{@const getCommunityProfile = useUserProfile(communityPubKey)}
							{@const communityProfile = getCommunityProfile()}
							<label class="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-base-200">
								<input
									type="checkbox"
									class="checkbox checkbox-secondary checkbox-sm"
									checked={isSelected || isAlreadyShared}
									onchange={() => toggleCommunitySelection(communityPubKey)}
								/>
								<span class="flex-1 text-sm font-medium">
									{getDisplayName(communityProfile) ||
										`${communityPubKey.slice(0, 8)}...${communityPubKey.slice(-4)}`}
								</span>
								{#if isAlreadyShared && !isSelected}
									<span class="text-xs font-medium text-success">Shared</span>
								{:else if isAlreadyShared && isSelected}
									<span class="text-xs font-medium text-warning">Unshare</span>
								{:else if isSelected}
									<span class="text-xs font-medium text-info">Share</span>
								{/if}
							</label>
						{/each}
					</div>

					<!-- Share Button -->
					<div class="mt-4">
						<button
							class="btn btn-secondary btn-block btn-sm"
							disabled={selectedCommunityIds.length === 0 || isProcessingCommunityShares}
							onclick={handleApplyCommunityShares}
						>
							{#if isProcessingCommunityShares}
								<span class="loading loading-sm loading-spinner"></span>
								Sharing...
							{:else}
								Share with {selectedCommunityIds.length || ''} Communit{selectedCommunityIds.length !==
								1
									? 'ies'
									: 'y'}
							{/if}
						</button>
					</div>

					<!-- Community Success/Error Messages -->
					{#if communityShareSuccess}
						<div class="alert alert-success mt-3 py-2">
							<CheckIcon class_="w-4 h-4" />
							<span class="text-sm">{communityShareSuccess}</span>
						</div>
					{/if}

					{#if communityShareError}
						<div class="alert alert-error mt-3 py-2">
							<AlertIcon class_="w-4 h-4" />
							<span class="text-sm">{communityShareError}</span>
						</div>
					{/if}
				{/if}

				{#if !calendarManagement || calendarManagement.calendars.length === 0}
					{#if calendarManagement?.loading}
						<div class="flex justify-center py-8">
							<span class="loading loading-spinner loading-md"></span>
						</div>
					{:else}
						<div class="py-4 text-center text-sm text-base-content/60">
							No calendars available. Create one in <a href="/calendar/manage" class="link"
								>Calendar Management</a
							>.
						</div>
					{/if}
				{/if}
		</div>
	</div>
{:else}
	<!-- Mobile: Button that opens modal -->
	<button
		class="btn btn-primary btn-sm gap-2"
		onclick={toggleOpen}
		disabled={disabled}
	>
		<PlusIcon class_="w-4 h-4" />
		Add to Calendar
	</button>

	<!-- Mobile Modal -->
	{#if isOpen}
		<div
			class="fixed inset-0 z-50 flex items-end bg-black/50"
			onclick={handleBackdropClick}
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full rounded-t-2xl bg-base-100 p-6 shadow-xl">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-lg font-semibold text-base-content">Personal Calendars</h3>
					<button class="btn btn-circle btn-ghost btn-sm" onclick={close}>✕</button>
				</div>

				{#if calendarManagement && calendarManagement.calendars.length > 0}
					<!-- Calendar List -->
					<div class="max-h-60 space-y-2 overflow-y-auto">
						{#each calendarManagement.calendars as calendar}
							{@const isAlreadyInCalendar = calendarsContainingEvent().has(calendar.id)}
							{@const isSelected = selectedCalendarIds.includes(calendar.id)}
							<label
								class="flex cursor-pointer items-center gap-3 rounded p-3 hover:bg-base-200"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-primary"
									checked={isSelected || isAlreadyInCalendar}
									onchange={() => toggleCalendarSelection(calendar.id)}
								/>
								<span class="flex-1 font-medium">{calendar.title}</span>
								{#if isAlreadyInCalendar && !isSelected}
									<span class="text-xs font-medium text-success">Added</span>
								{:else if isAlreadyInCalendar && isSelected}
									<span class="text-xs font-medium text-warning">Remove</span>
								{:else if isSelected}
									<span class="text-xs font-medium text-info">Add</span>
								{/if}
							</label>
						{/each}
					</div>

					<!-- Apply Button -->
					<div class="mt-4">
						<button
							class="btn btn-primary btn-block"
							disabled={selectedCalendarIds.length === 0 || isProcessingChanges}
							onclick={handleApplyCalendarChanges}
						>
							{#if isProcessingChanges}
								<span class="loading loading-spinner loading-md"></span>
								Applying...
							{:else}
								Apply to {selectedCalendarIds.length || ''} Calendar{selectedCalendarIds.length !==
								1
									? 's'
									: ''}
							{/if}
						</button>
					</div>

					<!-- Success/Error Messages -->
					{#if calendarChangesSuccess}
						<div class="alert alert-success mt-3">
							<CheckIcon class_="w-5 h-5" />
							<span>Changes applied!</span>
						</div>
					{/if}

					{#if calendarChangesError}
						<div class="alert alert-error mt-3">
							<AlertIcon class_="w-5 h-5" />
							<span>{calendarChangesError}</span>
						</div>
					{/if}
				{/if}

				<!-- Communities Section (Mobile) -->
				{#if activeUser && joinedCommunities.length > 0}
					<!-- Divider -->
					<div class="divider my-3"></div>

					<div class="mb-3">
						<h4 class="text-lg font-semibold text-base-content">Share with Communities</h4>
					</div>

					<!-- Community List -->
					<div class="max-h-60 space-y-2 overflow-y-auto">
						{#each joinedCommunities as community}
							{@const communityPubKey = getTagValue(community, 'd') || ''}
							{@const isAlreadyShared = communitiesWithShares.has(communityPubKey)}
							{@const isSelected = selectedCommunityIds.includes(communityPubKey)}
							{@const getCommunityProfile = useUserProfile(communityPubKey)}
							{@const communityProfile = getCommunityProfile()}
							<label class="flex cursor-pointer items-center gap-3 rounded p-3 hover:bg-base-200">
								<input
									type="checkbox"
									class="checkbox checkbox-secondary"
									checked={isSelected || isAlreadyShared}
									onchange={() => toggleCommunitySelection(communityPubKey)}
								/>
								<span class="flex-1 font-medium">
									{getDisplayName(communityProfile) ||
										`${communityPubKey.slice(0, 8)}...${communityPubKey.slice(-4)}`}
								</span>
								{#if isAlreadyShared && !isSelected}
									<span class="text-xs font-medium text-success">Shared</span>
								{:else if isAlreadyShared && isSelected}
									<span class="text-xs font-medium text-warning">Unshare</span>
								{:else if isSelected}
									<span class="text-xs font-medium text-info">Share</span>
								{/if}
							</label>
						{/each}
					</div>

					<!-- Share Button -->
					<div class="mt-4">
						<button
							class="btn btn-secondary btn-block"
							disabled={selectedCommunityIds.length === 0 || isProcessingCommunityShares}
							onclick={handleApplyCommunityShares}
						>
							{#if isProcessingCommunityShares}
								<span class="loading loading-spinner loading-md"></span>
								Sharing...
							{:else}
								Share with {selectedCommunityIds.length || ''} Communit{selectedCommunityIds.length !==
								1
									? 'ies'
									: 'y'}
							{/if}
						</button>
					</div>

					<!-- Community Success/Error Messages -->
					{#if communityShareSuccess}
						<div class="alert alert-success mt-3">
							<CheckIcon class_="w-5 h-5" />
							<span>{communityShareSuccess}</span>
						</div>
					{/if}

					{#if communityShareError}
						<div class="alert alert-error mt-3">
							<AlertIcon class_="w-5 h-5" />
							<span>{communityShareError}</span>
						</div>
					{/if}
				{/if}

				{#if !calendarManagement || calendarManagement.calendars.length === 0}
					{#if calendarManagement?.loading}
						<div class="flex justify-center py-8">
							<span class="loading loading-spinner loading-lg"></span>
						</div>
					{:else}
						<div class="py-8 text-center text-base-content/60">
							No calendars available. Create one in <a href="/calendar/manage" class="link"
								>Calendar Management</a
							>.
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
{/if}
