<script>
  import { getProfilePicture } from 'applesauce-core/helpers';
  import { useCommunityMembership } from '$lib/stores/joined-communities-list.svelte.js';
  import { EventFactory } from 'applesauce-core/event-factory';
  import { manager } from '$lib/stores/accounts.svelte';
  import { publishEvent } from '$lib/services/publish-service.js';
  import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
  import * as m from '$lib/paraglide/messages';

  let { profile, communikeyEvent, communikeyContentTypes, activeTab, onTabChange } = $props();

  // Use the reusable community membership hook with reactive pubkey getter
  const getJoined = useCommunityMembership(() => communikeyEvent?.pubkey);

  /**
   * Handle tab click
   * @param {number} kind - The content type kind number
   * @param {boolean} enabled - Whether the content type is enabled
   */
  function handleTabClick(kind, enabled) {
    if (enabled && onTabChange) {
      onTabChange(kind);
    }
  }

  /**
   * Join the community
   */
  async function joinCommunity() {
    const factory = new EventFactory({ signer: manager.active?.signer });
    const joinEvent = await factory.build({
      kind: 30382,
      tags: [
        ['d', communikeyEvent.pubkey],
        ['n', 'follow']
      ]
    });
    // Sign the event
    const signedEvent = await factory.sign(joinEvent);
    console.log('Signed Join Event:', signedEvent);

    // Publish using outbox model + communikey relays (for kind 30382)
    const result = await publishEvent(signedEvent, [communikeyEvent.pubkey]);

    if (result.success) {
      eventStore.add(signedEvent);
    }

    return result.success;
  }
</script>

<div class="rounded-xl border border-base-200 bg-base-100 shadow-sm">
  <!-- Top Section: Community Info -->
  <div class="flex items-center gap-2 p-3">
    <div class="avatar">
      <div class="mask w-12 mask-hexagon-2 ring-2 ring-base-300">
        <img
          src={getProfilePicture(profile)}
          alt={m.communikey_header_profile_alt()}
          class="object-cover"
        />
      </div>
    </div>

    <div class="min-w-0 flex-1">
      <h1 class="font-community truncate text-base font-bold text-base-content">{profile.name}</h1>
    </div>

    <div class="ml-auto flex items-center gap-2">
      {#if getJoined()}
        <div class="badge gap-1 badge-success">
          <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
          {m.communikey_header_joined_badge()}
        </div>
      {:else}
        <div class="badge gap-1 badge-ghost">
          {m.communikey_header_not_joined_badge()}
        </div>
        <button onclick={joinCommunity} class="btn btn-sm btn-primary">
          {m.communikey_header_join_button()}
        </button>
      {/if}
    </div>
  </div>

  <!-- Bottom Section: Interactive Content Type Tabs -->
  <div class="border-t border-base-200">
    <div class="tabs-bordered tabs overflow-x-auto">
      {#each communikeyContentTypes as contentType (contentType.kind)}
        <button
          class="tab-bordered tab {activeTab === contentType.kind
            ? 'tab-active'
            : ''} {!contentType.enabled ? 'cursor-not-allowed opacity-50' : ''}"
          onclick={() => handleTabClick(contentType.kind, contentType.enabled)}
          disabled={!contentType.enabled}
          title={contentType.description}
        >
          <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d={contentType.icon}
            />
          </svg>
          {contentType.name}
          {#if !contentType.enabled}
            <span class="ml-1 text-xs">🔒</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>
