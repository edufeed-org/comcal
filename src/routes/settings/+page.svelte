<script>
	import { fade } from 'svelte/transition';
	import { manager } from '$lib/stores/accounts.svelte.js';
	import { eventStore, pool } from '$lib/stores/nostr-infrastructure.svelte.js';
	import { runtimeConfig } from '$lib/stores/config.svelte.js';
	import { getRelayListLookupRelays } from '$lib/services/relay-service.svelte.js';
	import { saveRelayList, validateRelayUrl, parseRelayListEvent } from '$lib/services/relay-settings-service.js';
	import { createRelayListLoader } from '$lib/loaders/relay-list-loader.js';
	import { createBlossomServerLoader } from '$lib/loaders/blossom-server-loader.js';
	import {
		saveBlossomServers,
		validateBlossomUrl,
		parseBlossomServerEvent,
		getDefaultBlossomServers
	} from '$lib/services/blossom-settings-service.js';
	import {
		CATEGORIES,
		getRelaySetDTag,
		getDefaultRelaysForCategory,
		parseRelaySetEvent,
		updateUserOverrideCache
	} from '$lib/services/app-relay-service.js';
	import { createAppRelaySetLoader } from '$lib/loaders/app-relay-set-loader.js';
	import { publishEvent } from '$lib/services/publish-service.js';
	import { appSettings } from '$lib/stores/app-settings.svelte.js';
	import * as m from '$lib/paraglide/messages';

	// Use $state + $effect for reactive RxJS subscription bridge (Svelte 5 pattern)
	let activeAccount = $state(/** @type {any} */ (null));

	$effect(() => {
		const subscription = manager.active$.subscribe((account) => {
			activeAccount = account;
		});
		return () => subscription.unsubscribe();
	});

	// State
	let loading = $state(true);
	let saving = $state(false);
	let hasRelayList = $state(false);
	/** @type {Array<{url: string, read: boolean, write: boolean}>} */
	let relays = $state([]);
	let newRelayUrl = $state('');
	let newRelayRead = $state(true);
	let newRelayWrite = $state(true);
	/** @type {string|null} */
	let error = $state(null);
	/** @type {string|null} */
	let success = $state(null);
	/** @type {string|null} */
	let validationError = $state(null);
	let hasChanges = $state(false);

	// Blossom state
	let blossomLoading = $state(true);
	let blossomSaving = $state(false);
	let hasBlossomList = $state(false);
	/** @type {Array<{url: string}>} */
	let blossomServers = $state([]);
	let newBlossomUrl = $state('');
	/** @type {string|null} */
	let blossomError = $state(null);
	/** @type {string|null} */
	let blossomSuccess = $state(null);
	/** @type {string|null} */
	let blossomValidationError = $state(null);
	let hasBlossomChanges = $state(false);

	// App Relay state
	let appRelaysLoading = $state(true);
	let appRelaysSaving = $state(false);
	/** @type {Map<string, string[]>} */
	let appRelayOverrides = $state(new Map());
	/** @type {string|null} */
	let appRelaysError = $state(null);
	/** @type {string|null} */
	let appRelaysSuccess = $state(null);
	/** @type {string|null} */
	let newAppRelayUrl = $state('');
	/** @type {string|null} */
	let editingCategory = $state(null);
	/** @type {string|null} */
	let appRelayValidationError = $state(null);

	// Load relay list on mount
	$effect(() => {
		if (!activeAccount?.pubkey) {
			loading = false;
			return;
		}

		loading = true;
		error = null;

		const lookupRelays = getRelayListLookupRelays();

		// Create loader for kind 10002
		const loader = createRelayListLoader(pool, lookupRelays, eventStore, activeAccount.pubkey);
		const loaderSub = loader()().subscribe();

		// Subscribe to the relay list from EventStore
		const subscription = eventStore.replaceable(10002, activeAccount.pubkey).subscribe((event) => {
			loading = false;
			if (event) {
				hasRelayList = true;
				relays = parseRelayListEvent(event);
			} else {
				hasRelayList = false;
				relays = [];
			}
		});

		// Timeout after 5 seconds
		const timeout = setTimeout(() => {
			loading = false;
		}, 5000);

		return () => {
			loaderSub?.unsubscribe();
			subscription?.unsubscribe();
			clearTimeout(timeout);
		};
	});

	// Load Blossom server list on mount
	$effect(() => {
		if (!activeAccount?.pubkey) {
			blossomLoading = false;
			return;
		}

		blossomLoading = true;
		blossomError = null;

		const lookupRelays = getRelayListLookupRelays();

		// Create loader for kind 10063
		const loader = createBlossomServerLoader(pool, lookupRelays, eventStore, activeAccount.pubkey);
		const loaderSub = loader()().subscribe();

		// Subscribe to the Blossom server list from EventStore
		const subscription = eventStore.replaceable(10063, activeAccount.pubkey).subscribe((event) => {
			blossomLoading = false;
			if (event) {
				hasBlossomList = true;
				blossomServers = parseBlossomServerEvent(event);
			} else {
				hasBlossomList = false;
				blossomServers = [];
			}
		});

		// Timeout after 5 seconds
		const timeout = setTimeout(() => {
			blossomLoading = false;
		}, 5000);

		return () => {
			loaderSub?.unsubscribe();
			subscription?.unsubscribe();
			clearTimeout(timeout);
		};
	});

	// Load App Relay Sets on mount
	$effect(() => {
		if (!activeAccount?.pubkey) {
			appRelaysLoading = false;
			return;
		}

		appRelaysLoading = true;
		appRelaysError = null;

		const lookupRelays = getRelayListLookupRelays();

		// Create loader for kind 30002 (app relay sets)
		const loader = createAppRelaySetLoader(pool, lookupRelays, eventStore, activeAccount.pubkey);
		const loaderSub = loader()().subscribe();

		// Subscribe to each category's relay set
		/** @type {import('rxjs').Subscription[]} */
		const subscriptions = [];

		// Batch updates to avoid triggering multiple reactive cycles
		// eventStore.replaceable() uses ReplaySubject which immediately emits cached values
		/** @type {Map<string, string[]>} */
		const pendingUpdates = new Map();
		let updateScheduled = false;

		function scheduleUpdate() {
			if (updateScheduled) return;
			updateScheduled = true;
			queueMicrotask(() => {
				updateScheduled = false;
				// Apply all pending updates at once
				if (pendingUpdates.size > 0) {
					const newMap = new Map(appRelayOverrides);
					pendingUpdates.forEach((relays, category) => {
						newMap.set(category, relays);
						updateUserOverrideCache(category, relays);
					});
					pendingUpdates.clear();
					appRelayOverrides = newMap;
				}
			});
		}

		for (const category of Object.keys(CATEGORIES)) {
			const dTag = getRelaySetDTag(category);
			const sub = eventStore.replaceable(30002, activeAccount.pubkey, dTag).subscribe((event) => {
				const relays = parseRelaySetEvent(event);
				pendingUpdates.set(category, relays);
				scheduleUpdate();
			});
			subscriptions.push(sub);
		}

		// Mark loading complete after a short delay
		const timeout = setTimeout(() => {
			appRelaysLoading = false;
		}, 3000);

		return () => {
			loaderSub?.unsubscribe();
			subscriptions.forEach((sub) => sub?.unsubscribe());
			clearTimeout(timeout);
		};
	});

	// Create default relay list
	function createDefaultRelayList() {
		const fallbackRelays = runtimeConfig.fallbackRelays || [];
		if (fallbackRelays.length === 0) {
			error = 'No default relays configured. Please add relays manually.';
			return;
		}
		relays = fallbackRelays.slice(0, 4).map((/** @type {string} */ url) => ({
			url,
			read: true,
			write: true
		}));
		hasChanges = true;
	}

	// Add a new relay
	function addRelay() {
		const validation = validateRelayUrl(newRelayUrl);
		if (!validation.valid) {
			validationError = validation.error || null;
			return;
		}

		// Check for duplicates
		const normalizedUrl = newRelayUrl.trim().replace(/\/$/, '');
		if (relays.some(r => r.url.replace(/\/$/, '') === normalizedUrl)) {
			validationError = 'This relay is already in your list';
			return;
		}

		relays = [...relays, {
			url: normalizedUrl,
			read: newRelayRead,
			write: newRelayWrite
		}];

		newRelayUrl = '';
		newRelayRead = true;
		newRelayWrite = true;
		validationError = null;
		hasChanges = true;
	}

	// Remove a relay
	function removeRelay(/** @type {number} */ index) {
		relays = relays.filter((_, i) => i !== index);
		hasChanges = true;
	}

	// Toggle read/write for a relay
	function toggleRead(/** @type {number} */ index) {
		relays[index].read = !relays[index].read;
		// Ensure at least one is selected
		if (!relays[index].read && !relays[index].write) {
			relays[index].write = true;
		}
		relays = [...relays]; // Trigger reactivity
		hasChanges = true;
	}

	function toggleWrite(/** @type {number} */ index) {
		relays[index].write = !relays[index].write;
		// Ensure at least one is selected
		if (!relays[index].read && !relays[index].write) {
			relays[index].read = true;
		}
		relays = [...relays]; // Trigger reactivity
		hasChanges = true;
	}

	// Save relay list
	async function handleSave() {
		if (relays.length === 0) {
			error = 'At least one relay is required';
			return;
		}

		saving = true;
		error = null;
		success = null;

		try {
			await saveRelayList(relays, activeAccount.pubkey);
			success = 'Relay preferences saved successfully!';
			hasChanges = false;
			hasRelayList = true;
			setTimeout(() => success = null, 3000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			saving = false;
		}
	}

	// Handle Enter key in input
	function handleKeyDown(/** @type {KeyboardEvent} */ event) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addRelay();
		}
	}

	// Create default Blossom server list
	function createDefaultBlossomList() {
		blossomServers = getDefaultBlossomServers().map((/** @type {string} */ url) => ({ url }));
		hasBlossomChanges = true;
	}

	// Add a new Blossom server
	function addBlossomServer() {
		const validation = validateBlossomUrl(newBlossomUrl);
		if (!validation.valid) {
			blossomValidationError = validation.error || null;
			return;
		}

		// Check for duplicates
		const normalizedUrl = newBlossomUrl.trim().replace(/\/$/, '');
		if (blossomServers.some(s => s.url.replace(/\/$/, '') === normalizedUrl)) {
			blossomValidationError = 'This server is already in your list';
			return;
		}

		blossomServers = [...blossomServers, { url: normalizedUrl }];

		newBlossomUrl = '';
		blossomValidationError = null;
		hasBlossomChanges = true;
	}

	// Remove a Blossom server
	function removeBlossomServer(/** @type {number} */ index) {
		blossomServers = blossomServers.filter((_, i) => i !== index);
		hasBlossomChanges = true;
	}

	// Save Blossom server list
	async function handleBlossomSave() {
		if (blossomServers.length === 0) {
			blossomError = 'At least one Blossom server is required';
			return;
		}

		blossomSaving = true;
		blossomError = null;
		blossomSuccess = null;

		try {
			await saveBlossomServers(blossomServers, activeAccount.pubkey);
			blossomSuccess = 'Blossom server list saved successfully!';
			hasBlossomChanges = false;
			hasBlossomList = true;
			setTimeout(() => blossomSuccess = null, 3000);
		} catch (err) {
			blossomError = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			blossomSaving = false;
		}
	}

	// Handle Enter key in Blossom input
	function handleBlossomKeyDown(/** @type {KeyboardEvent} */ event) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addBlossomServer();
		}
	}

	// App Relay functions

	/**
	 * Get current relays for a category (override or server default)
	 * @param {string} category
	 * @returns {string[]}
	 */
	function getRelaysForCategory(category) {
		const override = appRelayOverrides.get(category);
		if (override && override.length > 0) {
			return override;
		}
		return getDefaultRelaysForCategory(category);
	}

	/**
	 * Check if category has user override
	 * @param {string} category
	 * @returns {boolean}
	 */
	function hasOverride(category) {
		const override = appRelayOverrides.get(category);
		return override && override.length > 0;
	}

	/**
	 * Save server defaults as user's relay set
	 * @param {string} category
	 */
	async function saveServerDefaultsAsMyRelays(category) {
		const serverDefaults = getDefaultRelaysForCategory(category);
		if (serverDefaults.length > 0) {
			await saveAppRelaySet(category, serverDefaults);
		}
	}

	/**
	 * Save app relay set override
	 * @param {string} category
	 * @param {string[]} relays
	 */
	async function saveAppRelaySet(category, relays) {
		if (!activeAccount?.signer) {
			appRelaysError = 'No signer available';
			return;
		}

		appRelaysSaving = true;
		appRelaysError = null;

		try {
			const dTag = getRelaySetDTag(category);

			const event = {
				kind: 30002,
				created_at: Math.floor(Date.now() / 1000),
				tags: [['d', dTag], ...relays.map((r) => ['relay', r])],
				content: ''
			};

			const signedEvent = await activeAccount.signer.signEvent(event);
			await publishEvent(signedEvent, []);
			eventStore.add(signedEvent);

			// Update local state
			appRelayOverrides = new Map(appRelayOverrides.set(category, relays));
			updateUserOverrideCache(category, relays);

			appRelaysSuccess = `${CATEGORIES[category]?.label || category} relays saved!`;
			setTimeout(() => (appRelaysSuccess = null), 3000);
		} catch (err) {
			appRelaysError = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			appRelaysSaving = false;
			editingCategory = null;
		}
	}

	/**
	 * Reset category to use server defaults
	 * @param {string} category
	 */
	async function resetToDefault(category) {
		// Save empty relay set to clear override
		await saveAppRelaySet(category, []);
	}

	/**
	 * Add a relay to a category
	 * @param {string} category
	 */
	async function addAppRelay(category) {
		if (!newAppRelayUrl.trim()) {
			appRelayValidationError = 'Please enter a relay URL';
			return;
		}

		const validation = validateRelayUrl(newAppRelayUrl);
		if (!validation.valid) {
			appRelayValidationError = validation.error || null;
			return;
		}

		const normalizedUrl = newAppRelayUrl.trim().replace(/\/$/, '');
		const currentRelays = getRelaysForCategory(category);

		if (currentRelays.includes(normalizedUrl)) {
			appRelayValidationError = 'This relay is already in the list';
			return;
		}

		await saveAppRelaySet(category, [...currentRelays, normalizedUrl]);
		newAppRelayUrl = '';
		appRelayValidationError = null;
	}

	/**
	 * Remove a relay from a category
	 * @param {string} category
	 * @param {string} relayUrl
	 */
	async function removeAppRelay(category, relayUrl) {
		const currentRelays = getRelaysForCategory(category);
		const newRelays = currentRelays.filter((r) => r !== relayUrl);
		await saveAppRelaySet(category, newRelays);
	}

	/**
	 * Handle Enter key in app relay input
	 * @param {KeyboardEvent} event
	 * @param {string} category
	 */
	function handleAppRelayKeyDown(event, category) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addAppRelay(category);
		}
	}
</script>

<svelte:head>
	<title>{m.common_settings()} - {runtimeConfig.appName}</title>
</svelte:head>

<div class="min-h-screen py-8 px-4">
	<div class="max-w-2xl mx-auto">
		<!-- Header -->
		<div class="text-center mb-8">
			<h1 class="text-4xl font-bold mb-2">{m.common_settings()}</h1>
			<p class="text-base-content/70">Manage your Nostr preferences</p>
		</div>

		{#if !activeAccount}
			<div class="alert alert-warning shadow-lg">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
				</svg>
				<span>Please login to manage your settings.</span>
			</div>
		{:else if loading}
			<div class="flex justify-center py-12">
				<div class="text-center">
					<span class="loading loading-spinner loading-lg"></span>
					<p class="mt-4 text-base-content/70">Loading relay preferences...</p>
				</div>
			</div>
		{:else}
			<!-- Relay Preferences Card -->
			<div class="card bg-base-200 shadow-xl" transition:fade={{ duration: 200 }}>
				<div class="card-body">
					<h2 class="card-title text-2xl mb-2">
						<span class="text-2xl">Relay Preferences</span>
					</h2>
					<p class="text-base-content/70 mb-6">
						Your relays determine where your events are published and where others can find them.
						<strong>Read</strong> relays are where you receive mentions; <strong>Write</strong> relays are where you publish.
					</p>

					{#if relays.length === 0}
						<!-- No relay list state -->
						<div class="alert alert-info mb-6">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
							<div>
								<p class="font-semibold">No relay list found</p>
								<p class="text-sm">You don't have a relay list yet. Create one to improve discoverability.</p>
							</div>
						</div>
						<button class="btn btn-primary" onclick={createDefaultRelayList}>
							Create Relay List with Defaults
						</button>
					{:else}
						<!-- Relay list -->
						<div class="space-y-3 mb-6">
							{#each relays as relay, index (relay.url)}
								<div class="flex items-center gap-3 p-3 bg-base-100 rounded-lg" transition:fade={{ duration: 150 }}>
									<div class="flex-1 font-mono text-sm truncate" title={relay.url}>
										{relay.url}
									</div>
									<div class="flex items-center gap-2">
										<label class="label cursor-pointer gap-1">
											<span class="label-text text-xs">R</span>
											<input
												type="checkbox"
												class="checkbox checkbox-sm checkbox-primary"
												checked={relay.read}
												onchange={() => toggleRead(index)}
											/>
										</label>
										<label class="label cursor-pointer gap-1">
											<span class="label-text text-xs">W</span>
											<input
												type="checkbox"
												class="checkbox checkbox-sm checkbox-secondary"
												checked={relay.write}
												onchange={() => toggleWrite(index)}
											/>
										</label>
										<button
											class="btn btn-ghost btn-sm btn-square text-error"
											onclick={() => removeRelay(index)}
											title="Remove relay"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								</div>
							{/each}
						</div>

						<!-- Add relay form -->
						<div class="divider">Add Relay</div>
						<div class="flex flex-col gap-3">
							<div class="join w-full">
								<input
									type="text"
									class="input input-bordered join-item flex-1"
									placeholder="wss://relay.example.com"
									bind:value={newRelayUrl}
									onkeydown={handleKeyDown}
								/>
								<button class="btn btn-primary join-item" onclick={addRelay}>
									Add
								</button>
							</div>
							<div class="flex items-center gap-4">
								<label class="label cursor-pointer gap-2">
									<input
										type="checkbox"
										class="checkbox checkbox-sm checkbox-primary"
										bind:checked={newRelayRead}
									/>
									<span class="label-text">Read</span>
								</label>
								<label class="label cursor-pointer gap-2">
									<input
										type="checkbox"
										class="checkbox checkbox-sm checkbox-secondary"
										bind:checked={newRelayWrite}
									/>
									<span class="label-text">Write</span>
								</label>
							</div>
							{#if validationError}
								<p class="text-error text-sm">{validationError}</p>
							{/if}
						</div>

						<!-- Legend -->
						<div class="mt-6 text-sm text-base-content/60">
							<span class="badge badge-primary badge-sm mr-2">R</span> Read - receive mentions
							<span class="badge badge-secondary badge-sm ml-4 mr-2">W</span> Write - publish events
						</div>

						<!-- Save button -->
						<div class="card-actions justify-end mt-6">
							<button
								class="btn btn-primary btn-lg gap-2"
								onclick={handleSave}
								disabled={saving || !hasChanges}
							>
								{#if saving}
									<span class="loading loading-spinner loading-sm"></span>
									Saving...
								{:else}
									Save Changes
								{/if}
							</button>
						</div>
					{/if}
				</div>
			</div>

			<!-- Blossom Servers Card -->
			{#if blossomLoading}
				<div class="card bg-base-200 shadow-xl mt-6">
					<div class="card-body">
						<div class="flex justify-center py-8">
							<div class="text-center">
								<span class="loading loading-spinner loading-md"></span>
								<p class="mt-2 text-base-content/70 text-sm">Loading Blossom servers...</p>
							</div>
						</div>
					</div>
				</div>
			{:else}
				<div class="card bg-base-200 shadow-xl mt-6" transition:fade={{ duration: 200 }}>
					<div class="card-body">
						<h2 class="card-title text-2xl mb-2">
							<span class="text-2xl">Blossom Media Servers</span>
						</h2>
						<p class="text-base-content/70 mb-6">
							Blossom servers store your media files (images, videos). When a media URL becomes unavailable,
							clients can use your server list to find the file elsewhere.
						</p>

						{#if !hasBlossomList && blossomServers.length === 0}
							<!-- No server list state -->
							<div class="alert alert-info mb-6">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
								</svg>
								<div>
									<p class="font-semibold">No Blossom server list found</p>
									<p class="text-sm">Add Blossom servers to enable media redundancy and fallback.</p>
								</div>
							</div>
							<button class="btn btn-primary" onclick={createDefaultBlossomList}>
								Create Server List with Defaults
							</button>
						{:else}
							<!-- Server list -->
							<div class="space-y-3 mb-6">
								{#each blossomServers as server, index (server.url)}
									<div class="flex items-center gap-3 p-3 bg-base-100 rounded-lg" transition:fade={{ duration: 150 }}>
										<div class="flex-1 font-mono text-sm truncate" title={server.url}>
											{server.url}
										</div>
										<button
											class="btn btn-ghost btn-sm btn-square text-error"
											onclick={() => removeBlossomServer(index)}
											title="Remove server"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								{/each}
							</div>

							<!-- Add server form -->
							<div class="divider">Add Server</div>
							<div class="flex flex-col gap-3">
								<div class="join w-full">
									<input
										type="text"
										class="input input-bordered join-item flex-1"
										placeholder="https://blossom.example.com"
										bind:value={newBlossomUrl}
										onkeydown={handleBlossomKeyDown}
									/>
									<button class="btn btn-primary join-item" onclick={addBlossomServer}>
										Add
									</button>
								</div>
								{#if blossomValidationError}
									<p class="text-error text-sm">{blossomValidationError}</p>
								{/if}
							</div>

							<!-- Save button -->
							<div class="card-actions justify-end mt-6">
								<button
									class="btn btn-primary btn-lg gap-2"
									onclick={handleBlossomSave}
									disabled={blossomSaving || !hasBlossomChanges}
								>
									{#if blossomSaving}
										<span class="loading loading-spinner loading-sm"></span>
										Saving...
									{:else}
										Save Changes
									{/if}
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- App-Specific Relays Card -->
			{#if appRelaysLoading}
				<div class="card bg-base-200 shadow-xl mt-6">
					<div class="card-body">
						<div class="flex justify-center py-8">
							<div class="text-center">
								<span class="loading loading-spinner loading-md"></span>
								<p class="mt-2 text-base-content/70 text-sm">Loading app relay settings...</p>
							</div>
						</div>
					</div>
				</div>
			{:else}
				<div class="card bg-base-200 shadow-xl mt-6" transition:fade={{ duration: 200 }}>
					<div class="card-body">
						<h2 class="card-title text-2xl mb-2">
							<span class="text-2xl">App-Specific Relays</span>
						</h2>
						<p class="text-base-content/70 mb-6">
							These relays store specific content types. Events are published here
							<strong>in addition to</strong> your personal relay list.
							Your custom settings sync across devices via Nostr.
						</p>

						{#each Object.entries(CATEGORIES) as [category, config]}
							{@const override = appRelayOverrides.get(category) || []}
							{@const serverDefaults = getDefaultRelaysForCategory(category)}
							{@const effectiveRelays = override.length > 0 ? override : serverDefaults}
							{@const isEditing = editingCategory === category}

							<div class="mt-4 p-4 bg-base-100 rounded-lg">
								<h3 class="font-semibold flex items-center gap-2 mb-3">
									{config.label}
									{#if override.length > 0}
										<span class="badge badge-primary badge-sm">Custom</span>
									{:else}
										<span class="badge badge-ghost badge-sm">Server default</span>
									{/if}
								</h3>

								<!-- Current relays -->
								<div class="space-y-2">
									{#each effectiveRelays as relay}
										<div class="flex items-center gap-2 p-2 bg-base-200 rounded">
											<span class="font-mono text-sm flex-1 truncate" title={relay}>{relay}</span>
											{#if override.length > 0}
												<button
													class="btn btn-ghost btn-xs btn-square text-error"
													onclick={() => removeAppRelay(category, relay)}
													disabled={appRelaysSaving}
													title="Remove relay"
												>
													<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
													</svg>
												</button>
											{/if}
										</div>
									{/each}

									{#if effectiveRelays.length === 0}
										<p class="text-sm text-base-content/50 italic">No relays configured</p>
									{/if}
								</div>

								<!-- Actions -->
								<div class="flex flex-wrap gap-2 mt-3">
									{#if !hasOverride(category) && serverDefaults.length > 0}
										<button
											class="btn btn-xs btn-primary"
											onclick={() => saveServerDefaultsAsMyRelays(category)}
											disabled={appRelaysSaving}
										>
											{#if appRelaysSaving}
												<span class="loading loading-spinner loading-xs"></span>
											{/if}
											Save as my defaults
										</button>
									{/if}

									{#if isEditing}
										<!-- Add relay form -->
										<div class="w-full mt-2">
											<div class="join w-full">
												<input
													type="text"
													class="input input-bordered input-sm join-item flex-1"
													placeholder="wss://relay.example.com"
													bind:value={newAppRelayUrl}
													onkeydown={(e) => handleAppRelayKeyDown(e, category)}
												/>
												<button
													class="btn btn-primary btn-sm join-item"
													onclick={() => addAppRelay(category)}
													disabled={appRelaysSaving}
												>
													Add
												</button>
												<button
													class="btn btn-ghost btn-sm join-item"
													onclick={() => { editingCategory = null; newAppRelayUrl = ''; appRelayValidationError = null; }}
												>
													Cancel
												</button>
											</div>
											{#if appRelayValidationError}
												<p class="text-error text-xs mt-1">{appRelayValidationError}</p>
											{/if}
										</div>
									{:else}
										<button
											class="btn btn-xs btn-outline"
											onclick={() => { editingCategory = category; newAppRelayUrl = ''; }}
											disabled={appRelaysSaving}
										>
											Add relay
										</button>

										{#if hasOverride(category)}
											<button
												class="btn btn-xs btn-ghost"
												onclick={() => resetToDefault(category)}
												disabled={appRelaysSaving}
											>
												Reset to defaults
											</button>
										{/if}
									{/if}
								</div>

								<!-- Kind info -->
								<p class="text-xs text-base-content/50 mt-2">
									Kinds: {config.kinds.join(', ')}
								</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Gated Mode Card -->
			<div class="card bg-base-200 shadow-xl mt-6" transition:fade={{ duration: 200 }}>
				<div class="card-body">
					<h2 class="card-title text-2xl mb-2">
						<span class="text-2xl">{m.settings_gated_mode_title()}</span>
					</h2>
					<p class="text-base-content/70 mb-6">
						{m.settings_gated_mode_description()}
					</p>

					<div class="form-control">
						<label class="label cursor-pointer justify-start gap-4">
							<input
								type="checkbox"
								class="toggle toggle-primary"
								checked={appSettings.gatedMode}
								disabled={!appSettings.canToggleGatedMode}
								onchange={() => appSettings.toggleGatedMode()}
							/>
							<div class="flex flex-col">
								<span class="label-text font-medium">
									{m.settings_gated_mode_label()}
								</span>
								{#if !appSettings.canToggleGatedMode}
									<span class="label-text-alt text-warning">
										{m.settings_gated_mode_forced()}
									</span>
								{/if}
							</div>
						</label>
					</div>

					<div class="mt-4 p-4 bg-base-100 rounded-lg">
						<h3 class="font-semibold mb-2">{m.settings_gated_mode_current_status()}</h3>
						{#if appSettings.gatedMode}
							<div class="flex items-center gap-2 text-success">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
								</svg>
								<span>{m.settings_gated_mode_enabled_status()}</span>
							</div>
							<p class="text-sm text-base-content/60 mt-2">
								{m.settings_gated_mode_enabled_description()}
							</p>
						{:else}
							<div class="flex items-center gap-2 text-base-content/70">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
								</svg>
								<span>{m.settings_gated_mode_disabled_status()}</span>
							</div>
							<p class="text-sm text-base-content/60 mt-2">
								{m.settings_gated_mode_disabled_description()}
							</p>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Toast notifications - fixed at top-right -->
<div class="toast toast-top toast-end z-50">
	{#if success}
		<div class="alert alert-success shadow-lg" transition:fade={{ duration: 200 }}>
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
			</svg>
			<span>{success}</span>
		</div>
	{/if}
	{#if error}
		<div class="alert alert-error shadow-lg" transition:fade={{ duration: 200 }}>
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
			</svg>
			<span>{error}</span>
		</div>
	{/if}
	{#if blossomSuccess}
		<div class="alert alert-success shadow-lg" transition:fade={{ duration: 200 }}>
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
			</svg>
			<span>{blossomSuccess}</span>
		</div>
	{/if}
	{#if blossomError}
		<div class="alert alert-error shadow-lg" transition:fade={{ duration: 200 }}>
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
			</svg>
			<span>{blossomError}</span>
		</div>
	{/if}
	{#if appRelaysSuccess}
		<div class="alert alert-success shadow-lg" transition:fade={{ duration: 200 }}>
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
			</svg>
			<span>{appRelaysSuccess}</span>
		</div>
	{/if}
	{#if appRelaysError}
		<div class="alert alert-error shadow-lg" transition:fade={{ duration: 200 }}>
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
			</svg>
			<span>{appRelaysError}</span>
		</div>
	{/if}
</div>
