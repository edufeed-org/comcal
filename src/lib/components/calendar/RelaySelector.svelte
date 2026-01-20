<!--
  RelaySelector Component
  Allows users to filter calendar events by selecting specific Nostr relays
-->

<script>
	import { calendarFilters } from '$lib/stores/calendar-filters.svelte.js';
	import { runtimeConfig } from '$lib/stores/config.svelte.js';
	import { FilterIcon, CloseIcon, PlusIcon, RelayIcon } from '../icons';

	// Props
	let { onApplyFilters = () => {} } = $props();

	// Local state
	let isExpanded = $state(false);
	let customRelayInput = $state('');
	let selectedRelays = $state(/** @type {string[]} */ ([]));
	let customRelays = $state(/** @type {string[]} */ ([]));

	// Get default relays from config
	const defaultRelays = [...(runtimeConfig.appRelays?.calendar || []), ...(runtimeConfig.fallbackRelays || [])];

	/**
	 * Toggle relay selection
	 * @param {string} relay
	 */
	function toggleRelay(relay) {
		if (selectedRelays.includes(relay)) {
			selectedRelays = selectedRelays.filter((r) => r !== relay);
		} else {
			selectedRelays = [...selectedRelays, relay];
		}
	}

	/**
	 * Validate relay URL format
	 * @param {string} url
	 * @returns {boolean}
	 */
	function isValidRelayUrl(url) {
		const trimmed = url.trim();
		return trimmed.startsWith('wss://') || trimmed.startsWith('ws://');
	}

	/**
	 * Add custom relay to the list
	 */
	function addCustomRelay() {
		const trimmed = customRelayInput.trim();

		if (!trimmed) return;

		if (!isValidRelayUrl(trimmed)) {
			alert('Relay URL must start with wss:// or ws://');
			return;
		}

		// Auto-upgrade ws:// to wss://
		let relayUrl = trimmed;
		if (trimmed.startsWith('ws://')) {
			relayUrl = trimmed.replace('ws://', 'wss://');
			console.log('⚠️ Auto-upgraded ws:// to wss://:', relayUrl);
		}

		// Check if already exists in default or custom relays
		if (defaultRelays.includes(relayUrl) || customRelays.includes(relayUrl)) {
			alert('This relay is already in the list');
			return;
		}

		customRelays = [...customRelays, relayUrl];
		selectedRelays = [...selectedRelays, relayUrl];
		customRelayInput = '';
	}

	/**
	 * Remove custom relay
	 * @param {string} relay
	 */
	function removeCustomRelay(relay) {
		customRelays = customRelays.filter((r) => r !== relay);
		selectedRelays = selectedRelays.filter((r) => r !== relay);
	}

	/**
	 * Apply relay filters
	 */
	function applyFilters() {
		console.log('📡 Applying relay filters:', selectedRelays);
		calendarFilters.setSelectedRelays(selectedRelays);
		onApplyFilters(selectedRelays);
	}

	/**
	 * Reset selection (clear checkboxes but don't apply)
	 */
	function resetSelection() {
		console.log('📡 Resetting relay selection');
		selectedRelays = [];
		customRelayInput = '';
	}

	/**
	 * Clear all filters including custom relays
	 */
	function clearAll() {
		console.log('📡 Clearing all relay filters');
		selectedRelays = [];
		customRelays = [];
		customRelayInput = '';
		calendarFilters.clearSelectedRelays();
		onApplyFilters([]);
	}

	/**
	 * Toggle expanded state
	 */
	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	// Derived state
	let hasActiveFilters = $derived(selectedRelays.length > 0);
	let allRelays = $derived([...defaultRelays, ...customRelays]);
	let applyButtonText = $derived(
		selectedRelays.length > 0 ? `Apply Filters (${selectedRelays.length})` : 'Show All Relays'
	);
</script>

<div class="border-b border-base-300 bg-base-100">
	<!-- Header - Always visible -->
	<button
		class="flex w-full items-center justify-between px-6 py-3 text-left transition-colors hover:bg-base-200"
		onclick={toggleExpanded}
		aria-expanded={isExpanded}
	>
		<div class="flex items-center gap-3">
			<FilterIcon class_="h-5 w-5 text-base-content/70" />
			<span class="font-medium text-base-content">Filter by Relays</span>
			{#if hasActiveFilters}
				<span class="badge badge-sm badge-primary">{selectedRelays.length}</span>
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
		<div class="bg-base-50 border-t border-base-300 px-6 py-4">
			<!-- Popular Relays Section -->
			<div class="mb-4">
				<h4 class="mb-2 text-sm font-medium text-base-content/70">Popular Relays</h4>
				<div class="space-y-2">
					{#each defaultRelays as relay}
						<label class="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-base-200">
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								checked={selectedRelays.includes(relay)}
								onchange={() => toggleRelay(relay)}
							/>
							<div class="flex flex-1 items-center gap-2">
								<RelayIcon class_="h-4 w-4 text-base-content/50" />
								<span class="text-sm text-base-content">{relay.replace('wss://', '')}</span>
							</div>
						</label>
					{/each}
				</div>
			</div>

			<!-- Custom Relay Section -->
			<div class="mb-4">
				<h4 class="mb-2 text-sm font-medium text-base-content/70">Custom Relay</h4>
				<div class="flex gap-2">
					<input
						type="text"
						class="input-bordered input input-sm flex-1"
						placeholder="wss://custom.relay.com"
						bind:value={customRelayInput}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addCustomRelay();
							}
						}}
					/>
					<button
						class="btn gap-1 btn-sm btn-primary"
						onclick={addCustomRelay}
						disabled={!customRelayInput.trim()}
					>
						<PlusIcon class_="h-4 w-4" />
						Add
					</button>
				</div>
			</div>

			<!-- Custom Relays List -->
			{#if customRelays.length > 0}
				<div class="mb-4">
					<h4 class="mb-2 text-sm font-medium text-base-content/70">Custom Relays</h4>
					<div class="space-y-2">
						{#each customRelays as relay}
							<div
								class="flex items-center justify-between rounded-lg bg-base-200 px-3 py-2 text-sm"
							>
								<div class="flex items-center gap-2">
									<RelayIcon class_="h-4 w-4 text-base-content/50" />
									<span>{relay.replace('wss://', '')}</span>
								</div>
								<button
									class="btn btn-ghost btn-xs"
									onclick={() => removeCustomRelay(relay)}
									title="Remove relay"
								>
									<CloseIcon class_="h-4 w-4" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Action Buttons -->
			<div class="flex gap-2">
				<button class="btn flex-1 btn-sm btn-primary" onclick={applyFilters}>
					{applyButtonText}
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={resetSelection}
					disabled={selectedRelays.length === 0}
					title="Clear checkbox selection"
				>
					Reset Selection
				</button>
				{#if customRelays.length > 0}
					<button
						class="btn btn-ghost btn-sm btn-error"
						onclick={clearAll}
						title="Remove all custom relays and reset filters"
					>
						Clear All
					</button>
				{/if}
			</div>

			<!-- Info text -->
			<p class="mt-3 text-xs text-base-content/60">
				{#if calendarFilters.selectedRelays.length > 0}
					✓ Currently showing events from {calendarFilters.selectedRelays.length} selected
					{calendarFilters.selectedRelays.length === 1 ? 'relay' : 'relays'}
				{:else if selectedRelays.length > 0}
					Selection ready - click "{applyButtonText}" to apply
				{:else}
					✓ Currently showing events from all relays
				{/if}
			</p>
		</div>
	{/if}
</div>
