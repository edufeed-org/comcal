<!--
  SearchInput Component
  Provides text search for calendar events by title and tags
-->

<script>
  import { calendarFilters } from '$lib/stores/calendar-filters.svelte.js';
  import { SearchIcon } from '../icons';
  import * as m from '$lib/paraglide/messages';

  // Props
  let { onSearchQueryChange = () => {} } = $props();

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
      console.log('🔍 SearchInput: Updating search query:', searchQuery);
      calendarFilters.setSearchQuery(searchQuery);
      onSearchQueryChange(searchQuery);
    }, 300);
  }

  /**
   * Clear search query
   */
  function clearSearch() {
    console.log('🔍 SearchInput: Clearing search');
    searchQuery = '';
    calendarFilters.clearSearchQuery();
    onSearchQueryChange('');

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
    <SearchIcon class_="h-4 w-4 text-base-content/70" />
    <span class="font-medium text-base-content">{m.calendar_search_title()}</span>
    {#if hasQuery}
      <span class="badge badge-sm badge-primary">{m.calendar_search_active()}</span>
    {/if}
  </div>

  <!-- Search input with join pattern -->
  <div class="join w-full">
    <input
      type="text"
      class="input-bordered input join-item w-full"
      placeholder={m.calendar_search_placeholder()}
      value={searchQuery}
      oninput={handleInput}
      aria-label={m.calendar_search_aria()}
    />
    {#if hasQuery}
      <button
        type="button"
        class="btn join-item btn-ghost"
        onclick={clearSearch}
        aria-label={m.calendar_search_clear_aria()}
        title={m.calendar_search_clear_aria()}
      >
        {m.calendar_search_clear()}
      </button>
    {/if}
  </div>

  <!-- Helper text -->
  <p class="mt-2 text-xs text-base-content/60">
    {#if hasQuery}
      {m.calendar_search_helper_active()}
    {:else}
      {m.calendar_search_helper_inactive()}
    {/if}
  </p>
</div>
