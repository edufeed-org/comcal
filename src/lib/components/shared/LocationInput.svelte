<!--
  LocationInput Component
  Reusable location input with autocomplete functionality
-->

<script>
	import { autocompleteAddress } from '../../helpers/geocoding.js';

	let {
		value = $bindable(''),
		placeholder = 'Enter location (e.g., Berlin, Germany)',
		label = 'Location',
		required = false,
		class: customClass = ''
	} = $props();

	// Autocomplete state
	let suggestions = $state(/** @type {Array<{formatted: string, lat: number, lng: number}>} */ ([]));
	let showSuggestions = $state(false);
	let isLoadingSuggestions = $state(false);
	let debounceTimer = /** @type {number | null} */ (null);

	/**
	 * Handle location input with debounced autocomplete
	 * @param {Event} e
	 */
	function handleLocationInput(e) {
		const input = /** @type {HTMLInputElement} */ (e.target);
		const query = input.value;

		// Clear existing timer
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
		}

		// Don't show suggestions for short queries
		if (query.length < 3) {
			showSuggestions = false;
			suggestions = [];
			return;
		}

		// Debounce the API call
		isLoadingSuggestions = true;
		debounceTimer = setTimeout(async () => {
			try {
				const results = await autocompleteAddress(query);
				suggestions = results;
				showSuggestions = results.length > 0;
			} catch (error) {
				console.error('Error fetching suggestions:', error);
				suggestions = [];
				showSuggestions = false;
			} finally {
				isLoadingSuggestions = false;
			}
		}, 400);
	}

	/**
	 * Select a suggestion and populate the location field
	 * @param {string} formatted
	 */
	function selectSuggestion(formatted) {
		value = formatted;
		showSuggestions = false;
		suggestions = [];
	}

	/**
	 * Handle location field blur
	 */
	function handleLocationBlur() {
		// Delay hiding to allow click on suggestion
		setTimeout(() => {
			showSuggestions = false;
		}, 200);
	}

	/**
	 * Handle location field focus
	 */
	function handleLocationFocus() {
		if (suggestions.length > 0 && value.length >= 3) {
			showSuggestions = true;
		}
	}
</script>

<div class="relative {customClass}">
	<label for="location-input" class="block text-sm font-medium text-base-content mb-1">
		{label}
		{#if required}
			<span class="text-error">*</span>
		{/if}
	</label>
	<input
		id="location-input"
		type="text"
		class="input input-bordered w-full"
		bind:value={value}
		oninput={handleLocationInput}
		onfocus={handleLocationFocus}
		onblur={handleLocationBlur}
		{placeholder}
		{required}
		autocomplete="off"
	/>
	
	{#if showSuggestions && suggestions.length > 0}
		<div class="absolute z-10 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
			{#each suggestions as suggestion}
				<button
					type="button"
					class="w-full text-left px-4 py-2 hover:bg-base-200 transition-colors text-sm"
					onclick={() => selectSuggestion(suggestion.formatted)}
				>
					{suggestion.formatted}
				</button>
			{/each}
		</div>
	{/if}
	
	{#if isLoadingSuggestions}
		<div class="text-xs text-base-content/60 mt-1">
			Loading suggestions...
		</div>
	{/if}
</div>
