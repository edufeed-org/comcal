<!--
  SearchInput Component
  Provides text search for calendar events by title and tags
-->

<script>
  import { calendarFilters } from '$lib/stores/calendar-filters.svelte.js';
  import { SearchIcon } from '../icons';

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
    <span class="font-medium text-base-content">Search Events</span>
    {#if hasQuery}
      <span class="badge badge-sm badge-primary">active</span>
    {/if}
  </div>

  <!-- Search input with join pattern -->
  <div class="join w-full">
    <input
      type="text"
      class="input-bordered input join-item w-full"
      placeholder="Search by title or tag..."
      value={searchQuery}
      oninput={handleInput}
      aria-label="Search calendar events"
    />
    {#if hasQuery}
      <button
        type="button"
        class="btn join-item btn-ghost"
        onclick={clearSearch}
        aria-label="Clear search"
        title="Clear search"
      >
        Clear
      </button>
    {/if}
  </div>

  <!-- Helper text -->
  <p class="mt-2 text-xs text-base-content/60">
    {#if hasQuery}
      Searching in titles and tags. Press × to clear.
    {:else}
      Search for events by typing keywords from titles or tags
    {/if}
  </p>
</div>
