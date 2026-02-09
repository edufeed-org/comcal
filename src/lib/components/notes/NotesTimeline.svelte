<script>
  import { TimelineModel } from 'applesauce-core/models';
  import { kind1Loader } from '$lib/loaders';
  import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
  import NoteCard from './NoteCard.svelte';

  let { pubkey, profileEvent = null } = $props();

  let notes = $state([]);
  let loading = $state(false);

  /** @type {ReturnType<typeof kind1Loader> | undefined} */
  let timelineLoader;
  /** @type {import('rxjs').Subscription | undefined} */
  let subscription;

  // Create loader and subscribe to model when pubkey changes
  $effect(() => {
    if (!pubkey) return;

    // Create loader for this pubkey
    timelineLoader = kind1Loader(pubkey, 20);

    // Subscribe to EventStore model
    subscription = eventStore
      .model(TimelineModel, { kinds: [1], authors: [pubkey] })
      .subscribe((timeline) => {
        console.log(`Timeline updated: ${timeline.length} notes`);
        notes = timeline;
      });

    return () => {
      subscription?.unsubscribe();
    };
  });

  function loadMore() {
    loading = true;
    console.log('loading more');
    const since = notes.length ? notes[notes.length - 1].created_at : Math.floor(Date.now() / 1000);
    timelineLoader(since).subscribe({
      complete: () => {
        loading = false;
      }
    });

    loading = false;
  }
</script>

{#each notes as note (note.id)}
  <NoteCard {note} {profileEvent} />
{/each}

<button class="btn" onclick={() => loadMore()} disabled={loading}>Load more</button>
