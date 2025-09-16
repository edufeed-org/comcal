<script>
	import { useCalendarManagement } from '$lib/stores/calendar-management-store.svelte.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';

	/**
	 * @typedef {Object} Props
	 * @property {string} [selectedCalendarId] - Currently selected calendar ID
	 * @property {(calendarId: string) => void} [onCalendarSelect] - Callback when calendar is selected
	 */

	let { selectedCalendarId = $bindable(''), onCalendarSelect = () => {} } = $props();

	// Create local reactive state for active user to follow store patterns
	let activeUser = $state(manager.active);

	// Subscribe to manager.active$ for reactive updates (following store patterns)
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

	// Reactive calendar management store that updates when login state changes
	let calendarManagement = $derived(
		activeUser ? useCalendarManagement(activeUser.pubkey) : null
	);

	// Reactive state for selected calendar
	let selectedCalendar = $derived.by(() => {
		if (!calendarManagement || !selectedCalendarId) return null;
		return calendarManagement.calendars.find((cal) => cal.id === selectedCalendarId) || null;
	});

	// Reactive display name that handles all states properly
	let displayName = $derived.by(() => {
		// Not logged in
		if (!activeUser) {
			return 'Log in to manage your calendars';
		}

		// Logged in but no calendar management (shouldn't happen but safety check)
		if (!calendarManagement) {
			return 'Select Calendar';
		}

		// No calendar selected - show Global Calendar
		if (!selectedCalendarId) {
			return 'Global Calendar';
		}

		// My Events selected
		if (selectedCalendarId === activeUser.pubkey) {
			return 'My Events';
		}

		// Calendar selected - show its title
		const cal = calendarManagement.calendars.find(cal => cal.id === selectedCalendarId);
		return cal ? cal.title : 'Select Calendar';
	});

	/**
	 * Handle calendar selection
	 * @param {string} calendarId
	 */
	function handleCalendarSelect(calendarId) {
		onCalendarSelect(calendarId);
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
		if (calendarManagement) {
			await calendarManagement.refresh();
		}
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
								class:active={selectedCalendarId === activeUser.pubkey}
								onclick={(e) => {
									e.preventDefault();
									handleCalendarSelect(activeUser.pubkey);
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
					{#if activeUser && calendarManagement}
						<!-- Divider -->
						<li><hr class="my-1 border-base-300" /></li>

						<!-- Calendar List -->
						{#if calendarManagement.calendars.length > 0}
							{#each calendarManagement.calendars as calendar (calendar.id)}
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
						{:else}
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

						<!-- Refresh Button -->
						{#if calendarManagement.calendars.length > 0}
							<li><hr class="my-1 border-base-300" /></li>
							<li>
								<a
									href="#"
									class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-200"
									class:opacity-50={calendarManagement.loading}
									class:pointer-events-none={calendarManagement.loading}
									onclick={(e) => {
										e.preventDefault();
										if (!calendarManagement.loading) {
											handleRefresh();
										}
									}}
								>
									<svg
										class="h-4 w-4"
										class:animate-spin={calendarManagement.loading}
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
