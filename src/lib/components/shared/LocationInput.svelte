<!--
  LocationInput Component
  Reusable location input with autocomplete functionality
-->

<script>
  import { autocompleteAddress } from '../../helpers/geocoding.js';
  import * as m from '$lib/paraglide/messages';

  let {
    value = $bindable(''),
    placeholder = m.location_input_placeholder(),
    label = m.location_input_label(),
    required = false,
    class: customClass = ''
  } = $props();

  // Autocomplete state
  let suggestions = $state(
    /** @type {Array<{formatted: string, lat: number, lng: number}>} */ ([])
  );
  let showSuggestions = $state(false);
  let isLoadingSuggestions = $state(false);
  let debounceTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);

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
  <label for="location-input" class="mb-1 block text-sm font-medium text-base-content">
    {label}
    {#if required}
      <span class="text-error">*</span>
    {/if}
  </label>
  <input
    id="location-input"
    type="text"
    class="input-bordered input w-full"
    bind:value
    oninput={handleLocationInput}
    onfocus={handleLocationFocus}
    onblur={handleLocationBlur}
    {placeholder}
    {required}
    autocomplete="off"
  />

  {#if showSuggestions && suggestions.length > 0}
    <div
      class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-lg"
    >
      {#each suggestions as suggestion (suggestion.formatted)}
        <button
          type="button"
          class="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-base-200"
          onclick={() => selectSuggestion(suggestion.formatted)}
        >
          {suggestion.formatted}
        </button>
      {/each}
    </div>
  {/if}

  {#if isLoadingSuggestions}
    <div class="mt-1 text-xs text-base-content/60">
      {m.location_input_loading()}
    </div>
  {/if}
</div>
