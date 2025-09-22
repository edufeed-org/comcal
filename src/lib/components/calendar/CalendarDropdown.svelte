<!--
  CalendarDropdown Component - OPTIMIZED
  Uses EventStore intelligence directly for maximum performance and simplicity
  - Direct eventStore.timeline() access instead of complex loader chains
  - EventStore bootstrap on mount for proper relay connections
  - Leverages existing loaders from loaders.js for EventStore intelligence
  - Fixed JavaScript scoping error and simplified data flow
-->

<script>
	import { onMount, onDestroy } from 'svelte';
	import { eventStore } from '$lib/store.svelte';
	import { calendarDefinitionLoader } from '$lib/loaders.js';
	import { getCalendarEventTitle } from 'applesauce-core/helpers/calendar-event';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { calendarEventsStore } from '$lib/stores/calendar-events.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';
	import { CalendarIcon, GlobeIcon, UserIcon, CheckIcon, PlusIcon, SettingsIcon, RefreshIcon, LockIcon } from '$lib/components/icons';

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

	// Simplified subscription management
	let subscription = $state();
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
			event.tags.forEach((/** @type {any} */ tag) => {
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
	 * Load user's calendars using EventStore intelligence - OPTIMIZED!
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

		console.log(`📅 CalendarDropdown: Loading calendars for user: ${activeUser.pubkey}`);

		// Build filter for calendar events (kind 31924)
		const filter = { kinds: [31924], authors: [activeUser.pubkey], limit: 100 };

		// Direct EventStore timeline access - leverages existing loader intelligence!
		subscription = eventStore.timeline(filter).subscribe({
			next: (/** @type {any[]} */ timeline) => {
				console.log(`📅 CalendarDropdown: Timeline updated: ${timeline.length} calendars`);
				
				// Convert raw events to SimpleCalendar format
				const simpleCalendars = timeline.map(convertToSimpleCalendar);
				calendars = simpleCalendars;
				
				loading = false;
			},
			error: (/** @type {any} */ err) => {
				console.error('📅 CalendarDropdown: Timeline error:', err);
				error = 'Failed to load calendars';
				loading = false;
			}
		});
	}

	// Bootstrap EventStore and subscribe to user changes
	onMount(() => {
		console.log('📅 CalendarDropdown: Mounting and bootstrapping EventStore');
		
		// Bootstrap EventStore by executing the calendar timeline loader first
		// This establishes the relay connections that EventStore needs
		console.log('📅 CalendarDropdown: Bootstrapping EventStore with calendar loader...');
		
		// Execute calendar definition loader to bootstrap EventStore
		calendarDefinitionLoader().subscribe({
			complete: () => {
				console.log('📅 CalendarDropdown: Calendar definition loader bootstrap complete');
			},
			error: (/** @type {any} */ err) => {
				console.warn('📅 CalendarDropdown: Calendar definition loader bootstrap error:', err);
			}
		});
		
		// Subscribe to manager.active$ for reactive updates
		userSubscription = manager.active$.subscribe((user) => {
			activeUser = user;
			loadUserCalendars();
		});

		// Initial load after bootstrap
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
		
		// Update the store with the selection
		calendarEventsStore.setSelectedCalendar(calendarId, selectedCalendar);
		
		// Clear events to trigger reload
		calendarEventsStore.clearEvents();
		
		onCalendarSelect(calendarId);
		console.log('📅 CalendarDropdown: Calendar selected:', calendarId, selectedCalendar);
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
					<CalendarIcon class_="h-5 w-5" />
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
							<GlobeIcon class_="h-4 w-4 text-primary" />
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium">Global Calendar</div>
								<div class="text-xs text-base-content/60">All community events</div>
							</div>
							{#if !selectedCalendarId}
								<CheckIcon class_="h-4 w-4 text-primary" />
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
								<UserIcon class_="h-4 w-4 text-primary" />
								<div class="min-w-0 flex-1">
									<div class="text-sm font-medium">My Events</div>
									<div class="text-xs text-base-content/60">Events I created</div>
								</div>
								{#if selectedCalendarId === activeUser.pubkey}
									<CheckIcon class_="h-4 w-4 text-primary" />
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
										<CalendarIcon class_="h-4 w-4 text-primary" />
										<div class="min-w-0 flex-1">
											<div class="truncate text-sm font-medium">{calendar.title}</div>
											{#if calendar.description}
												<div class="truncate text-xs text-base-content/60">
													{calendar.description}
												</div>
											{/if}
										</div>
										{#if selectedCalendarId === calendar.id}
											<CheckIcon class_="h-4 w-4 text-primary" />
										{/if}
									</a>
								</li>
							{/each}
						{:else if !loading}
							<!-- No calendars message -->
							<li>
								<div class="px-3 py-4 text-center text-base-content/60">
									<CalendarIcon class_="mx-auto mb-2 h-8 w-8 opacity-50" />
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
								<PlusIcon class_="h-4 w-4" />
								<span class="font-medium">Create New Calendar</span>
							</a>
						</li>

						<!-- Manage Calendars -->
						<li>
							<a
								href="/calendar/manage"
								class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-200"
							>
								<SettingsIcon class_="h-4 w-4" />
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
									<RefreshIcon class_={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
									<span class="text-sm">Refresh Calendars</span>
								</a>
							</li>
						{/if}
					{:else}
						<!-- Not logged in message -->
						<li><hr class="my-1 border-base-300" /></li>
						<li>
							<div class="px-3 py-4 text-center text-base-content/60">
								<LockIcon class_="mx-auto mb-2 h-8 w-8 opacity-50" />
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
