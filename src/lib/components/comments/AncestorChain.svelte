<!--
  AncestorChain Component
  Bluesky-style vertical chain of compact ancestor comment cards.
  Shows the path from root to the focused comment's parent.
-->

<script>
  import { resolve } from '$app/paths';
  import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
  import { getDisplayName, getProfilePicture } from 'applesauce-core/helpers';
  import { formatRelativeTime } from '$lib/helpers/calendar.js';
  import { getPlainTextExcerpt } from '$lib/helpers/commentThreading.js';
  import { hexToNpub } from '$lib/helpers/nostrUtils';

  /**
   * @typedef {Object} AncestorChainProps
   * @property {any[]} ancestors - Comment objects from root to parent of focused (exclusive of focused)
   * @property {(id: string) => void} [onAncestorClick] - Callback when an ancestor card is clicked
   */

  /** @type {AncestorChainProps} */
  let { ancestors, onAncestorClick } = $props();
</script>

{#if ancestors.length > 0}
  <div class="ancestor-chain" data-testid="ancestor-chain">
    {#each ancestors as ancestor, i (ancestor.id)}
      {@const getProfile = useUserProfile(() => ancestor.pubkey)}
      {@const profile = getProfile()}
      {@const displayName = getDisplayName(profile) || ancestor.pubkey.slice(0, 8) + '...'}
      {@const avatar = getProfilePicture(profile)}
      {@const excerpt = getPlainTextExcerpt(ancestor.content, 100)}
      {@const timestamp = formatRelativeTime(ancestor.created_at)}

      <!-- Ancestor card -->
      <button
        class="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-base-200"
        onclick={() => onAncestorClick?.(ancestor.id)}
        data-testid="ancestor-card"
      >
        <!-- Avatar -->
        <a
          href={resolve(`/p/${hexToNpub(ancestor.pubkey) || ancestor.pubkey}`)}
          class="avatar mt-0.5 flex-shrink-0"
          onclick={(e) => e.stopPropagation()}
        >
          <div class="w-7 rounded-full">
            {#if avatar}
              <img src={avatar} alt={displayName} />
            {:else}
              <div
                class="flex h-full w-full items-center justify-center bg-primary text-xs font-semibold text-primary-content"
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            {/if}
          </div>
        </a>

        <!-- Content -->
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <span class="truncate text-xs font-semibold text-base-content">{displayName}</span>
            <span class="shrink-0 text-xs text-base-content/40">{timestamp}</span>
          </div>
          {#if excerpt}
            <p class="mt-0.5 line-clamp-2 text-xs text-base-content/60">{excerpt}</p>
          {/if}
        </div>
      </button>

      <!-- Connector line between ancestors -->
      {#if i < ancestors.length - 1}
        <div class="ml-[22px] h-2 border-l-2 border-base-content/20"></div>
      {/if}
    {/each}

    <!-- Final connector into focused comment -->
    <div class="ml-[22px] h-3 border-l-2 border-base-content/20"></div>
  </div>
{/if}
