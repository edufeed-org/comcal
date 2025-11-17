<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { calendarLoader } from '$lib/loaders';
	import { calendarStore } from '$lib/stores/calendar-events.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import { useJoinedCommunitiesList } from '$lib/stores/joined-communities-list.svelte';
	import { useUserProfile } from '$lib/stores/user-profile.svelte';
	import CalendarCreationModal from './CalendarCreationModal.svelte';
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
	import PeopleIcon from '$lib/components/icons/social/People.svelte';
	import ChevronDownIcon from '$lib/components/icons/ui/ChevronDownIcon.svelte';
	import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';
	import { TimelineModel } from 'applesauce-core/models';
	import { encodeEventToNaddr, hexToNpub } from '$lib/helpers/nostrUtils';
	import { getTagValue, getDisplayName, getProfilePicture } from 'applesauce-core/helpers';
	import { nip19 } from 'nostr-tools';
	import * as m from '$paraglide/messages';

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
	let personalCalendars = $state(/** @type {CalendarEvent[]} */ ([]));
	
	// Load joined communities
	const getJoinedCommunities = useJoinedCommunitiesList();
	let joinedCommunities = $derived(getJoinedCommunities());
	
	// Check if we're on the global calendar route (synchronous with navigation)
	let isOnGlobalRoute = $derived($page.url.pathname === '/calendar');

	// Calendar modal state
	let isCalendarModalOpen = $state(false);

	// subs
	let calendarSubscription = $state();

	let displayName = $derived.by(() => {
		// If viewing a specific calendar (via currentCalendar prop), show its name
		if (currentCalendar) {
			// Check if it's the user's own calendar
			if (manager.active && currentCalendar.pubkey === manager.active.pubkey) {
				return currentCalendar.title || m.calendar_dropdown_my_calendar();
			}
			// External calendar
			return currentCalendar.title || m.calendar_dropdown_external_calendar();
		}

		// Check if we're on the "My Events" route
		if (manager.active && $page.url.pathname.startsWith('/calendar/author/') &&
		    $page.url.pathname.includes(nip19.npubEncode(manager.active.pubkey))) {
			return m.calendar_dropdown_my_events();
		}

		// Not logged in
		if (!activeUser) {
			return m.calendar_dropdown_login_title();
		}

		// No calendar selected - show global
		if (!selectedCalendar) {
			return m.calendar_dropdown_global_calendar();
		}

		// "My Events" filter selected (legacy)
		if (manager.active && selectedCalendarId === manager.active.pubkey) {
			return m.calendar_dropdown_my_events();
		}

		// Personal calendar selected - show its title
		const cal = selectedCalendar;
		return cal ? cal.title : m.calendar_dropdown_select();
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
		isCalendarModalOpen = true;
	}

	function handleCalendarModalClose() {
		isCalendarModalOpen = false;
	}

	function handleCalendarCreated() {
		// Refresh calendar list after creation
		loadUserCalendars();
	}

	async function handleRefresh() {
		loadUserCalendars();
	}
</script>

<!-- Show dropdown only when logged in, otherwise show static title -->
<div class="flex-none">
	<ul class="menu menu-horizontal px-0 md:px-1">
		<li>
			{#if activeUser}
				<!-- Logged in: Show interactive dropdown using Popover API -->
				<button 
					class="btn btn-sm md:btn-md gap-1 md:gap-2 px-2 md:px-4 py-1 md:py-2 text-sm md:text-xl font-semibold text-base-content btn-ghost"
					popovertarget="calendar-popover"
					style="anchor-name:--calendar-anchor"
				>
					<!-- Calendar Icon -->
					<CalendarIcon class_="h-4 w-4 md:h-5 md:w-5" />
					<span class="leading-tight">{displayName}</span>
					<ChevronDownIcon class_="h-4 w-4 md:h-5 md:w-5" />
				</button>

				<ul
					id="calendar-popover"
					popover="auto"
					style="position-anchor:--calendar-anchor"
					class="dropdown menu z-[1] w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] md:max-h-[80vh] overflow-y-auto rounded-box border border-base-300 bg-base-100 p-2 shadow-lg scroll-smooth"
				>
					<!-- Global Calendar Option (always available) -->
					<li>
						<button
							type="button"
							class="flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 md:py-2 transition-colors hover:bg-base-200 min-h-[44px] w-full text-left"
							class:active={!selectedCalendarId && isOnGlobalRoute}
							onclick={() => {
								handleCalendarSelect('');
								goto('/calendar');
							}}
						>
							<GlobeIcon class_="h-4 w-4 text-primary flex-shrink-0" />
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium">{m.calendar_dropdown_global_calendar()}</div>
								<div class="hidden sm:block text-xs text-base-content/60">{m.calendar_dropdown_global_calendar_desc()}</div>
							</div>
							{#if !selectedCalendarId && isOnGlobalRoute}
								<CheckIcon class_="h-4 w-4 text-primary" />
							{/if}
						</button>
					</li>

					{#if activeUser}
						<hr class="my-1 border-base-300" />

						<li>
							<a
								href={manager.active ? `/calendar/author/${nip19.npubEncode(manager.active.pubkey)}` : '#'}
								class="flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 md:py-2 transition-colors hover:bg-base-200 min-h-[44px]"
								class:active={$page.url.pathname.startsWith('/calendar/author/') && manager.active && $page.url.pathname.includes(nip19.npubEncode(manager.active.pubkey))}
								onclick={(e) => {
									if (manager.active) {
										const npub = nip19.npubEncode(manager.active.pubkey);
										goto(`/calendar/author/${npub}`);
									}
								}}
							>
							<UserIcon class_="h-4 w-4 text-primary flex-shrink-0" />
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium">{m.calendar_dropdown_my_events()}</div>
								<div class="hidden sm:block text-xs text-base-content/60">{m.calendar_dropdown_my_events_desc()}</div>
							</div>
								{#if $page.url.pathname.startsWith('/calendar/author/') && manager.active && $page.url.pathname.includes(nip19.npubEncode(manager.active.pubkey))}
									<CheckIcon class_="h-4 w-4 text-primary" />
								{/if}
							</a>
						</li>

						<!-- My Communities Section -->
						{#if joinedCommunities.length > 0}
							<hr class="my-1 border-base-300" />
							
							{#each joinedCommunities as community (getTagValue(community, 'd'))}
								{@const communityPubkey = getTagValue(community, 'd')}
								{#if communityPubkey}
									{@const getCommunityProfile = useUserProfile(communityPubkey)}
									{@const communityProfile = getCommunityProfile()}
									{@const communityNpub = hexToNpub(communityPubkey)}
									<li>
										<a
											href={communityNpub ? `/c/${communityNpub}?view=calendar` : '#'}
											class="flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 md:py-2 transition-colors hover:bg-base-200 min-h-[44px]"
											onclick={(e) => {
												e.preventDefault();
												if (communityNpub) {
													goto(`/c/${communityNpub}?view=calendar`);
												}
											}}
										>
											<PeopleIcon class_="h-4 w-4 text-primary flex-shrink-0" />
											<div class="avatar">
												<div class="w-5 h-5 rounded-full ring-1 ring-base-300">
													<img 
														src={getProfilePicture(communityProfile) || `https://robohash.org/${communityPubkey}`} 
														alt={getDisplayName(communityProfile)} 
														class="rounded-full object-cover" 
													/>
												</div>
											</div>
											<div class="min-w-0 flex-1">
												<div class="truncate text-sm font-medium">
													{getDisplayName(communityProfile)}
												</div>
											</div>
										</a>
									</li>
								{/if}
							{/each}
						{/if}
					{/if}

					{#if activeUser}
						<hr class="my-1 border-base-300" />

						{#if personalCalendars.length > 0}
							{#each personalCalendars as calendar (calendar.id)}
								<li>
									<a
										href={`/calendar/${encodeEventToNaddr(calendar.originalEvent)}`}
										class="flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 md:py-2 transition-colors hover:bg-base-200 min-h-[44px]"
										class:active={currentCalendar?.id === calendar.id}
										onclick={(e) => {
											e.preventDefault();
											handleCalendarSelect(calendar.id);
											goto(`/calendar/${encodeEventToNaddr(calendar.originalEvent)}`);
										}}
									>
									<CalendarIcon class_="h-4 w-4 text-primary flex-shrink-0" />
									<div class="min-w-0 flex-1">
										<div class="truncate text-sm font-medium">{calendar.title}</div>
										{#if calendar.summary}
											<div class="hidden sm:block truncate text-xs text-base-content/60">
												{calendar.summary}
											</div>
										{/if}
									</div>
										{#if currentCalendar?.id === calendar.id}
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
									<p class="text-sm">{m.calendar_dropdown_no_calendars()}</p>
									<p class="mt-1 text-xs">{m.calendar_dropdown_create_first()}</p>
								</div>
							</li>
						{/if}

						<!-- Loading state -->
						{#if loading}
							<li>
								<div class="px-3 py-4 text-center text-base-content/60">
									<span class="loading loading-sm loading-spinner"></span>
									<p class="mt-2 text-sm">{m.calendar_dropdown_loading()}</p>
								</div>
							</li>
						{/if}

						<hr class="my-1 border-base-300" />

						<!-- Create New Calendar -->
						<li>
							<button
								type="button"
								class="flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 md:py-2 text-primary transition-colors hover:bg-base-200 min-h-[44px] w-full text-left"
								onclick={handleCreateCalendar}
							>
								<PlusIcon class_="h-4 w-4 flex-shrink-0" />
								<span class="font-medium">{m.calendar_dropdown_create_new()}</span>
							</button>
						</li>

						<!-- Manage Calendars -->
						<li>
							<a
								href="/calendar/manage"
								class="flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 md:py-2 transition-colors hover:bg-base-200 min-h-[44px]"
							>
								<SettingsIcon class_="h-4 w-4 flex-shrink-0" />
								<span class="font-medium">{m.calendar_management_title()}</span>
							</a>
						</li>

						<!-- Refresh Button -->
						{#if calendars.length > 0}
							<hr class="my-1 border-base-300" />
							<li>
								<button
									type="button"
									class="flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 md:py-2 transition-colors hover:bg-base-200 min-h-[44px] w-full text-left"
									class:opacity-50={loading}
									class:pointer-events-none={loading}
									disabled={loading}
									onclick={handleRefresh}
								>
									<RefreshIcon class_={`h-4 w-4 flex-shrink-0 ${loading ? 'animate-spin' : ''}`} />
									<span class="text-sm">{m.calendar_dropdown_refresh()}</span>
								</button>
							</li>
						{/if}
					{:else}
						<!-- Not logged in message -->
						<li><hr class="my-1 border-base-300" /></li>
						<li>
							<div class="px-3 py-4 text-center text-base-content/60">
								<LockIcon class_="mx-auto mb-2 h-8 w-8 opacity-50" />
								<p class="text-sm">{m.calendar_dropdown_login_title()}</p>
								<p class="mt-1 text-xs">{m.calendar_dropdown_login_desc()}</p>
							</div>
						</li>
					{/if}
					</ul>
			{:else}
				<!-- Not logged in: Show static title (no dropdown) -->
				<div class="flex items-start gap-1 md:gap-2 px-2 md:px-4 py-1 md:py-2 text-sm md:text-xl font-semibold text-base-content max-w-[250px] sm:max-w-none">
					<CalendarIcon class_="h-4 w-4 md:h-5 md:w-5 flex-shrink-0 mt-0.5 md:mt-0" />
					<span class="leading-tight">{displayName}</span>
				</div>
			{/if}
		</li>
	</ul>
</div>

<!-- Calendar Creation Modal -->
<CalendarCreationModal
	isOpen={isCalendarModalOpen}
	onClose={handleCalendarModalClose}
	onCalendarCreated={handleCalendarCreated}
/>
