<!--
  CommunikeyCalendarView Component
  Community-specific calendar view that reuses existing calendar components
  Uses TimelineModel with EventStore for proper applesauce integration
-->

<script>
	import { onMount, onDestroy } from 'svelte';
	import { eventStore } from '$lib/store.svelte';
	import {
		communityCalendarTimelineLoader,
		targetedPublicationTimelineLoader,
		eventLoader
	} from '$lib/loaders.js';
	import {
		getCalendarEventTitle,
		getCalendarEventStart,
		getCalendarEventEnd,
		getCalendarEventImage
	} from 'applesauce-core/helpers/calendar-event';
	import { groupEventsByDate } from '$lib/helpers/calendar.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';

	// Import existing UI components
	import CalendarNavigation from '$lib/components/calendar/CalendarNavigation.svelte';
	import CalendarGrid from '$lib/components/calendar/CalendarGrid.svelte';
	import CalendarEventsList from './CalendarEventsList.svelte';
	import CalendarEventModal from '$lib/components/calendar/CalendarEventModal.svelte';
	import AddToCalendarButton from '$lib/components/calendar/AddToCalendarButton.svelte';
	import { getTagValue, getDisplayName } from 'applesauce-core/helpers';
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';

	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
	 * @typedef {import('$lib/types/calendar.js').CalendarViewMode} CalendarViewMode
	 */

	// Props
	let { communityPubkey } = $props();

	// Calendar view state (local to this component)
	let currentDate = $state(new Date());
	let viewMode = $state(/** @type {CalendarViewMode} */ ('month'));
	let presentationViewMode = $state(/** @type {'calendar' | 'list' | 'map'} */ ('calendar'));

	// Component state
	let events = $state(/** @type {CalendarEvent[]} */ ([]));
	let loading = $state(false);
	let error = $state(/** @type {string | null} */ (null));
	let subscription = $state();
	let targetedPublicationSubscription = $state();
	let resolutionErrors = $state(/** @type {string[]} */ ([]));

	// Modal state
	let isEventModalOpen = $state(false);
	let selectedDateForNewEvent = $state(/** @type {Date | null} */ (null));

	// Reactive references to store state
	let activeUser = $state(manager.active);

	/**
	 * Convert raw event to CalendarEvent format
	 * @param {any} event
	 * @returns {CalendarEvent}
	 */
	function convertToCalendarEvent(event) {
		const startTimestamp = getCalendarEventStart(event);
		const endTimestamp = getCalendarEventEnd(event);
		const validStartTimestamp = startTimestamp || Math.floor(Date.now() / 1000);

		const dTag = Array.isArray(event.tags)
			? event.tags.find((/** @type {any} */ t) => t && t[0] === 'd')?.[1] || undefined
			: undefined;

		return {
			id: event.id,
			pubkey: event.pubkey,
			kind: /** @type {import('$lib/types/calendar.js').CalendarEventKind} */ (event.kind),
			title: getCalendarEventTitle(event) || 'Untitled Event',
			summary: event.content || '',
			image: getCalendarEventImage(event) || '',
			start: validStartTimestamp,
			end: endTimestamp,
			startTimezone: undefined,
			endTimezone: undefined,
			location: '',
			participants: [],
			hashtags: [],
			references: [],
			geohash: undefined,
			communityPubkey: communityPubkey,
			createdAt: event.created_at,
			dTag,
			eventReferences: [],
			originalEvent: event
		};
	}

	// Get community profile for calendar title
	const getCommunityProfile = useUserProfile(communityPubkey);
	let communityProfile = $derived(getCommunityProfile());
	let communityCalendarTitle = $derived(() => {
		const displayName = communityProfile?.name || communityProfile?.display_name || '';
		return displayName ? `${displayName} Calendar` : 'Community Calendar';
	});

	/**
	 * Load community-specific calendar events from both direct events and targeted publications
	 */
	function loadCommunityEvents() {
		console.log('📅 CommunikeyCalendarView: Loading events for community:', communityPubkey);

		loading = true;
		error = null;
		resolutionErrors = [];

		// Clean up existing subscriptions
		if (subscription) {
			subscription.unsubscribe();
			subscription = undefined;
		}
		if (targetedPublicationSubscription) {
			targetedPublicationSubscription.unsubscribe();
			targetedPublicationSubscription = undefined;
		}

		const allEvents = /** @type {CalendarEvent[]} */ ([]);

		try {
			// Subscribe to direct community calendar events (#h tagged)
			subscription = eventStore
				.timeline({
					kinds: [31922, 31923], // NIP-52 calendar events
					'#h': [communityPubkey], // Community-targeted events
					limit: 100
				})
				.subscribe({
					next: (/** @type {any[]} */ timeline) => {
						console.log(
							`📅 CommunikeyCalendarView: Received ${timeline.length} direct community events`
						);
						const directEvents = timeline.map(convertToCalendarEvent);
						allEvents.push(...directEvents);
						events = [...allEvents]; // Update events array
					},
					error: (/** @type {any} */ err) => {
						console.error('📅 CommunikeyCalendarView: Error loading direct community events:', err);
						error = 'Failed to load community calendar events';
					}
				});

			// Subscribe to targeted publication events (#p tagged with calendar #k)
			targetedPublicationSubscription = targetedPublicationTimelineLoader(
				communityPubkey
			)().subscribe({
				next: (/** @type {any} */ pubEvent) => {
					console.log(
						`📅 CommunikeyCalendarView: Received targeted publication event:`,
						pubEvent.id
					);

					try {
						// Extract the 'e' tag (referenced event ID)
						const eTag = getTagValue(pubEvent, 'e');
						if (!eTag) {
							console.warn(
								'📅 CommunikeyCalendarView: Targeted publication missing e tag:',
								pubEvent.id
							);
							return;
						}

						// Check if the referenced event is already in EventStore
						const referencedEvent = eventStore.getEvent(eTag);
						if (referencedEvent) {
							eventLoader({
								id: eTag,
								relays: ['wss://relay.damus.io', 'wss://relay-rpi.edufeed.org']
							}).subscribe({
								next: (loadedEvent) => {
									if (loadedEvent) {
										console.log(
											`📅 CommunikeyCalendarView: Successfully loaded referenced event ${eTag}`
										);
										const calendarEvent = convertToCalendarEvent(loadedEvent);
										allEvents.push(calendarEvent);
										events = [...allEvents]; // Update events array
									}
								},
								error: (/** @type {any} */ err) => {
									const errorMsg = `Failed to load referenced calendar event: ${eTag}`;
									console.warn(`📅 CommunikeyCalendarView: ${errorMsg}`);
									resolutionErrors = [...resolutionErrors, errorMsg];
								}
							});
						} else {
							console.log(
								`📅 CommunikeyCalendarView: Referenced event ${eTag} not found in EventStore, attempting to load`
							);
							// TODO FIX THIS Fallback: try to load the event if not in cache
							eventLoader({
								id: eTag,
								relays: ['wss://relay.damus.io', 'wss://relay-rpi.edufeed.org']
							}).subscribe({
								next: (loadedEvent) => {
									if (loadedEvent) {
										console.log(
											`📅 CommunikeyCalendarView: Successfully loaded referenced event ${eTag}`
										);
										const calendarEvent = convertToCalendarEvent(loadedEvent);
										allEvents.push(calendarEvent);
										events = [...allEvents]; // Update events array
									}
								},
								error: (/** @type {any} */ err) => {
									const errorMsg = `Failed to load referenced calendar event: ${eTag}`;
									console.warn(`📅 CommunikeyCalendarView: ${errorMsg}`);
									resolutionErrors = [...resolutionErrors, errorMsg];
								}
							});
						}
					} catch (err) {
						const errorMsg = `Error resolving targeted publication ${pubEvent.id}: ${/** @type {Error} */ (err).message}`;
						console.error(`📅 CommunikeyCalendarView: ${errorMsg}`);
						resolutionErrors = [...resolutionErrors, errorMsg];
					}
				},
				complete: () => {
					console.log('📅 CommunikeyCalendarView: Finished loading targeted publication events');
					loading = false; // Mark loading complete after processing all targeted publications
				},
				error: (/** @type {any} */ err) => {
					console.error(
						'📅 CommunikeyCalendarView: Error loading targeted publication events:',
						err
					);
					loading = false;
				}
			});
		} catch (err) {
			console.error('📅 CommunikeyCalendarView: Error creating subscriptions:', err);
			error = 'Failed to connect to event stream';
			loading = false;
		}
	}

	// Mount: Bootstrap EventStore and load events
	onMount(() => {
		console.log('📅 CommunikeyCalendarView: Mounting for community:', communityPubkey);

		// Bootstrap EventStore with community calendar loader
		communityCalendarTimelineLoader(communityPubkey)().subscribe({
			complete: () => {
				console.log('📅 CommunikeyCalendarView: Community calendar loader bootstrap complete');
			},
			error: (err) => {
				console.warn('📅 CommunikeyCalendarView: Community calendar loader bootstrap error:', err);
			}
		});

		// Load community events
		loadCommunityEvents();
	});

	onDestroy(() => {
		if (subscription) {
			subscription.unsubscribe();
		}
		if (targetedPublicationSubscription) {
			targetedPublicationSubscription.unsubscribe();
		}
	});

	/**
	 * Handle navigation to previous period
	 */
	function handlePrevious() {
		const newDate = new Date(currentDate);
		switch (viewMode) {
			case 'month':
				newDate.setMonth(newDate.getMonth() - 1);
				break;
			case 'week':
				newDate.setDate(newDate.getDate() - 7);
				break;
			case 'day':
				newDate.setDate(newDate.getDate() - 1);
				break;
		}
		currentDate = newDate;
	}

	/**
	 * Handle navigation to next period
	 */
	function handleNext() {
		const newDate = new Date(currentDate);
		switch (viewMode) {
			case 'month':
				newDate.setMonth(newDate.getMonth() + 1);
				break;
			case 'week':
				newDate.setDate(newDate.getDate() + 7);
				break;
			case 'day':
				newDate.setDate(newDate.getDate() + 1);
				break;
		}
		currentDate = newDate;
	}

	/**
	 * Handle navigation to today
	 */
	function handleToday() {
		currentDate = new Date();
	}

	/**
	 * Handle view mode change
	 * @param {CalendarViewMode} newViewMode
	 */
	function handleViewModeChange(newViewMode) {
		viewMode = newViewMode;
	}

	/**
	 * Handle presentation view mode change
	 * @param {'calendar' | 'list' | 'map'} newPresentationViewMode
	 */
	function handlePresentationViewModeChange(newPresentationViewMode) {
		presentationViewMode = newPresentationViewMode;
		console.log(
			'📅 CommunikeyCalendarView: Presentation view mode changed to:',
			newPresentationViewMode
		);
	}

	/**
	 * Handle date click in calendar grid
	 * @param {Date} date
	 */
	function handleDateClick(date) {
		currentDate = new Date(date);
		viewMode = 'day';
	}

	/**
	 * Handle event click
	 * @param {CalendarEvent} event
	 */
	function handleEventClick(event) {
		modalStore.openModal('eventDetails', { event });
		console.log('📅 CommunikeyCalendarView: Event clicked, opening details modal:', event.title);
	}

	/**
	 * Handle create event button click
	 */
	function handleCreateEvent() {
		selectedDateForNewEvent = currentDate;
		isEventModalOpen = true;
	}

	/**
	 * Handle event modal close
	 */
	function handleEventModalClose() {
		isEventModalOpen = false;
		selectedDateForNewEvent = null;
	}

	/**
	 * Handle event created successfully
	 */
	function handleEventCreated() {
		// Refresh events to show the newly created event
		loadCommunityEvents();
	}

	/**
	 * Handle refresh button click
	 */
	function handleRefresh() {
		loadCommunityEvents();
	}
</script>

<div class="overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm">
	<!-- Calendar Header -->
	<div class="border-b border-base-300 bg-base-200 px-6 py-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<h2 class="text-lg font-semibold text-base-content">Community Calendar</h2>
			</div>
			<div class="flex items-center gap-3">
				<!-- Calendar Subscription Button -->
				<AddToCalendarButton 
					calendarId={communityPubkey} 
					calendarTitle={communityCalendarTitle()}
				/>

				<button
					class="btn btn-ghost btn-sm"
					onclick={handleRefresh}
					disabled={loading}
					aria-label="Refresh calendar"
				>
					<svg
						class="h-5 w-5"
						class:animate-spin={loading}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
				</button>

				{#if activeUser}
					<button class="btn gap-2 btn-sm btn-primary" onclick={handleCreateEvent}>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6v6m0 0v6m0-6h6m-6 0H6"
							/>
						</svg>
						Create Event
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="alert rounded-none border-b alert-error border-error/20 px-6 py-3">
			<div class="flex items-center gap-3">
				<svg class="h-5 w-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span class="flex-1 text-sm">{error}</span>
				<button
					class="btn btn-ghost btn-xs"
					onclick={() => (error = null)}
					aria-label="Dismiss error"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<!-- Resolution Errors Display -->
	{#if resolutionErrors.length > 0}
		<div class="alert rounded-none border-b alert-warning border-warning/20 px-6 py-3">
			<div class="flex items-start gap-3">
				<svg
					class="mt-0.5 h-5 w-5 text-warning"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
					/>
				</svg>
				<div class="flex-1">
					<h4 class="mb-1 text-sm font-medium">Some calendar events could not be loaded</h4>
					<p class="mb-2 text-xs text-base-content/70">
						{resolutionErrors.length} referenced event{resolutionErrors.length === 1 ? '' : 's'} could
						not be found or loaded.
					</p>
					<details class="text-xs">
						<summary class="cursor-pointer hover:text-base-content">Show details</summary>
						<ul class="mt-2 space-y-1">
							{#each resolutionErrors as errorMsg}
								<li class="text-base-content/60">• {errorMsg}</li>
							{/each}
						</ul>
					</details>
				</div>
				<button
					class="btn btn-ghost btn-xs"
					onclick={() => (resolutionErrors = [])}
					aria-label="Dismiss resolution errors"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<!-- Calendar Navigation -->
	<CalendarNavigation
		{currentDate}
		{viewMode}
		{presentationViewMode}
		onPrevious={handlePrevious}
		onNext={handleNext}
		onToday={handleToday}
		onViewModeChange={handleViewModeChange}
		onPresentationViewModeChange={handlePresentationViewModeChange}
	/>

	<!-- Content based on presentation view mode -->
	{#if presentationViewMode === 'calendar'}
		<!-- Calendar Grid -->
		<CalendarGrid
			{currentDate}
			{viewMode}
			{events}
			onEventClick={handleEventClick}
			onDateClick={handleDateClick}
		/>
	{:else if presentationViewMode === 'list'}
		<!-- List View -->
		<div class="p-6">
			<CalendarEventsList {events} {loading} {error} />
		</div>
	{:else if presentationViewMode === 'map'}
		<!-- Map View (placeholder for future implementation) -->
		<div class="flex flex-col items-center justify-center px-6 py-16 text-center">
			<div class="mb-4 text-base-content/30">
				<svg class="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</div>
			<h3 class="mb-2 text-lg font-medium text-base-content">Map View Coming Soon</h3>
			<p class="text-base-content/60">
				Map view for calendar events will be available in a future update.
			</p>
		</div>
	{/if}

	<!-- Loading indicator -->
	{#if loading}
		<div class="border-b border-base-300 px-6 py-3 text-center">
			<div class="flex items-center justify-center gap-3">
				<div class="loading loading-sm loading-spinner"></div>
				<div class="text-sm text-base-content/70">
					{#if events.length === 0}
						Loading community calendar events...
					{:else}
						Loading more events... ({events.length} loaded)
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Empty State -->
	{#if events.length === 0 && !loading}
		<div class="flex flex-col items-center justify-center px-6 py-16 text-center">
			<div class="mb-4 text-base-content/30">
				<svg class="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1"
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</div>
			<h3 class="mb-2 text-lg font-medium text-base-content">No calendar events yet</h3>
			<p class="mb-6 max-w-md text-base-content/60">
				This community doesn't have any calendar events yet. Be the first to create one!
			</p>
			{#if activeUser}
				<button class="btn btn-primary" onclick={handleCreateEvent}> Create First Event </button>
			{/if}
		</div>
	{/if}

	<!-- Event Creation Modal -->
	<CalendarEventModal
		isOpen={isEventModalOpen}
		{communityPubkey}
		selectedDate={selectedDateForNewEvent}
		onClose={handleEventModalClose}
		onEventCreated={handleEventCreated}
	/>
</div>
