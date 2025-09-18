<!--
  SimpleCalendarDropdown Component
  Simplified version of CalendarDropdown using direct timeline loader approach
  Maintains same UI/UX but with simpler data flow
-->

<script>
	import { onMount, onDestroy } from 'svelte';
	import { TimelineModel } from 'applesauce-core/models';
	import { createTimelineLoader } from 'applesauce-loaders/loaders';
	import { pool, relays, eventStore } from '$lib/store.svelte';
	import { getCalendarEventTitle } from 'applesauce-core/helpers/calendar-event';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';

	/**
	 * @typedef {Object} SimpleCalendar
	 * @property {string} id - Calendar event ID
	 * @property {string} pubkey - Calendar owner pubkey
	 * @property {number} kind - Event kind (31924)
	 * @property {string} title - Calendar title
	 * @property {string} description - Calendar description
	 * @property {string} dTag - Unique identifier (d-tag)
	 * @property {string[]} eventReferences - Array of event references (a-tags)
	 * @property {number} createdAt - Creation timestamp
	 */

	// Props
	let { selectedCalendarId = $bindable(''), selectedCalendar = $bindable(null), onCalendarSelect = () => {} } = $props();

	// Simple reactive state using Svelte 5 runes
	let calendars = $state(/** @type {SimpleCalendar[]} */ ([]));
	let loading = $state(false);
	let error = $state(/** @type {string | null} */ (null));
	let activeUser = $state(manager.active);

	// Timeline loader and subscription
	let subscription = $state();
	let timelineLoader = $state();
	let userSubscription = $state();

	/**
	 * Convert raw event to SimpleCalendar format
	 * @param {any} event
	 * @returns {SimpleCalendar}
	 */
	function convertToSimpleCalendar(event) {
		const calendar = {
			id: event.id || '',
			pubkey: event.pubkey || '',
			kind: event.kind,
			title: getCalendarEventTitle(event) || 'Untitled Calendar',
			description: event.content || '',
			dTag: '',
			eventReferences: [],
			createdAt: event.created_at || 0
		};

		// Extract data from tags
		if (event.tags) {
			event.tags.forEach(tag => {
				switch (tag[0]) {
					case 'd':
						calendar.dTag = tag[1] || '';
						break;
					case 'a':
						if (tag[1]) calendar.eventReferences.push(tag[1]);
						break;
				}
			});
		}

		return calendar;
	}

	/**
	 * Create calendar timeline loader
	 */
	function createCalendarLoader(userPubkey) {
		return createTimelineLoader(
			pool,
			relays,
			{ kinds: [31924], authors: [userPubkey], limit: 100 },
			{ eventStore }
		);
	}

	/**
	 * Load user's calendars
	 */
	function loadUserCalendars() {
		if (!activeUser) {
			calendars = [];
			return;
		}

		loading = true;
		error = null;

		// Clean up existing subscription
		if (subscription) {
			subscription.unsubscribe();
		}

		// Create and execute timeline loader
		timelineLoader = createCalendarLoader(activeUser.pubkey);
		
		console.log(`📅 SimpleCalendarDropdown: Loading calendars for user: ${activeUser.pubkey}`);

		// Execute the timeline loader to fetch from relays
		subscription = timelineLoader().subscribe({
			next: (/** @type {any} */ event) => {
				console.log(`📅 SimpleCalendarDropdown: Received calendar event:`, event);
				// Events are automatically added to eventStore by the timeline loader
			},
			complete: () => {
				console.log(`📅 SimpleCalendarDropdown: Timeline loader completed`);
				// Now subscribe to the event store to get the accumulated results
				loadCalendarsFromEventStore();
			},
			error: (/** @type {any} */ err) => {
				console.error('📅 SimpleCalendarDropdown: Timeline loader error:', err);
				error = 'Failed to load calendars';
				loading = false;
			}
		});
	}

	/**
	 * Load calendars from event store after timeline loader completes
	 */
	function loadCalendarsFromEventStore() {
		if (!activeUser) return;
		
		// Subscribe to event store to get the loaded calendar events
		const eventStoreSubscription = eventStore
			.model(TimelineModel, { kinds: [31924], authors: [activeUser.pubkey], limit: 100 })
			.subscribe((timeline) => {
				console.log(`📅 SimpleCalendarDropdown: Event store timeline updated: ${timeline.length} calendars`);
				
				// Convert raw events to SimpleCalendar format
				const simpleCalendars = timeline.map(convertToSimpleCalendar);
				calendars = simpleCalendars;
				
				loading = false;
				
				// Clean up this subscription after getting the data
				eventStoreSubscription.unsubscribe();
			});
	}

	// Subscribe to user changes
	onMount(() => {
		console.log('📅 SimpleCalendarDropdown: Mounting');
		
		// Subscribe to manager.active$ for reactive updates
		userSubscription = manager.active$.subscribe((user) => {
			activeUser = user;
			loadUserCalendars();
		});

		// Initial load
		loadUserCalendars();
	});

	onDestroy(() => {
		if (subscription) {
			subscription.unsubscribe();
		}
		if (userSubscription) {
			userSubscription.unsubscribe();
		}
	});

	// Reactive display name that handles all states properly
	let displayName = $derived.by(() => {
		// Not logged in
		if (!activeUser) {
			return 'Log in to manage your calendars';
		}

		// No calendar selected - show Global Calendar
		if (!selectedCalendarId) {
			return 'Global Calendar';
		}

		// My Events selected
		if (activeUser && selectedCalendarId === activeUser.pubkey) {
			return 'My Events';
		}

		// Calendar selected - show its title
		const cal = calendars.find((cal) => cal.id === selectedCalendarId);
		return cal ? cal.title : 'Select Calendar';
	});

	/**
	 * Handle calendar selection
	 * @param {string} calendarId
	 */
	function handleCalendarSelect(calendarId) {
		selectedCalendarId = calendarId;
		
		// Set the selected calendar object
		if (calendarId === '' || (activeUser && calendarId === activeUser.pubkey)) {
			// Global calendar or "My Events" - no specific calendar object
			selectedCalendar = null;
		} else {
			// Find the specific calendar object
			selectedCalendar = calendars.find(cal => cal.id === calendarId) || null;
		}
		
		onCalendarSelect(calendarId);
		console.log('📅 SimpleCalendarDropdown: Calendar selected:', calendarId, selectedCalendar);
	}

	/**
	 * Handle create new calendar
	 */
	function handleCreateCalendar() {
		modalStore.openModal('createCalendar');
	}

	/**
	 * Handle refresh calendars
	 */
	async function handleRefresh() {
		loadUserCalendars();
	}
</script>

<!-- Always show dropdown with different content based on login state -->
<div class="flex-none">
	<ul class="menu menu-horizontal px-1">
		<li>
			<details class="dropdown">
				<summary
					class="btn gap-2 text-xl font-semibold text-base-content btn-ghost"
					class:opacity-50={!activeUser}
					class:cursor-not-allowed={!activeUser}
				>
					<!-- Calendar Icon -->
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
					{displayName}
				</summary>
				<ul
					class="dropdown-content menu z-[1] w-64 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
				>
					<!-- Global Calendar Option (always available) -->
					<li>
						<a
							href="#"
							class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-200"
							class:active={!selectedCalendarId}
							onclick={(e) => {
								e.preventDefault();
								handleCalendarSelect('');
							}}
						>
							<!-- Global Calendar Icon -->
							<svg
								class="h-4 w-4 text-primary"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
								/>
							</svg>
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium">Global Calendar</div>
								<div class="text-xs text-base-content/60">All community events</div>
							</div>
							{#if !selectedCalendarId}
								<svg
									class="h-4 w-4 text-primary"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{/if}
						</a>
					</li>

					<!-- My Events Option (only if logged in) -->
					{#if activeUser}
						<!-- Divider -->
						<li><hr class="my-1 border-base-300" /></li>

						<li>
							<a
								href="#"
								class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-200"
								class:active={selectedCalendarId === activeUser?.pubkey}
								onclick={(e) => {
									e.preventDefault();
									if (activeUser) {
										handleCalendarSelect(activeUser.pubkey);
									}
								}}
							>
								<!-- My Events Icon -->
								<svg
									class="h-4 w-4 text-primary"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
									/>
								</svg>
								<div class="min-w-0 flex-1">
									<div class="text-sm font-medium">My Events</div>
									<div class="text-xs text-base-content/60">Events I created</div>
								</div>
								{#if selectedCalendarId === activeUser.pubkey}
									<svg
										class="h-4 w-4 text-primary"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										/>
									</svg>
								{/if}
							</a>
						</li>
					{/if}

					<!-- User calendars (only if logged in) -->
					{#if activeUser}
						<!-- Divider -->
						<li><hr class="my-1 border-base-300" /></li>

						<!-- Calendar List -->
						{#if calendars.length > 0}
							{#each calendars as calendar (calendar.id)}
								<li>
									<a
										href="#"
										class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-200"
										class:active={selectedCalendarId === calendar.id}
										onclick={(e) => {
											e.preventDefault();
											handleCalendarSelect(calendar.id);
										}}
									>
										<!-- Calendar Icon -->
										<svg
											class="h-4 w-4 text-primary"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
											/>
										</svg>
										<div class="min-w-0 flex-1">
											<div class="truncate text-sm font-medium">{calendar.title}</div>
											{#if calendar.description}
												<div class="truncate text-xs text-base-content/60">
													{calendar.description}
												</div>
											{/if}
										</div>
										{#if selectedCalendarId === calendar.id}
											<svg
												class="h-4 w-4 text-primary"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M5 13l4 4L19 7"
												/>
											</svg>
										{/if}
									</a>
								</li>
							{/each}
						{:else if !loading}
							<!-- No calendars message -->
							<li>
								<div class="px-3 py-4 text-center text-base-content/60">
									<svg
										class="mx-auto mb-2 h-8 w-8 opacity-50"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
										/>
									</svg>
									<p class="text-sm">No calendars found</p>
									<p class="mt-1 text-xs">Create your first calendar below</p>
								</div>
							</li>
						{/if}

						<!-- Loading state -->
						{#if loading}
							<li>
								<div class="px-3 py-4 text-center text-base-content/60">
									<span class="loading loading-spinner loading-sm"></span>
									<p class="mt-2 text-sm">Loading calendars...</p>
								</div>
							</li>
						{/if}

						<!-- Divider -->
						<li><hr class="my-1 border-base-300" /></li>

						<!-- Create New Calendar -->
						<li>
							<a
								href="#"
								class="flex items-center gap-3 rounded-lg px-3 py-2 text-primary transition-colors hover:bg-base-200"
								onclick={(e) => {
									e.preventDefault();
									handleCreateCalendar();
								}}
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 6v6m0 0v6m0-6h6m-6 0H6"
									/>
								</svg>
								<span class="font-medium">Create New Calendar</span>
							</a>
						</li>

						<!-- Manage Calendars -->
						<li>
							<a
								href="/calendar/manage"
								class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-200"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
								</svg>
								<span class="font-medium">Manage Calendars</span>
							</a>
						</li>

						<!-- Refresh Button -->
						{#if calendars.length > 0}
							<li><hr class="my-1 border-base-300" /></li>
							<li>
								<a
									href="#"
									class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-200"
									class:opacity-50={loading}
									class:pointer-events-none={loading}
									onclick={(e) => {
										e.preventDefault();
										if (!loading) {
											handleRefresh();
										}
									}}
								>
									<svg
										class="h-4 w-4"
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
									<span class="text-sm">Refresh Calendars</span>
								</a>
							</li>
						{/if}
					{:else}
						<!-- Not logged in message -->
						<li><hr class="my-1 border-base-300" /></li>
						<li>
							<div class="px-3 py-4 text-center text-base-content/60">
								<svg
									class="mx-auto mb-2 h-8 w-8 opacity-50"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
									/>
								</svg>
								<p class="text-sm">Log in to manage your calendars</p>
								<p class="mt-1 text-xs">Create and organize your own calendar events</p>
							</div>
						</li>
					{/if}
				</ul>
			</details>
		</li>
	</ul>
</div>
