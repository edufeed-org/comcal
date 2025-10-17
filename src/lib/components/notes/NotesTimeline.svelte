<script>
	import { onDestroy, onMount } from 'svelte';
	import { TimelineModel } from 'applesauce-core/models';
	import { kind1Loader } from '$lib/loaders';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import NoteCard from './NoteCard.svelte';

	let { pubkey, profileEvent = null } = $props();

	let notes = $state([]);
	let loading = $state(false);

	const timelineLoader = kind1Loader(pubkey, 20);
	let subscription = $state();

	onMount(() => {
		subscription = eventStore
			.model(TimelineModel, { kinds: [1], authors: [pubkey],  })
			.subscribe((timeline) => {
				console.log(`Timeline updated: ${timeline.length} notes`);
				notes = timeline;
			});
	});

	onDestroy(() => {
		subscription.unsubscribe();
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

{#each notes as note}
	<NoteCard {note} {profileEvent} />
{/each}

<button class="btn" onclick={() => loadMore()} disabled={loading}>Load more</button>
