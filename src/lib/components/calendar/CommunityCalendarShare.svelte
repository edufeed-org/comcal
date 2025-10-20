<script>
	import { useJoinedCommunitiesList } from '../../stores/joined-communities-list.svelte.js';
	import { useUserProfile } from '../../stores/user-profile.svelte.js';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { EventFactory } from 'applesauce-factory';
	import { publishEvent } from '../../helpers/publisher.js';
	import {
		getTagValue,
		getDisplayName,
		getAddressPointerForEvent,
		getAddressPointerFromATag,
		getReplaceableIdentifier,
		getReplaceableAddress
	} from 'applesauce-core/helpers';
	import { PlusIcon, CheckIcon, AlertIcon } from '../icons';
	import { onDestroy } from 'svelte';
	import { addressLoader } from '$lib/loaders/base.js';
	import { targetedPublicationTimelineLoader } from '$lib/loaders/calendar.js';

	/**
	 * @typedef {Object} Props
	 * @property {any} event - Calendar event to share
	 * @property {any} activeUser - Current active user
	 * @property {boolean} [compact=false] - Use compact layout for dropdowns
	 */

	/** @type {Props} */
	let { event, activeUser, compact = false } = $props();

	// Get joined communities
	const getJoinedCommunities = useJoinedCommunitiesList();
	const joinedCommunities = $derived(getJoinedCommunities());

	// State management
	let selectedCommunityIds = $state(/** @type {string[]} */ ([]));
	let communitiesWithShares = $state(new Set());
	let isCheckingShares = $state(false);
	let isProcessingCommunityShares = $state(false);
	let communityShareError = $state('');
	let communityShareSuccess = $state('');
	let communityShareResults = $state({
		successful: /** @type {string[]} */ ([]),
		failed: /** @type {string[]} */ ([])
	});

	// Store subscriptions for cleanup
	/** @type {Array<import('rxjs').Subscription>} */
	let subscriptions = [];

	// TODO make this a shared helper function
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
			console.warn(
				`🌐 CommunityCalendarShare: Failed to get community name for ${communityPubkey}:`,
				error
			);
			return communityPubkey.slice(0, 8);
		}
	}

	/**
	 * Check which communities already have sharing events for this calendar event
	 * Uses address-based d-tag format to find existing shares
	 * Uses Applesauce EventStore subscription pattern (no promises!)
	 */
	function checkExistingCommunityShares() {
		console.log('🌐 CommunityCalendarShare: Starting check for existing shares');

		if (!activeUser || !event || !joinedCommunities.length) {
			console.log('🌐 CommunityCalendarShare: Missing requirements for checking shares');
			communitiesWithShares = new Set();
			return;
		}

		isCheckingShares = true;

		// Use local Set to accumulate results without triggering reactive updates
		const shares = new Set();
		let pendingChecks = joinedCommunities.length;

		console.log(
			`🌐 CommunityCalendarShare: Checking ${joinedCommunities.length} communities for existing shares`
		);

		// Clean up any existing subscriptions
		subscriptions.forEach((sub) => sub.unsubscribe());
		subscriptions = [];

		// Check each joined community for existing share events
		// Using EventStore's subscription pattern - reactive, no promises!
		for (const community of joinedCommunities) {
			const communityPubkey = getTagValue(community, 'd') || '';
			if (!communityPubkey) {
				console.warn('🌐 CommunityCalendarShare: Community missing pubkey');
				pendingChecks--;
				if (pendingChecks === 0) {
					// Create NEW Set instance to trigger Svelte 5 reactivity
					communitiesWithShares = new Set(shares);
					isCheckingShares = false;
				}
				continue;
			}

			// Subscribe to replaceable event - reactive pattern
			console.log('looking for share event for community:', communityPubkey);
			const sub = targetedPublicationTimelineLoader(communityPubkey)().subscribe((shareEvent) => {
				if (shareEvent) {
					console.log(shareEvent);
					isCheckingShares = false;
					communitiesWithShares = new Set(shares);
					console.log(communitiesWithShares);
					const aTag = shareEvent.tags.find((t) => t[0] === 'a');
					if (!aTag) {
						console.log('🌐 CommunityCalendarShare: Share event has no "a" tag, skipping');
						return; // Skip this share event
					}

					const aTagOfEvent = getAddressPointerForEvent(event.originalEvent);
					const addressPointerOfShare = getAddressPointerFromATag(aTag);

					console.log(aTagOfEvent);
					console.log(addressPointerOfShare);

					const idMatch = aTagOfEvent.identifier == addressPointerOfShare.identifier;
					const kindMatch = aTagOfEvent.kind === addressPointerOfShare.kind;
					const pubkeyMatch = aTagOfEvent.pubkey === addressPointerOfShare.pubkey;

					console.log(aTagOfEvent.identifier);
					console.log(addressPointerOfShare.identifier);

					if (idMatch && kindMatch && pubkeyMatch) {
						// Add the community pubkey as the canonical entry (communitiesWithShares expects pubkeys)
						console.log(
							`✅🌐 CommunityCalendarShare: Pointer matches -> identifier: ${idMatch}, kind: ${kindMatch}, pubkey: ${pubkeyMatch}`
						);
						shares.add(communityPubkey);
					}

					// check if identifier, kind and pubkey match of aTagOfEvent and addressPointerOfShare
					// Ensure both pointers exist before comparing
					if (!aTagOfEvent || !addressPointerOfShare) {
						console.warn('🌐 CommunityCalendarShare: Missing address pointer for comparison', {
							aTagOfEvent,
							addressPointerOfShare
						});
					} else {
						// Only treat this as a valid share for the community when all three fields match
						if (idMatch && kindMatch && pubkeyMatch) {
							// Add the community pubkey as the canonical entry (communitiesWithShares expects pubkeys)
							shares.add(communityPubkey);
						} else {
							console.log(
								`🌐 CommunityCalendarShare: Address pointer mismatch for community ${communityPubkey.slice(0, 8)} - ignoring this share event`
							);
						}
					}

					console.log(
						`✅ CommunityCalendarShare: Found existing share for community ${communityPubkey.slice(0, 8)}`
					);
				} else {
					console.log(
						`🌐 CommunityCalendarShare: No share found for community ${communityPubkey.slice(0, 8)}...`
					);
				}

				pendingChecks--;
				if (pendingChecks === 0) {
					// Create NEW Set instance to trigger Svelte 5 reactivity
					communitiesWithShares = new Set(shares);
					isCheckingShares = false;
					console.log(
						`🌐 CommunityCalendarShare: Check complete - found ${shares.size} existing shares`
					);
				}
			});

			subscriptions.push(sub);
		}
	}

	// TODO reuse publish functionality here
	/**
	 * Create a community sharing event (kind 30222)
	 * Uses addressable event reference ('a' tag) instead of event ID ('e' tag)
	 * This ensures the share continues to work even when the event is edited
	 * @param {string} communityPubkey
	 * @returns {Promise<boolean>}
	 */
	async function createCommunityShare(communityPubkey) {
		const eventAddress = getReplaceableAddress(event.originalEvent);
		if (!eventAddress) {
			throw new Error('Cannot create share: event address invalid');
		}

		// Create EventFactory for the user
		const factory = new EventFactory({
			signer: activeUser.signer
		});

		// Generate d-tag based on event address (not event ID)
		const dTag = getReplaceableIdentifier(event.originalEvent);

		console.log(`🌐 CommunityCalendarShare: Creating share event with d-tag: ${dTag}`);

		// Create the sharing event with both 'a' and 'e' tags
		// 'a' tag (addressable reference) ensures share survives event edits
		// 'e' tag (event ID) included for backward compatibility
		const shareEvent = await factory.build({
			kind: 30222,
			tags: [
				['d', dTag],
				['a', eventAddress], // Addressable reference (persistent across edits)
				['e', event.id], // Event ID (for backward compatibility)
				['k', event.kind.toString()],
				['p', communityPubkey]
			]
		});

		// Sign the event
		const signedEvent = await factory.sign(shareEvent);

		// Get default relays from config
		const { appConfig } = await import('$lib/config.js');
		const allRelays = appConfig.calendar.defaultRelays;

		console.log(`🌐 CommunityCalendarShare: Publishing share to ${allRelays.length} relays`);

		const result = await publishEvent(signedEvent, {
			relays: allRelays,
			logPrefix: 'CommunityShare'
		});

		if (result.success) {
			console.log('✅ CommunityCalendarShare: Share created successfully');
		} else {
			console.error('❌ CommunityCalendarShare: Share creation failed');
		}

		return result.success;
	}

	// TODO reuse publish functionality here
	/**
	 * Delete a community sharing event
	 * Uses Applesauce EventStore subscription pattern (no promises except for signing/publishing!)
	 * @param {string} communityPubkey
	 * @returns {Promise<boolean>}
	 */
	async function deleteCommunityShare(communityPubkey) {
		console.log(
			`🌐 CommunityCalendarShare: Deleting share for community ${communityPubkey.slice(0, 8)}...`
		);

		if (!activeUser || !event) {
			throw new Error('Missing user or event data');
		}

		// Get share event from subscription
		return new Promise((resolve) => {
			const sub = eventStore
				.replaceable({
					kind: 30222,
					pubkey: activeUser.pubkey,
					identifier: getReplaceableIdentifier(event.originalEvent)
				})
				.subscribe(async (shareEvent) => {
					sub.unsubscribe();

					if (!shareEvent) {
						console.warn(
							`🌐 CommunityCalendarShare: No share event found for community ${communityPubkey}`
						);
						resolve(true); // Consider it successful if already gone
						return;
					}

					console.log('🌐 CommunityCalendarShare: Share event found, creating deletion event');

					// Create EventFactory for deletion
					const factory = new EventFactory({
						signer: activeUser.signer
					});

					// Create deletion event (kind 5)
					const deleteEvent = await factory.delete([shareEvent]);

					// Get default relays from config
					const { appConfig } = await import('$lib/config.js');

					// Publish deletion
					const result = await publishEvent(deleteEvent, {
						relays: appConfig.calendar.defaultRelays,
						logPrefix: 'CommunityShareDelete'
					});

					if (result.success) {
						console.log('✅ CommunityCalendarShare: Share deleted successfully');
					} else {
						console.error('❌ CommunityCalendarShare: Share deletion failed');
					}

					resolve(result.success);
				});
		});
	}

	/**
	 * Handle applying community sharing changes
	 */
	async function handleApplyCommunityShares() {
		if (selectedCommunityIds.length === 0 || !activeUser || !event) {
			console.log('🌐 CommunityCalendarShare: Nothing to apply');
			return;
		}

		isProcessingCommunityShares = true;
		communityShareError = '';
		communityShareSuccess = '';
		communityShareResults = { successful: [], failed: [] };

		console.log(`🌐 CommunityCalendarShare: Processing ${selectedCommunityIds.length} communities`);

		try {
			// Process each selected community
			for (const communityPubkey of selectedCommunityIds) {
				const isAlreadyShared = communitiesWithShares.has(communityPubkey);
				const communityName = await getCommunityName(communityPubkey);

				try {
					let success = false;
					if (isAlreadyShared) {
						console.log(`🌐 CommunityCalendarShare: Removing share for "${communityName}"`);
						success = await deleteCommunityShare(communityPubkey);
					} else {
						console.log(`🌐 CommunityCalendarShare: Creating share for "${communityName}"`);
						success = await createCommunityShare(communityPubkey);
					}

					if (success) {
						communityShareResults.successful.push(communityName);
					} else {
						communityShareResults.failed.push(communityName);
					}
				} catch (error) {
					console.error(
						`🌐 CommunityCalendarShare: Failed to process community share for ${communityPubkey}:`,
						error
					);
					communityShareResults.failed.push(communityName);
				}
			}

			// Update success message
			const successfulCount = communityShareResults.successful.length;
			const failedCount = communityShareResults.failed.length;

			if (successfulCount > 0) {
				communityShareSuccess = `Successfully shared with ${successfulCount} community${successfulCount > 1 ? 'ies' : ''}`;
				if (failedCount > 0) {
					communityShareSuccess += `, failed for ${failedCount}`;
				}
			} else if (failedCount > 0) {
				communityShareError = `Failed to share with ${failedCount} community${failedCount > 1 ? 'ies' : ''}`;
			}

			// Refresh existing shares and reset selection
			await checkExistingCommunityShares();
			selectedCommunityIds = [];

			console.log(
				`🌐 CommunityCalendarShare: Processing complete - ${successfulCount} successful, ${failedCount} failed`
			);
		} catch (error) {
			console.error('🌐 CommunityCalendarShare: Error applying community shares:', error);
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
		console.log('🌐 CommunityCalendarShare: Selected communities:', selectedCommunityIds);
	}

	/**
	 * Select all communities that don't already have shares
	 */
	function selectAllCommunities() {
		const availableCommunities = joinedCommunities
			.filter((community) => {
				const pubkey = getTagValue(community, 'd') || '';
				return !communitiesWithShares.has(pubkey);
			})
			.map((community) => getTagValue(community, 'd') || '');
		selectedCommunityIds = availableCommunities;
		console.log(
			'🌐 CommunityCalendarShare: Selected all available communities:',
			availableCommunities
		);
	}

	/**
	 * Deselect all communities
	 */
	function deselectAllCommunities() {
		selectedCommunityIds = [];
		console.log('🌐 CommunityCalendarShare: Deselected all communities');
	}

	// Check existing shares when component mounts or event/user changes
	$effect(() => {
		if (activeUser && event && joinedCommunities.length > 0) {
			console.log('🌐 CommunityCalendarShare: Effect triggered - checking existing shares');
			checkExistingCommunityShares();
		}
	});

	// Cleanup subscriptions on component destroy
	onDestroy(() => {
		subscriptions.forEach((sub) => sub.unsubscribe());
		subscriptions = [];
	});
</script>

<!-- Community Sharing UI -->
<div class="community-calendar-share" class:compact>
	<div class="mb-3">
		<div class="mb-2 flex items-center justify-between">
			<label class="block text-sm font-medium text-base-content">
				{compact ? 'Share with Communities' : 'Select Communities'}
			</label>
			{#if joinedCommunities.length > 1}
				<div class="flex gap-2">
					<button
						class="btn btn-ghost btn-xs"
						onclick={selectAllCommunities}
						disabled={selectedCommunityIds.length === joinedCommunities.length || isCheckingShares}
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

		<!-- Community Checkboxes -->
		{#if isCheckingShares}
			<div class="flex items-center justify-center py-8">
				<span class="loading loading-spinner {compact ? 'loading-sm' : 'loading-md'}"></span>
				<span class="ml-2 text-sm text-base-content/70">Checking existing shares...</span>
			</div>
		{:else if joinedCommunities.length > 0}
			<div class="max-h-40 overflow-y-auto rounded-lg border border-base-300 p-3">
				{#each joinedCommunities as community}
					{@const communityPubKey = getTagValue(community, 'd') || ''}
					{@const isAlreadyShared = communitiesWithShares.has(communityPubKey)}
					{@const isSelected = selectedCommunityIds.includes(communityPubKey)}
					{@const getCommunityProfile = useUserProfile(communityPubKey)}
					{@const communityProfile = getCommunityProfile()}
					<label class="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-base-200">
						<input
							type="checkbox"
							class="checkbox checkbox-secondary {compact ? 'checkbox-sm' : ''}"
							checked={isSelected || isAlreadyShared}
							onchange={() => toggleCommunitySelection(communityPubKey)}
						/>
						<span class="font-medium {compact ? 'text-sm' : ''}">
							{getDisplayName(communityProfile) ||
								`${communityPubKey.slice(0, 8)}...${communityPubKey.slice(-4)}`}
						</span>
						{#if isAlreadyShared && !isSelected}
							<span class="text-xs font-medium text-success">(Shared - click to unshare)</span>
						{:else if isAlreadyShared && isSelected}
							<span class="text-xs font-medium text-warning">(Will be unshared)</span>
						{:else if isSelected}
							<span class="text-xs font-medium text-info">(Will be shared)</span>
						{/if}
					</label>
				{/each}
			</div>

			<!-- Selected Communities Summary -->
			{#if selectedCommunityIds.length > 0}
				<div class="mt-2 text-sm text-base-content/70">
					{selectedCommunityIds.length} community{selectedCommunityIds.length > 1 ? 'ies' : ''} selected
				</div>
			{/if}
		{:else}
			<div class="py-4 text-center text-base-content/60 {compact ? 'text-sm' : ''}">
				No joined communities available
			</div>
		{/if}
	</div>

	<!-- Apply Community Shares Button -->
	<div class="flex items-center gap-3">
		<button
			class="btn btn-secondary {compact ? 'btn-block btn-sm' : ''}"
			disabled={selectedCommunityIds.length === 0 || isProcessingCommunityShares}
			onclick={handleApplyCommunityShares}
		>
			{#if isProcessingCommunityShares}
				<span class="loading loading-spinner {compact ? 'loading-sm' : ''}"></span>
				Sharing with {selectedCommunityIds.length} community{selectedCommunityIds.length > 1
					? 'ies'
					: ''}...
			{:else}
				<PlusIcon class_="w-4 h-4 mr-2" />
				Share with {selectedCommunityIds.length || 'Selected'} Communit{selectedCommunityIds.length !==
				1
					? 'ies'
					: 'y'}
			{/if}
		</button>
	</div>

	<!-- Community Share Success Message -->
	{#if communityShareSuccess}
		<div class="mt-3 alert alert-success {compact ? 'py-2' : ''}">
			<CheckIcon class_={compact ? 'w-4 h-4' : 'w-5 h-5'} />
			<span class={compact ? 'text-sm' : ''}>{communityShareSuccess}</span>
		</div>
	{/if}

	<!-- Community Share Error Message -->
	{#if communityShareError}
		<div class="mt-3 alert alert-error {compact ? 'py-2' : ''}">
			<AlertIcon class_={compact ? 'w-4 h-4' : 'w-5 h-5'} />
			<span class={compact ? 'text-sm' : ''}>{communityShareError}</span>
		</div>
	{/if}
</div>

<style>
	.community-calendar-share.compact {
		/* Compact mode adjustments can be added here if needed */
	}
</style>
