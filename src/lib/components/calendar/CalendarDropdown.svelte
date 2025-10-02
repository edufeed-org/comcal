<script>
	import { onMount } from 'svelte';
	import { eventStore } from '$lib/store.svelte';
	import { calendarLoader } from '$lib/loaders';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { calendarStore, cEvents } from '$lib/stores/calendar-events.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';
	import {
		CalendarIcon,
		GlobeIcon,
		UserIcon,
		CheckIcon,
		PlusIcon,
		SettingsIcon,
		RefreshIcon,
		LockIcon
	} from '$lib/components/icons';
	import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';
	import { TimelineModel } from 'applesauce-core/models';

	/**
	 * @typedef {Object} Calendar
	 * @property {string} id - Calendar event ID
	 * @property {string} pubkey - Calendar owner pubkey
	 * @property {number} kind - Event kind (31924)
	 * @property {string} title - Calendar title
	 * @property {string} description - Calendar description
	 * @property {string} dTag - Unique identifier (d-tag)
	 * @property {string[]} eventReferences - Array of event references (a-tags)
	 * @property {number} createdAt - Creation timestamp
	 */
	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
	 */

	let calendars = $state(/** @type {CalendarEvent[]} */ ([]));
	let loading = $state(false);
	let error = $state(/** @type {string | null} */ (null));
	let activeUser = $state(manager.active);
	let selectedCalendar = $state(calendarStore.selectedCalendar);
	let selectedCalendarId = $derived(selectedCalendar?.id || '');

	// subs
	let calendarSubscription = $state();

	let displayName = $derived.by(() => {
		console.log("setting display name")
		$inspect(selectedCalendar)
		if (!activeUser) {
			return 'Log in to manage your calendars';
		}

		if (!selectedCalendar) {
			return 'Global Calendar';
		}

		if (manager.active && selectedCalendarId === manager.active.pubkey) {
			return 'My Events';
		}

		// Calendar selected - show its title
		const cal = selectedCalendar;
		return cal ? cal.title : 'Select Calendar';
	});

	onMount(() => {
		calendarLoader().subscribe();
		loadUserCalendars();

		calendarSubscription = calendarStore.selectedCalendar$.subscribe((calendar) => {
			console.log('📅 CalendarDropdown: selectedCalendar changed to:', calendar?.id);
			selectedCalendar = calendar;
		});

		return () => {
			calendarSubscription?.unsubscribe();
		};
	});

	manager.active$.subscribe({
		next: (account) => {
			console.log('user changed');
			activeUser = account;
			loadUserCalendars();
		}
	});

	function loadUserCalendars() {
		if (!manager.active) {
			calendars = [];
			return;
		}

		loading = true;
		error = null;

		console.log(`📅 CalendarDropdown: Loading calendars for user: ${manager.active.pubkey}`);

		const filter = { kinds: [31924], authors: [manager.active.pubkey], limit: 100 };

		eventStore.model(TimelineModel, filter).subscribe({
			next: (/** @type {any[]} */ timeline) => {
				console.log(`📅 CalendarDropdown: Timeline updated: ${timeline.length} calendars`);

				calendars = timeline.map(getCalendarEventMetadata);
				loading = false;
			},
			error: (/** @type {any} */ err) => {
				console.error('📅 CalendarDropdown: Timeline error:', err);
				error = 'Failed to load calendars';
				loading = false;
			}
		});
	}

	/**
	 * @param {string} calendarId
	 */
	function handleCalendarSelect(calendarId) {
		let calendar = null;
		console.log("emptying calendar after select")
		cEvents.events = []

		if (calendarId === '' || (manager.active && calendarId === manager.active.pubkey)) {
			// Global calendar or "My Events" - no specific calendar object
			calendar = null;
		} else {
			// Find the specific calendar by ID
			calendar = calendars.find((cal) => cal.id === calendarId) || null;
		}

		calendarStore.setSelectedCalendar(calendar);

		console.log('📅 CalendarDropdown: Calendar selected:', calendar?.id || calendarId, calendar);
	}

	function handleCreateCalendar() {
		modalStore.openModal('createCalendar');
	}

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

					{#if activeUser}
						<hr class="my-1 border-base-300" />

						<li>
							<a
								href="#"
								class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-200"
								class:active={selectedCalendarId === manager.active?.pubkey}
								onclick={(e) => {
									e.preventDefault();
									if (manager.active) {
										handleCalendarSelect(manager.active.pubkey);
									}
								}}
							>
								<UserIcon class_="h-4 w-4 text-primary" />
								<div class="min-w-0 flex-1">
									<div class="text-sm font-medium">My Events</div>
									<div class="text-xs text-base-content/60">Events I created</div>
								</div>
								{#if selectedCalendarId === manager.active?.pubkey}
									<CheckIcon class_="h-4 w-4 text-primary" />
								{/if}
							</a>
						</li>
					{/if}

					{#if activeUser}
						<hr class="my-1 border-base-300" />

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
										<CalendarIcon class_="h-4 w-4 text-primary" />
										<div class="min-w-0 flex-1">
											<div class="truncate text-sm font-medium">{calendar.title}</div>
											{#if calendar.summary}
												<div class="truncate text-xs text-base-content/60">
													{calendar.summary}
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
									<span class="loading loading-sm loading-spinner"></span>
									<p class="mt-2 text-sm">Loading calendars...</p>
								</div>
							</li>
						{/if}

						<hr class="my-1 border-base-300" />

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
							<hr class="my-1 border-base-300" />
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
