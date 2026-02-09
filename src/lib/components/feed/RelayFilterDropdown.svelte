<!--
  RelayFilterDropdown Component
  A dropdown for filtering content by relay source.
  Shows available relays for the current content category with an edit link to settings.
-->
<script>
  import { resolve } from '$app/paths';
  import * as m from '$lib/paraglide/messages';

  /**
   * @typedef {Object} Props
   * @property {string[]} relays - Available relay URLs for the current category
   * @property {string | null} value - Selected relay URL or null for all
   * @property {(value: string | null) => void} onchange - Callback when filter changes
   * @property {string} settingsCategory - Category name for the edit link
   */

  /** @type {Props} */
  let { relays = [], value = null, onchange, settingsCategory: _settingsCategory = '' } = $props();

  /**
   * Shorten relay URL for display (e.g. "wss://relay.example.com" → "relay.example.com")
   * @param {string} url
   * @returns {string}
   */
  function shortenRelayUrl(url) {
    try {
      return url.replace(/^wss?:\/\//, '').replace(/\/$/, '');
    } catch {
      return url;
    }
  }

  /**
   * Handle selection change
   * @param {Event} e
   */
  function handleChange(e) {
    const target = /** @type {HTMLSelectElement} */ (e.target);
    const newValue = target.value === '' ? null : target.value;
    onchange(newValue);
  }
</script>

<div class="form-control w-full">
  <label for="relay-filter" class="label">
    <span class="label-text font-medium">{m.discover_relay_label()}</span>
    <a
      href={resolve('/settings')}
      class="label-text-alt link link-primary"
      title={m.discover_relay_edit_title()}
    >
      {m.discover_relay_edit()}
    </a>
  </label>
  <select
    id="relay-filter"
    class="select-bordered select w-full"
    value={value ?? ''}
    onchange={handleChange}
  >
    <option value="">{m.discover_relay_all()}</option>
    {#each relays as relay (relay)}
      <option value={relay}>{shortenRelayUrl(relay)}</option>
    {/each}
  </select>
</div>
