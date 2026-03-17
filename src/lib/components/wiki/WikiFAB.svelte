<script>
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { PlusIcon } from '$lib/components/icons';
  import { manager } from '$lib/stores/accounts.svelte';
  import * as m from '$lib/paraglide/messages';

  /** @type {{ communityPubkey: string }} */
  let { communityPubkey } = $props();

  function handleCreateWiki() {
    if (!manager.active) {
      console.warn('User must be logged in to create wikis');
      return;
    }
    goto(resolve(`/create/wiki${communityPubkey ? `?community=${communityPubkey}` : ''}`));
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

  <!-- Write Wiki Action -->
  <button
    class="tooltip btn tooltip-left btn-circle btn-lg"
    data-tip={m.wiki_fab_write()}
    onclick={handleCreateWiki}
    aria-label={m.wiki_fab_write()}
  >
    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
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
