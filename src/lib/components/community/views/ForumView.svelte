<!--
  ForumView Component
  Two-state forum view: thread list + inline detail view
  Thread list matches Chateau forum layout: single-column, dividers, bottom action bar
-->

<script>
  import { createTimelineLoader } from 'applesauce-loaders/loaders';
  import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
  import { timedPool } from '$lib/loaders/base.js';
  import { getCommunikeyRelays } from '$lib/helpers/relay-helper.js';
  import { getCommunityGlobalRelays } from '$lib/helpers/communityRelays.js';
  import { useThreadCommunityLoader } from '$lib/loaders/threads.js';
  import { CommunityThreadModel } from '$lib/models/community-content.js';
  import { useActiveUser } from '$lib/stores/accounts.svelte';
  import { useProfileMap } from '$lib/stores/profile-map.svelte.js';
  import { PlusIcon, ChevronLeftIcon, SearchIcon } from '$lib/components/icons';
  import ThreadCard from '$lib/components/thread/ThreadCard.svelte';
  import ThreadDetailView from '$lib/components/thread/ThreadDetailView.svelte';
  import ThreadCreateForm from '$lib/components/thread/ThreadCreateForm.svelte';
  import CommunityContentView from './CommunityContentView.svelte';
  import * as m from '$lib/paraglide/messages';

  /** @type {{ communityPubkey: string, communityProfile?: any }} */
  let { communityPubkey, communityProfile = null } = $props();

  const getActiveUser = useActiveUser();
  const activeUser = $derived(getActiveUser());

  let selectedThread = $state(/** @type {any} */ (null));
  let showCreateForm = $state(false);
  let searchQuery = $state('');

  // Stable thread ID tracking for batch comment loader — avoids re-creating
  // loader on every model emission when only content changes but IDs stay same
  let threadIds = $state('');

  // Batch-load commenter profiles for all threads
  let commenterPubkeys = $state(/** @type {string[]} */ ([]));
  const getCommenterProfiles = useProfileMap(() => commenterPubkeys);
  const commenterProfiles = $derived(getCommenterProfiles());

  // Plain Set for O(1) dedup — not reactive, avoids read/write loops in $effect
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- intentionally non-reactive internal tracking
  let seenPubkeys = new Set();

  // Reset commenter tracking when community changes
  $effect(() => {
    const _key = communityPubkey;
    commenterPubkeys = [];
    seenPubkeys = new Set();
  });

  // Batch comment loader: one relay query for all visible threads
  $effect(() => {
    const ids = threadIds.split(',').filter(Boolean);
    if (ids.length === 0) return;

    const communityEvent = eventStore.getReplaceable(10222, communityPubkey);
    const communityRelays = getCommunityGlobalRelays(communityEvent);
    /** @type {string[]} */
    const relays = [...new Set([...getCommunikeyRelays(), ...communityRelays])];
    const loader = createTimelineLoader(
      timedPool,
      relays,
      { kinds: [1111], '#E': ids, limit: 500 },
      { eventStore }
    );
    const sub = loader().subscribe({
      next: (/** @type {any} */ comment) => {
        if (!seenPubkeys.has(comment.pubkey)) {
          seenPubkeys.add(comment.pubkey);
          commenterPubkeys = [...seenPubkeys];
        }
      }
    });

    return () => sub.unsubscribe();
  });

  /**
   * Filter threads by search query — pure function, used inside snippet
   * @param {any[]} items
   * @returns {any[]}
   */
  function filterThreads(items) {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((t) => {
      const title =
        t.tags?.find((/** @type {any} */ tag) => tag[0] === 'title')?.[1]?.toLowerCase() || '';
      const content = t.content?.toLowerCase() || '';
      return title.includes(q) || content.includes(q);
    });
  }

  /**
   * Update stable thread IDs when items change — called from snippet.
   * Defers state update to avoid state_unsafe_mutation in template expressions.
   * @param {any[]} items
   */
  function updateThreadIds(items) {
    const newIds = items
      .map((t) => t.id)
      .filter(Boolean)
      .sort()
      .join(',');
    if (newIds !== threadIds) {
      queueMicrotask(() => {
        threadIds = newIds;
      });
    }
  }

  /**
   * @param {any} thread
   */
  function handleSelectThread(thread) {
    selectedThread = thread;
  }

  function handleBack() {
    selectedThread = null;
  }

  /**
   * @param {any} newThread
   */
  function handleThreadCreated(newThread) {
    selectedThread = newThread;
  }
</script>

{#if selectedThread}
  <!-- Detail mode: show full thread -->
  <div class="p-4">
    <button class="btn mb-4 gap-1 btn-ghost btn-sm" onclick={handleBack}>
      <ChevronLeftIcon class_="w-4 h-4" />
      {m.thread_forum_back_to_list()}
    </button>
    <ThreadDetailView event={selectedThread} onBack={handleBack} />
  </div>
{:else}
  <!-- List mode: thread list with bottom action bar -->
  <CommunityContentView
    {communityPubkey}
    {communityProfile}
    loaderHook={useThreadCommunityLoader}
    model={CommunityThreadModel}
    title={m.community_forum_title()}
    description={m.community_forum_description()}
    loadingText={m.community_forum_loading()}
    emptyTitle={m.community_forum_empty_title()}
    emptyDescription={m.community_forum_empty_description()}
    formatCount={(count) => m.community_forum_count({ count })}
    emptyIconPath="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
  >
    {#snippet content(items, authorProfiles)}
      <!-- Update stable thread IDs for batch comment loader -->
      {@const _ = updateThreadIds(items)}
      {@const filtered = filterThreads(items)}

      <!-- Single-column thread list with dividers -->
      <div class="divide-y divide-base-300">
        {#each filtered as thread (thread.id)}
          <ThreadCard
            {thread}
            authorProfile={authorProfiles.get(thread.pubkey) || null}
            {commenterProfiles}
            onSelect={handleSelectThread}
          />
        {/each}
        {#if filtered.length === 0 && searchQuery.trim()}
          <div class="py-8 text-center text-base-content/60">
            No threads match "{searchQuery}"
          </div>
        {/if}
      </div>
    {/snippet}

    {#snippet fab()}
      <!-- Bottom action bar: Post + Search -->
      <div
        class="fixed right-0 bottom-16 left-0 z-[55] flex items-center gap-2 border-t border-base-300 bg-base-100 px-4 py-3 lg:bottom-0 lg:left-[304px]"
      >
        {#if activeUser}
          <button
            class="btn gap-1 btn-sm btn-primary"
            onclick={() => (showCreateForm = true)}
            aria-label={m.thread_forum_new_thread()}
          >
            <PlusIcon class_="h-4 w-4" />
            {m.thread_forum_post()}
          </button>
        {/if}

        <div class="relative flex-1">
          <SearchIcon
            class_="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40"
          />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder={m.thread_forum_search_placeholder()}
            class="input-bordered input input-sm w-full pl-9"
          />
        </div>
      </div>

      {#if activeUser}
        <ThreadCreateForm
          {communityPubkey}
          {activeUser}
          open={showCreateForm}
          onclose={() => (showCreateForm = false)}
          onCreated={handleThreadCreated}
        />
      {/if}
    {/snippet}
  </CommunityContentView>
{/if}
