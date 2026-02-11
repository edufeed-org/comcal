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
  import * as m from '$lib/paraglide/messages';

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
    placeholder = '',
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
    <div class="label">
      <span class="label-text font-medium">
        {label}
        {#if required}
          <span class="text-error">*</span>
        {/if}
      </span>
    </div>
  {/if}

  <!-- DaisyUI Dropdown -->
  <div class="dropdown w-full" class:dropdown-open={isOpen} bind:this={dropdownRef}>
    <!-- Dropdown Trigger -->
    <button
      type="button"
      class="select-bordered select-trigger select w-full pr-8"
      class:select-disabled={disabled}
      onclick={() => !disabled && (isOpen = !isOpen)}
      onkeydown={handleKeydown}
      {disabled}
    >
      {#if isLoading}
        <span class="loading loading-sm loading-spinner"></span>
        <span class="text-base-content/50">Loading...</span>
      {:else if error}
        <span class="text-sm text-error">{error}</span>
      {:else if selected.length === 0}
        <span class="text-base-content/70">{placeholder || m.skos_dropdown_select()}</span>
      {:else}
        <!-- Selected items -->
        <div class="flex flex-wrap gap-1.5">
          {#each selected as item (item.id)}
            <span class="badge gap-1 py-2 badge-primary">
              {item.label}
              <span
                role="button"
                tabindex="0"
                class="hover:bg-primary-focus cursor-pointer rounded-full p-0.5"
                onclick={(e) => removeSelection(item.id, e)}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    removeSelection(item.id, e);
                  }
                }}
                aria-label="Remove {item.label}"
              >
                <CloseIcon class_="w-3 h-3" />
              </span>
            </span>
          {/each}
        </div>
      {/if}
    </button>

    <!-- Dropdown arrow -->
    <div
      class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 transition-transform"
      class:rotate-180={isOpen}
    >
      <ChevronDownIcon class_="w-4 h-4 text-base-content/50" />
    </div>

    <!-- Dropdown Menu using DaisyUI dropdown-content -->
    {#if !isLoading && !error}
      <div
        class="dropdown-content z-[100] mt-1 flex max-h-80 w-full flex-col overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-lg"
      >
        <!-- Search Input -->
        <div class="sticky top-0 z-10 border-b border-base-300 bg-base-100 p-2">
          <div class="relative">
            <SearchIcon
              class_="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50"
            />
            <input
              type="text"
              bind:this={inputRef}
              bind:value={searchTerm}
              placeholder={m.skos_dropdown_search()}
              class="input-bordered input input-sm w-full pl-9"
              onclick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <!-- Options List -->
        <div class="flex-1 overflow-y-auto">
          {#if filteredConcepts.length === 0}
            <div class="p-4 text-center text-base-content/50">No results found</div>
          {:else}
            {#each filteredConcepts as concept (concept.id)}
              {@const conceptLabel = getConceptLabel(concept, locale)}
              {@const conceptSelected = isSelected(concept.id)}
              {@const indentLevel = concept.level || 0}
              <button
                type="button"
                class="flex w-full items-center gap-2 py-2 text-left transition-colors hover:bg-base-200 {conceptSelected
                  ? 'bg-primary/10'
                  : ''}"
                style="padding-left: {16 + indentLevel * 16}px; padding-right: 16px;"
                onclick={() => toggleSelection(concept)}
              >
                {#if multiple}
                  <input
                    type="checkbox"
                    class="checkbox flex-shrink-0 checkbox-sm checkbox-primary"
                    checked={conceptSelected}
                    readonly
                  />
                {/if}
                <span
                  class="flex-1 truncate {indentLevel > 0 && !conceptSelected
                    ? 'text-base-content/70'
                    : ''}"
                  class:font-medium={conceptSelected}
                >
                  {#if indentLevel > 0}
                    <span class="mr-1 text-base-content/40"
                      >{'└'.repeat(Math.min(indentLevel, 1))}</span
                    >
                  {/if}
                  {conceptLabel}
                </span>
                {#if conceptSelected && !multiple}
                  <svg
                    class="h-4 w-4 flex-shrink-0 text-primary"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                {/if}
              </button>
            {/each}
          {/if}
        </div>

        <!-- Selection count (for multi-select) -->
        {#if multiple && selected.length > 0}
          <div
            class="flex items-center justify-between border-t border-base-300 bg-base-200 p-2 text-xs text-base-content/70"
          >
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
    <div class="label">
      <span class="label-text-alt text-base-content/60">{helpText}</span>
    </div>
  {/if}
</div>
