<!--
  LearningContentFilters Component
  Filter panel for educational content with NIP-50 search support
  Includes free-text search and SKOS vocabulary dropdowns
-->

<script>
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { appConfig } from '$lib/config.js';
	import SKOSDropdown from './SKOSDropdown.svelte';
	import { SearchIcon, CloseIcon } from '$lib/components/icons';
	import * as m from '$lib/paraglide/messages';

	/**
	 * @typedef {Object} SelectedConcept
	 * @property {string} id
	 * @property {string} label
	 */

	/**
	 * @typedef {import('$lib/helpers/educational/searchQueryBuilder.js').SearchFilters} SearchFilters
	 */

	/** @type {{ onfilterchange: (filters: SearchFilters) => void, isSearching?: boolean }} */
	let { onfilterchange, isSearching = false } = $props();

	// Filter state
	let searchText = $state('');
	let learningResourceType = $state(/** @type {SelectedConcept[]} */ ([]));
	let about = $state(/** @type {SelectedConcept[]} */ ([]));
	let audience = $state(/** @type {SelectedConcept[]} */ ([]));

	// Debounce timer
	let debounceTimer = $state(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

	// Get current locale
	const locale = $derived(getLocale());

	// Check if any filters are active
	const hasActiveFilters = $derived(
		searchText.trim() !== '' ||
			learningResourceType.length > 0 ||
			about.length > 0 ||
			audience.length > 0
	);

	/**
	 * Emit filter change with debounce for text input
	 * @param {boolean} immediate - Whether to emit immediately (for dropdown changes)
	 */
	function emitFilterChange(immediate = false) {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

	const emit = () => {
		/** @type {SearchFilters} */
		const filters = {
				searchText,
				learningResourceType: learningResourceType.map((c) => ({
					id: c.id,
					label: c.label,
					prefLabel: { [locale]: c.label }
				})),
				about: about.map((c) => ({
					id: c.id,
					label: c.label,
					prefLabel: { [locale]: c.label }
				})),
				audience: audience.map((c) => ({
					id: c.id,
					label: c.label,
					prefLabel: { [locale]: c.label }
				}))
			};
			onfilterchange(filters);
		};

		if (immediate) {
			emit();
		} else {
			debounceTimer = setTimeout(emit, appConfig.educational.searchDebounceMs);
		}
	}

	/**
	 * Handle search text input
	 * @param {Event} event
	 */
	function handleSearchInput(event) {
		const target = /** @type {HTMLInputElement} */ (event.target);
		searchText = target.value;
		emitFilterChange(false); // Debounced
	}

	/**
	 * Clear all filters
	 */
	function clearAllFilters() {
		searchText = '';
		learningResourceType = [];
		about = [];
		audience = [];
		emitFilterChange(true);
	}

	/**
	 * Handle dropdown change
	 * @param {'learningResourceType' | 'about' | 'audience'} field
	 * @param {SelectedConcept[]} selected
	 */
	function handleDropdownChange(field, selected) {
		if (field === 'learningResourceType') {
			learningResourceType = selected;
		} else if (field === 'about') {
			about = selected;
		} else if (field === 'audience') {
			audience = selected;
		}
		emitFilterChange(true); // Immediate for dropdowns
	}
</script>

<div class="learning-content-filters space-y-4">
	<!-- Search Input -->
	<div class="form-control">
		<div class="relative">
			<div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
				{#if isSearching}
					<span class="loading loading-spinner loading-sm text-primary"></span>
				{:else}
					<SearchIcon class_="w-5 h-5 text-base-content/50" />
				{/if}
			</div>
			<input
				type="text"
				placeholder={m.learning_filter_search_placeholder()}
				value={searchText}
				oninput={handleSearchInput}
				class="input input-bordered w-full pl-10 pr-10"
				aria-label={m.learning_filter_search_aria()}
			/>
			{#if searchText}
				<button
					type="button"
					class="absolute right-3 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
					onclick={() => {
						searchText = '';
						emitFilterChange(true);
					}}
					aria-label={m.learning_filter_clear_search()}
				>
					<CloseIcon class_="w-4 h-4" />
				</button>
			{/if}
		</div>
	</div>

	<!-- Filter Dropdowns -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
		<!-- Learning Resource Type -->
		<SKOSDropdown
			vocabularyKey="learningResourceType"
			bind:selected={learningResourceType}
			multiple={true}
			label={m.learning_filter_resource_type()}
			placeholder={m.learning_filter_resource_type_placeholder()}
			maxSelections={5}
			onchange={(selected) => handleDropdownChange('learningResourceType', selected)}
		/>

		<!-- Subject/Topic -->
		<SKOSDropdown
			vocabularyKey="about"
			bind:selected={about}
			multiple={true}
			label={m.learning_filter_subject()}
			placeholder={m.learning_filter_subject_placeholder()}
			maxSelections={5}
			onchange={(selected) => handleDropdownChange('about', selected)}
		/>

		<!-- Target Audience -->
		<SKOSDropdown
			vocabularyKey="intendedEndUserRole"
			bind:selected={audience}
			multiple={true}
			label={m.learning_filter_audience()}
			placeholder={m.learning_filter_audience_placeholder()}
			maxSelections={5}
			onchange={(selected) => handleDropdownChange('audience', selected)}
		/>
	</div>

	<!-- Active Filters Summary & Clear Button -->
	{#if hasActiveFilters}
		<div class="flex items-center justify-between bg-base-200 rounded-lg p-3">
			<div class="flex flex-wrap gap-2 items-center">
				<span class="text-sm text-base-content/70">{m.learning_filter_active()}:</span>
				{#if searchText}
					<span class="badge badge-outline gap-1">
						{m.learning_filter_search_label()}: "{searchText}"
					</span>
				{/if}
				{#each learningResourceType as item (item.id)}
					<span class="badge badge-primary gap-1">{item.label}</span>
				{/each}
				{#each about as item (item.id)}
					<span class="badge badge-secondary gap-1">{item.label}</span>
				{/each}
				{#each audience as item (item.id)}
					<span class="badge badge-accent gap-1">{item.label}</span>
				{/each}
			</div>
			<button type="button" class="btn btn-ghost btn-sm" onclick={clearAllFilters}>
				{m.learning_filter_clear_all()}
			</button>
		</div>
	{/if}
</div>
