<!--
  SKOSDropdown Component
  A reusable dropdown for selecting SKOS concepts with search and multi-select support
  Using DaisyUI 5 dropdown component
-->

<script>
	import { onMount } from 'svelte';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import {
		fetchVocabulary,
		getConceptLabel,
		sortConceptsByLabel,
		filterConcepts
	} from '$lib/helpers/educational/skosLoader.js';
	import { CloseIcon, SearchIcon, ChevronDownIcon } from '$lib/components/icons';

	/**
	 * @typedef {import('$lib/helpers/educational/skosLoader.js').SKOSConcept} SKOSConcept
	 */

	/**
	 * @typedef {Object} SelectedConcept
	 * @property {string} id - The concept URI
	 * @property {string} label - The display label
	 */

	/** @type {{ vocabularyKey: 'learningResourceType' | 'about' | 'intendedEndUserRole', selected?: SelectedConcept[], multiple?: boolean, required?: boolean, label?: string, placeholder?: string, helpText?: string, disabled?: boolean, maxSelections?: number, onchange?: (selected: SelectedConcept[]) => void }} */
	let {
		vocabularyKey,
		selected = $bindable([]),
		multiple = true,
		required = false,
		label = '',
		placeholder = 'Select...',
		helpText = '',
		disabled = false,
		maxSelections = 10,
		onchange = () => {}
	} = $props();

	// State
	let concepts = $state(/** @type {SKOSConcept[]} */ ([]));
	let isLoading = $state(true);
	let error = $state(/** @type {string | null} */ (null));
	let isOpen = $state(false);
	let searchTerm = $state('');
	let dropdownRef = $state(/** @type {HTMLDivElement | null} */ (null));
	let inputRef = $state(/** @type {HTMLInputElement | null} */ (null));

	// Get current locale
	const locale = $derived(getLocale());

	// Filtered and sorted concepts
	const filteredConcepts = $derived.by(() => {
		let filtered = filterConcepts(concepts, searchTerm, locale);
		return sortConceptsByLabel(filtered, locale);
	});

	// Load vocabulary on mount
	onMount(async () => {
		try {
			concepts = await fetchVocabulary(vocabularyKey);
			isLoading = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load vocabulary';
			isLoading = false;
		}
	});

	// Close dropdown when clicking outside
	/**
	 * @param {MouseEvent} event
	 */
	function handleClickOutside(event) {
		if (dropdownRef && event.target instanceof Node && !dropdownRef.contains(event.target)) {
			isOpen = false;
		}
	}

	// Add/remove event listener
	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
			// Focus search input when dropdown opens
			setTimeout(() => inputRef?.focus(), 0);
		} else {
			document.removeEventListener('click', handleClickOutside);
			searchTerm = '';
		}
		return () => document.removeEventListener('click', handleClickOutside);
	});

	/**
	 * Toggle selection of a concept
	 * @param {SKOSConcept} concept
	 */
	function toggleSelection(concept) {
		const conceptLabel = getConceptLabel(concept, locale);
		const isSelected = selected.some((s) => s.id === concept.id);

		if (isSelected) {
			// Remove
			selected = selected.filter((s) => s.id !== concept.id);
		} else {
			// Add (if not at max)
			if (multiple) {
				if (selected.length < maxSelections) {
					selected = [...selected, { id: concept.id, label: conceptLabel }];
				}
			} else {
				// Single select - replace
				selected = [{ id: concept.id, label: conceptLabel }];
				isOpen = false;
			}
		}

		onchange(selected);
	}

	/**
	 * Remove a selected item
	 * @param {string} id
	 * @param {Event} event
	 */
	function removeSelection(id, event) {
		event.stopPropagation();
		selected = selected.filter((s) => s.id !== id);
		onchange(selected);
	}

	/**
	 * Check if a concept is selected
	 * @param {string} id
	 * @returns {boolean}
	 */
	function isSelected(id) {
		return selected.some((s) => s.id === id);
	}

	/**
	 * Handle keyboard navigation
	 * @param {KeyboardEvent} event
	 */
	function handleKeydown(event) {
		if (event.key === 'Escape') {
			isOpen = false;
		} else if (event.key === 'Enter' && !isOpen) {
			isOpen = true;
		}
	}
</script>

<div class="form-control w-full">
	<!-- Label -->
	{#if label}
		<label class="label">
			<span class="label-text font-medium">
				{label}
				{#if required}
					<span class="text-error">*</span>
				{/if}
			</span>
		</label>
	{/if}

	<!-- DaisyUI Dropdown -->
	<div class="dropdown w-full" class:dropdown-open={isOpen} bind:this={dropdownRef}>
		<!-- Dropdown Trigger -->
		<button
			type="button"
			tabindex="0"
			role="button"
			class="input input-bordered w-full flex items-center gap-2 cursor-pointer min-h-[3rem] h-auto py-2 pr-8"
			class:input-disabled={disabled}
			onclick={() => !disabled && (isOpen = !isOpen)}
			onkeydown={handleKeydown}
			{disabled}
		>
			{#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
				<span class="text-base-content/50">Loading...</span>
			{:else if error}
				<span class="text-error text-sm">{error}</span>
			{:else if selected.length === 0}
				<span class="text-base-content/50">{placeholder}</span>
			{:else}
				<!-- Selected items -->
				<div class="flex flex-wrap gap-1.5">
					{#each selected as item (item.id)}
						<span class="badge badge-primary gap-1 py-2">
							{item.label}
							<button
								type="button"
								class="hover:bg-primary-focus rounded-full p-0.5"
								onclick={(e) => removeSelection(item.id, e)}
								aria-label="Remove {item.label}"
							>
								<CloseIcon class_="w-3 h-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}
		</button>

		<!-- Dropdown arrow -->
		<div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform" class:rotate-180={isOpen}>
			<ChevronDownIcon class_="w-4 h-4 text-base-content/50" />
		</div>

	<!-- Dropdown Menu using DaisyUI dropdown-content -->
	{#if !isLoading && !error}
		<div tabindex="0" class="dropdown-content z-[100] mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
				<!-- Search Input -->
				<div class="p-2 border-b border-base-300 sticky top-0 bg-base-100 z-10">
					<div class="relative">
						<SearchIcon class_="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
						<input
							type="text"
							bind:this={inputRef}
							bind:value={searchTerm}
							placeholder="Search..."
							class="input input-sm input-bordered w-full pl-9"
							onclick={(e) => e.stopPropagation()}
						/>
					</div>
				</div>

				<!-- Options List -->
				<div class="overflow-y-auto flex-1">
					{#if filteredConcepts.length === 0}
						<div class="p-4 text-center text-base-content/50">
							No results found
						</div>
					{:else}
						{#each filteredConcepts as concept (concept.id)}
							{@const conceptLabel = getConceptLabel(concept, locale)}
							{@const conceptSelected = isSelected(concept.id)}
							{@const indentLevel = concept.level || 0}
							<button
								type="button"
								class="w-full py-2 text-left hover:bg-base-200 flex items-center gap-2 transition-colors {conceptSelected ? 'bg-primary/10' : ''}"
								style="padding-left: {16 + indentLevel * 16}px; padding-right: 16px;"
								onclick={() => toggleSelection(concept)}
							>
								{#if multiple}
									<input
										type="checkbox"
										class="checkbox checkbox-sm checkbox-primary flex-shrink-0"
										checked={conceptSelected}
										readonly
									/>
								{/if}
								<span class="flex-1 truncate {indentLevel > 0 && !conceptSelected ? 'text-base-content/70' : ''}" class:font-medium={conceptSelected}>
									{#if indentLevel > 0}
										<span class="text-base-content/40 mr-1">{'└'.repeat(Math.min(indentLevel, 1))}</span>
									{/if}
									{conceptLabel}
								</span>
								{#if conceptSelected && !multiple}
									<svg class="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
									</svg>
								{/if}
							</button>
						{/each}
					{/if}
				</div>

				<!-- Selection count (for multi-select) -->
				{#if multiple && selected.length > 0}
					<div class="p-2 border-t border-base-300 bg-base-200 text-xs text-base-content/70 flex justify-between items-center">
						<span>{selected.length} selected</span>
						{#if selected.length >= maxSelections}
							<span class="text-warning">Maximum reached</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Help Text -->
	{#if helpText}
		<label class="label">
			<span class="label-text-alt text-base-content/60">{helpText}</span>
		</label>
	{/if}
</div>
