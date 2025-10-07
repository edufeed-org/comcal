<script>
	import { onMount } from 'svelte';
	import { eventStore } from '$lib/store.svelte';
	import { calendarLoader } from '$lib/loaders';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { calendarStore } from '$lib/stores/calendar-events.svelte.js';
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
	import { encodeEventToNaddr } from '$lib/helpers/nostrUtils';

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

	// Props
	let { currentCalendar = null } = $props();

	let calendars = $state(/** @type {CalendarEvent[]} */ ([]));
	let loading = $state(false);
	let error = $state(/** @type {string | null} */ (null));
	let activeUser = $state(manager.active);
	let selectedCalendar = $state(calendarStore.selectedCalendar);
	let selectedCalendarId = $derived(selectedCalendar?.id || '');
	let personalCalendars = $state([])

	// subs
	let calendarSubscription = $state();

	// Auto-select calendar when personal calendars load and currentCalendar matches
	$effect(() => {
		if (currentCalendar && personalCalendars.length > 0 && manager.active) {
			// Check if current calendar is one of the user's personal calendars
			const matchingCalendar = personalCalendars.find(cal => cal.id === currentCalendar.id);
			if (matchingCalendar && selectedCalendarId !== matchingCalendar.id) {
				console.log('📅 CalendarDropdown: Auto-selecting matching calendar:', matchingCalendar.title);
				calendarStore.setSelectedCalendar(matchingCalendar);
			}
		}
	});

	let displayName = $derived.by(() => {
		// If viewing a specific calendar (via currentCalendar prop), show its name
		if (currentCalendar) {
			// Check if it's the user's own calendar
			if (manager.active && currentCalendar.pubkey === manager.active.pubkey) {
				return currentCalendar.title || 'My Calendar';
			}
			// External calendar
			return currentCalendar.title || 'Calendar';
		}

		// Not logged in
		if (!activeUser) {
			return 'Log in to manage your calendars';
		}

		// No calendar selected - show global
		if (!selectedCalendar) {
			return 'Global Calendar';
		}

		// "My Events" filter selected
		if (manager.active && selectedCalendarId === manager.active.pubkey) {
			return 'My Events';
		}

		// Personal calendar selected - show its title
		const cal = selectedCalendar;
		return cal ? cal.title : 'Select Calendar';
	});

	onMount(() => {
		calendarLoader().subscribe();
		loadUserCalendars();

		calendarSubscription = calendarStore.selectedCalendar$.subscribe((calendar) => {
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

		const filter = { kinds: [31924], authors: [manager.active.pubkey], limit: 1 };

		eventStore.model(TimelineModel, filter).subscribe((events) => {
			personalCalendars = events.map(getCalendarEventMetadata)
		});

		loading = false;
	}

	/**
	 * @param {string} calendarId
	 */
	function handleCalendarSelect(calendarId) {
		let calendar = null;
		if (calendarId === '' || (manager.active && calendarId === manager.active.pubkey)) {
			calendar = null;
		} else {
			calendar = personalCalendars.find((cal) => cal.id === calendarId) || null;
		}
		calendarStore.setSelectedCalendar(calendar);
	}

	function handleCreateCalendar() {
		modalStore.openModal('createCalendar');
	}

	async function handleRefresh() {
		loadUserCalendars();
	}
</script>

<!-- Show dropdown only when logged in, otherwise show static title -->
<div class="flex-none">
	<ul class="menu menu-horizontal px-1">
		<li>
			{#if activeUser}
				<!-- Logged in: Show interactive dropdown -->
				<details class="dropdown">
					<summary class="btn gap-2 text-xl font-semibold text-base-content btn-ghost">
						<!-- Calendar Icon -->
						<CalendarIcon class_="h-5 w-5" />
						{displayName}
					</summary>
				<ul
					class="dropdown-content menu z-[1] rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
				>
					<!-- Global Calendar Option (always available) -->
					<li>
						<a
							href="/calendar"
							class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-200"
							class:active={!selectedCalendarId && !currentCalendar}
							onclick={(e) => {
								handleCalendarSelect('');
							}}
						>
							<GlobeIcon class_="h-4 w-4 text-primary" />
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium">Global Calendar</div>
								<div class="text-xs text-base-content/60">All community events</div>
							</div>
							{#if !selectedCalendarId && !currentCalendar}
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

						{#if personalCalendars.length > 0}
							{#each personalCalendars as calendar (calendar.id)}
								<li>
									<a
										href={`/calendar/${encodeEventToNaddr(calendar.originalEvent)}`}
										class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-200"
										class:active={selectedCalendarId === calendar.id}
										onclick={(e) => {
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
			{:else}
				<!-- Not logged in: Show static title (no dropdown) -->
				<div class="flex gap-2 px-4 py-2 text-xl font-semibold text-base-content">
					<CalendarIcon class_="h-5 w-5" />
					<span>{displayName}</span>
				</div>
			{/if}
		</li>
	</ul>
</div>
