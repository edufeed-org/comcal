<!--
  FollowListSelector Component
  Allows users to filter calendar events by their follow lists (NIP-02 and NIP-51)
-->

<script>
	import { calendarStore } from '$lib/stores/calendar-events.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import { loadFollowList, loadFollowSets } from '$lib/helpers/followListLoader.js';
	import { FilterIcon, CloseIcon, UserIcon } from '../icons';
	import { onMount } from 'svelte';

	// Props
	let { onApplyFilters = () => {} } = $props();

	// Local state
	let isExpanded = $state(false);
	let selectedListIds = $state(/** @type {string[]} */ ([]));
	let isLoadingNip02 = $state(false);
	let isLoadingNip51 = $state(false);
	let loadErrorNip02 = $state(/** @type {string | null} */ (null));
	let loadErrorNip51 = $state(/** @type {string | null} */ (null));
	let activeUser = $state(manager.active);
	let userSubscription = $state();

	// Get reactive reference to follow lists from store
	let followLists = $derived(calendarStore.followLists);
	let isLoggedIn = $derived(!!activeUser);

	/**
	 * Load follow lists for the logged-in user (both NIP-02 and NIP-51)
	 */
	async function loadUserFollowLists() {
		if (!manager.active) {
			console.log('👥 FollowListSelector: No active user, skipping follow list load');
			return;
		}

		const userPubkey = manager.active.pubkey;
		console.log('👥 FollowListSelector: Loading follow lists for user:', userPubkey);

		// Load NIP-02 and NIP-51 in parallel with separate loading states
		const loadNip02 = async () => {
			isLoadingNip02 = true;
			loadErrorNip02 = null;
			try {
				const followList = await loadFollowList(userPubkey);
				return followList ? [followList] : [];
			} catch (error) {
				console.error('👥 FollowListSelector: Error loading NIP-02 follow list:', error);
				loadErrorNip02 = 'Failed to load follow list';
				return [];
			} finally {
				isLoadingNip02 = false;
			}
		};

		const loadNip51 = async () => {
			isLoadingNip51 = true;
			loadErrorNip51 = null;
			try {
				const followSets = await loadFollowSets(userPubkey);
				return followSets;
			} catch (error) {
				console.error('👥 FollowListSelector: Error loading NIP-51 follow sets:', error);
				loadErrorNip51 = 'Failed to load follow sets';
				return [];
			} finally {
				isLoadingNip51 = false;
			}
		};

		// Load both in parallel
		const [nip02Lists, nip51Lists] = await Promise.all([loadNip02(), loadNip51()]);

		// Combine all lists
		const allLists = [...nip02Lists, ...nip51Lists];
		console.log(
			`👥 FollowListSelector: Loaded ${nip02Lists.length} NIP-02 lists and ${nip51Lists.length} NIP-51 sets`
		);
		calendarStore.setFollowLists(allLists);
	}

	/**
	 * Toggle follow list selection
	 * @param {string} listId
	 */
	function toggleFollowList(listId) {
		if (selectedListIds.includes(listId)) {
			selectedListIds = selectedListIds.filter((id) => id !== listId);
		} else {
			selectedListIds = [...selectedListIds, listId];
		}
	}

	/**
	 * Apply follow list filters
	 */
	function applyFilters() {
		console.log('👥 FollowListSelector: Applying follow list filters:', selectedListIds);
		calendarStore.setSelectedFollowListIds(selectedListIds);
		onApplyFilters(selectedListIds);
	}

	/**
	 * Clear all filters
	 */
	function clearFilters() {
		console.log('👥 FollowListSelector: Clearing follow list filters');
		selectedListIds = [];
		calendarStore.clearSelectedFollowListIds();
		onApplyFilters([]);
	}

	/**
	 * Toggle expanded state
	 */
	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	// Derived state
	let hasActiveFilters = $derived(selectedListIds.length > 0);
	let totalAuthors = $derived(
		followLists
			.filter((list) => selectedListIds.includes(list.id))
			.reduce((sum, list) => sum + list.count, 0)
	);
	let isLoading = $derived(isLoadingNip02 || isLoadingNip51);
	let hasLoadError = $derived(!!loadErrorNip02 || !!loadErrorNip51);

	// Subscribe to user changes and load follow lists on mount
	onMount(() => {
		// Subscribe to manager.active$ observable to track login/logout
		userSubscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});

		// Load follow lists if user is already logged in
		if (manager.active) {
			loadUserFollowLists();
		}

		// Cleanup subscription on unmount
		return () => {
			userSubscription?.unsubscribe();
		};
	});

	// Watch for user login/logout changes
	$effect(() => {
		if (activeUser) {
			// User logged in, load their follow lists
			loadUserFollowLists();
		} else {
			// User logged out, clear follow lists
			calendarStore.clearFollowLists();
			selectedListIds = [];
		}
	});
</script>

<div class="border-b border-base-300 bg-base-100">
	<!-- Header - Always visible -->
	<button
		class="flex w-full items-center justify-between px-6 py-3 text-left transition-colors hover:bg-base-200"
		onclick={toggleExpanded}
		aria-expanded={isExpanded}
		disabled={!isLoggedIn}
	>
		<div class="flex items-center gap-3">
			<UserIcon class_="h-5 w-5 text-base-content/70" />
			<span class="font-medium text-base-content">Filter by Follow Lists</span>
			{#if hasActiveFilters}
				<span class="badge badge-primary badge-sm">{totalAuthors} authors</span>
			{/if}
			{#if !isLoggedIn}
				<span class="badge badge-ghost badge-sm">Login Required</span>
			{/if}
		</div>
		<svg
			class="h-5 w-5 text-base-content/50 transition-transform"
			class:rotate-180={isExpanded}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	<!-- Expandable content -->
	{#if isExpanded}
		<div class="border-t border-base-300 bg-base-50 px-6 py-4">
			{#if !isLoggedIn}
				<!-- Not logged in state -->
				<div class="py-4 text-center">
					<p class="mb-2 text-sm text-base-content/60">
						Log in to filter events by people you follow
					</p>
				</div>
			{:else if isLoading}
				<!-- Loading state -->
				<div class="space-y-2 py-4">
					{#if isLoadingNip02}
						<div class="flex items-center gap-3">
							<div class="loading loading-sm loading-spinner"></div>
							<span class="text-sm text-base-content/60">Loading follow list (NIP-02)...</span>
						</div>
					{/if}
					{#if isLoadingNip51}
						<div class="flex items-center gap-3">
							<div class="loading loading-sm loading-spinner"></div>
							<span class="text-sm text-base-content/60">Loading follow sets (NIP-51)...</span>
						</div>
					{/if}
				</div>
			{:else if hasLoadError}
				<!-- Error state -->
				<div class="space-y-2">
					{#if loadErrorNip02}
						<div class="alert alert-warning">
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
								/>
							</svg>
							<span class="text-sm">NIP-02: {loadErrorNip02}</span>
						</div>
					{/if}
					{#if loadErrorNip51}
						<div class="alert alert-warning">
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
								/>
							</svg>
							<span class="text-sm">NIP-51: {loadErrorNip51}</span>
						</div>
					{/if}
					<button class="btn btn-ghost btn-xs" onclick={loadUserFollowLists}>Retry</button>
				</div>
			{:else if followLists.length === 0}
				<!-- Empty state -->
				<div class="py-4 text-center">
					<p class="mb-2 text-sm text-base-content/60">
						No follow lists found. Create a follow list on Nostr to use this feature.
					</p>
				</div>
			{:else}
				<!-- Follow lists section -->
				<div class="mb-4">
					<h4 class="mb-2 text-sm font-medium text-base-content/70">Your Follow Lists</h4>
					<div class="space-y-2">
						{#each followLists as list}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-base-200"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-sm checkbox-primary"
									checked={selectedListIds.includes(list.id)}
									onchange={() => toggleFollowList(list.id)}
								/>
								<div class="flex flex-1 items-center justify-between">
									<div class="flex items-center gap-2">
										<UserIcon class_="h-4 w-4 text-base-content/50" />
										<div class="flex flex-col">
											<div class="flex items-center gap-2">
												<span class="text-sm text-base-content">{list.name}</span>
												<span class="badge badge-xs {list.type === 'nip02' ? 'badge-primary' : 'badge-secondary'}">
													{list.type === 'nip02' ? 'Main' : 'Set'}
												</span>
											</div>
											{#if list.description}
												<span class="text-xs text-base-content/50">{list.description}</span>
											{/if}
										</div>
									</div>
									<span class="text-xs text-base-content/50">{list.count} authors</span>
								</div>
							</label>
						{/each}
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-2">
					<button
						class="btn btn-primary btn-sm flex-1"
						onclick={applyFilters}
						disabled={selectedListIds.length === 0}
					>
						Apply Filters
						{#if selectedListIds.length > 0}
							<span class="badge badge-sm">({totalAuthors} authors)</span>
						{/if}
					</button>
					<button
						class="btn btn-ghost btn-sm"
						onclick={clearFilters}
						disabled={!hasActiveFilters}
					>
						Clear
					</button>
				</div>

				<!-- Info text -->
				{#if hasActiveFilters}
					<p class="mt-3 text-xs text-base-content/60">
						Showing events only from {totalAuthors}
						{totalAuthors === 1 ? 'author' : 'authors'} in selected follow
						{selectedListIds.length === 1 ? 'list' : 'lists'}
					</p>
				{:else}
					<p class="mt-3 text-xs text-base-content/60">
						Select follow lists to filter events by their authors
					</p>
				{/if}
			{/if}
		</div>
	{/if}
</div>
