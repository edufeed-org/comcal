<!--
  BoardsView Component
  Displays kanban boards (kind 30301) shared with a community.
  Follows the same loader/model pattern as LearningView.
-->

<script>
  import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
  import { useKanbanCommunityLoader } from '$lib/loaders/kanban-community.js';
  import { CommunityBoardModel } from '$lib/models/community-content.js';
  import { useProfileMap } from '$lib/stores/profile-map.svelte.js';
  import KanbanBoardCard from '$lib/components/kanban/KanbanBoardCard.svelte';
  import { KanbanIcon } from '$lib/components/icons';
  import * as m from '$lib/paraglide/messages';

  /**
   * @typedef {Object} Props
   * @property {string} communityPubkey - The community's public key
   * @property {any} [communityProfile] - The community's profile (optional)
   */

  /** @type {Props} */
  let { communityPubkey, communityProfile: _communityProfile = null } = $props();

  // State
  let boards = $state(/** @type {any[]} */ ([]));
  let isLoading = $state(true);
  let error = $state(/** @type {string | null} */ (null));
  const getAuthorProfiles = useProfileMap(() => boards.map((b) => b.pubkey));
  let authorProfiles = $derived(getAuthorProfiles());

  // Loader cleanup reference
  let loaderCleanup = /** @type {(() => void) | null} */ (null);

  // Load boards when community changes
  $effect(() => {
    boards = [];
    isLoading = true;
    error = null;

    if (loaderCleanup) {
      loaderCleanup();
      loaderCleanup = null;
    }

    if (!communityPubkey) {
      isLoading = false;
      return;
    }

    console.log('📋 BoardsView: Loading boards for community', communityPubkey.slice(0, 8));

    try {
      const { cleanup } = useKanbanCommunityLoader(communityPubkey);
      loaderCleanup = cleanup;

      const modelSub = eventStore.model(CommunityBoardModel, communityPubkey).subscribe({
        next: (loadedBoards) => {
          console.log('📋 BoardsView: Received', loadedBoards.length, 'boards');
          boards = loadedBoards;
          isLoading = false;
        },
        error: (err) => {
          console.error('📋 BoardsView: Error loading boards:', err);
          error = 'Failed to load boards';
          isLoading = false;
        }
      });

      const originalCleanup = cleanup;
      loaderCleanup = () => {
        modelSub.unsubscribe();
        originalCleanup();
      };
    } catch (err) {
      console.error('📋 BoardsView: Error setting up loader:', err);
      error = 'Failed to connect to relay';
      isLoading = false;
    }

    return () => {
      if (loaderCleanup) {
        loaderCleanup();
        loaderCleanup = null;
      }
    };
  });
</script>

<div class="boards-view p-4">
  <!-- Header -->
  <div class="mb-6">
    <h2 class="text-2xl font-bold text-base-content">
      {m.community_boards_title()}
    </h2>
    <p class="mt-1 text-base-content/60">
      {m.community_boards_description()}
    </p>
  </div>

  <!-- Loading State -->
  {#if isLoading}
    <div class="flex flex-col items-center justify-center py-16">
      <span class="loading loading-lg loading-spinner text-primary"></span>
      <p class="mt-4 text-base-content/60">{m.community_boards_loading()}</p>
    </div>
    <!-- Error State -->
  {:else if error}
    <div class="alert alert-error">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{error}</span>
    </div>
    <!-- Empty State -->
  {:else if boards.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-base-200">
        <KanbanIcon class_="w-12 h-12 text-base-content/40" />
      </div>
      <h3 class="mb-2 text-lg font-semibold text-base-content">
        {m.community_boards_empty_title()}
      </h3>
      <p class="max-w-md text-base-content/60">
        {m.community_boards_empty_description()}
      </p>
    </div>
    <!-- Board List -->
  {:else}
    <div class="space-y-4">
      {#each boards as board (board.id)}
        <KanbanBoardCard
          {board}
          authorProfile={authorProfiles.get(board.pubkey) || null}
          compact={false}
        />
      {/each}
    </div>

    <!-- Board Count -->
    <div class="mt-6 text-center text-sm text-base-content/60">
      {m.community_boards_count({ count: boards.length })}
    </div>
  {/if}
</div>

<style>
  .boards-view {
    min-height: calc(100vh - 16rem);
  }
</style>
