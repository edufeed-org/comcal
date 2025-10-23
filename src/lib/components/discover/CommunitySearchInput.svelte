<!--
  CommunitySearchInput Component
  Provides text search for communities by name and description
-->

<script>
	// Props
	let { onSearchChange = () => {} } = $props();

	// Local state
	let searchQuery = $state('');
	let debounceTimer = $state(/** @type {number | null} */ (null));

	/**
	 * Handle input changes with debouncing
	 * @param {Event} event
	 */
	function handleInput(event) {
		const target = /** @type {HTMLInputElement} */ (event.target);
		searchQuery = target.value;

		// Clear existing timer
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
		}

		// Debounce the search - wait 300ms after user stops typing
		debounceTimer = setTimeout(() => {
			console.log('🔍 CommunitySearchInput: Updating search query:', searchQuery);
			onSearchChange(searchQuery);
		}, 300);
	}

	/**
	 * Clear search query
	 */
	function clearSearch() {
		console.log('🔍 CommunitySearchInput: Clearing search');
		searchQuery = '';
		onSearchChange('');

		// Clear debounce timer if active
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	}

	// Derived state
	let hasQuery = $derived(searchQuery.trim().length > 0);
</script>

<div class="border-b border-base-300 bg-base-100 px-6 py-4">
	<!-- Header -->
	<div class="mb-3 flex items-center gap-3">
		<svg class="h-5 w-5 text-base-content/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
			/>
		</svg>
		<span class="font-medium text-base-content">Search Communities</span>
		{#if hasQuery}
			<span class="badge badge-primary badge-sm">active</span>
		{/if}
	</div>

	<!-- Search input -->
	<div class="relative">
		<input
			type="text"
			class="input input-bordered w-full pr-10"
			placeholder="Search by name or description..."
			value={searchQuery}
			oninput={handleInput}
			aria-label="Search communities"
		/>

		<!-- Clear button -->
		{#if hasQuery}
			<button
				class="btn btn-ghost btn-circle btn-sm absolute right-2 top-1/2 -translate-y-1/2"
				onclick={clearSearch}
				aria-label="Clear search"
				title="Clear search"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Helper text -->
	<p class="mt-2 text-xs text-base-content/60">
		{#if hasQuery}
			Searching in community names and descriptions. Press × to clear.
		{:else}
			Search for communities by typing keywords from names or descriptions
		{/if}
	</p>
</div>
