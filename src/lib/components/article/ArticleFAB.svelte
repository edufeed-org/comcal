<script>
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { PlusIcon } from '$lib/components/icons';
  import { manager } from '$lib/stores/accounts.svelte';
  import * as m from '$lib/paraglide/messages';

  /** @type {{ communityPubkey: string }} */
  let { communityPubkey } = $props();

  function handleCreateArticle() {
    if (!manager.active) {
      console.warn('User must be logged in to create articles');
      return;
    }
    goto(resolve(`/create/article${communityPubkey ? `?community=${communityPubkey}` : ''}`));
  }
</script>

<div class="fab fixed right-6 bottom-20 z-[60] lg:bottom-6">
  <!-- Main FAB Button -->
  <div
    tabindex="0"
    role="button"
    class="btn btn-circle shadow-lg btn-lg btn-primary hover:shadow-xl"
    aria-label="Open actions menu"
  >
    <PlusIcon class_="h-6 w-6" />
  </div>

  <!-- Write Article Action -->
  <button
    class="tooltip btn tooltip-left btn-circle btn-lg"
    data-tip={m.article_fab_write()}
    onclick={handleCreateArticle}
    aria-label={m.article_fab_write()}
  >
    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  </button>
</div>

<style>
  .fab {
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 0.75rem;
  }

  .fab > button {
    opacity: 0;
    transform: scale(0.8) translateY(10px);
    pointer-events: none;
    transition: all 0.2s ease;
  }

  .fab:hover > button,
  .fab:focus-within > button {
    opacity: 1;
    transform: scale(1) translateY(0);
    pointer-events: auto;
  }

  .fab > button:nth-child(2) {
    transition-delay: 0.05s;
  }
</style>
