<!--
  ContentTypeBadgeConfig Component
  Per-content-type configuration for badge-based access control and relays
-->

<script>
  import BadgeSelector from './BadgeSelector.svelte';
  import EditableList from './EditableList.svelte';
  import * as m from '$lib/paraglide/messages';

  /**
   * @typedef {Object} ContentTypeBadges
   * @property {string|null} read
   * @property {string|null} write
   */

  /**
   * @typedef {Object} ContentTypeConfig
   * @property {string} name
   * @property {boolean} enabled
   * @property {ContentTypeBadges} badges
   * @property {string[]} relays
   */

  /**
   * @type {{
   *   contentType: ContentTypeConfig,
   *   authorPubkey: string,
   *   showAdvanced?: boolean
   * }}
   */
  let { contentType = $bindable(), authorPubkey, showAdvanced = false } = $props();

  /**
   * Validate relay URL format
   * @param {string} url
   */
  function validateRelayUrl(url) {
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      return (
        m.create_community_modal_relays_validation?.() ||
        'Relay URL must start with wss:// or ws://'
      );
    }
    try {
      new URL(url);
      return null;
    } catch {
      return m.create_community_modal_error_invalid_url?.() || 'Invalid URL format';
    }
  }
</script>

<div class="card mb-4 bg-base-200 p-4">
  <h4 class="mb-3 font-semibold">{contentType.name}</h4>

  <!-- Read Badge -->
  <div class="mb-3">
    <BadgeSelector
      {authorPubkey}
      bind:selectedBadge={contentType.badges.read}
      label={m.badge_access_read_label?.() || 'Read Access Badge'}
      placeholder={m.badge_access_anyone?.() || 'Anyone can read'}
    />
    <p class="mt-1 text-xs opacity-70">
      {m.badge_access_read_help?.() || 'Users need this badge to view this content'}
    </p>
  </div>

  <!-- Write Badge -->
  <div class="mb-3">
    <BadgeSelector
      {authorPubkey}
      bind:selectedBadge={contentType.badges.write}
      label={m.badge_access_write_label?.() || 'Write Access Badge'}
      placeholder={m.badge_access_anyone?.() || 'Anyone can publish'}
    />
    <p class="mt-1 text-xs opacity-70">
      {m.badge_access_write_help?.() || 'Users need this badge to publish this content'}
    </p>
  </div>

  <!-- Per-Content-Type Relays (Advanced) -->
  {#if showAdvanced}
    <div class="mt-4 border-t border-base-300 pt-4">
      <EditableList
        bind:items={contentType.relays}
        label={m.content_relay_label?.() || 'Content-Specific Relays'}
        placeholder="wss://premium-relay.example.com"
        buttonText={m.create_community_modal_relays_button?.() || 'Add Relay'}
        itemType="relay"
        validator={validateRelayUrl}
        helpText={m.content_relay_help?.() ||
          'Badge-gated content will use these relays instead of community relays'}
      />
    </div>
  {/if}
</div>
