<script>
	import { onDestroy, onMount } from 'svelte';
	import { TimelineModel } from 'applesauce-core/models';
	import { createTimelineLoader } from 'applesauce-loaders/loaders';
	import { pool, relays } from '$lib/store.svelte';
	import { eventStore } from '$lib/store.svelte';

	let notes = $state([]);
	let loading = $state(false);

	function createCalendarLoader(limit = 0, since = 0, until = 0) {
		const timelineLoader = createTimelineLoader(
			pool,
			relays,
			{ kinds: [31922, 31923], limit: 10 },
			{ eventStore }
		);
		return timelineLoader;
	}
  const loader = $state(createCalendarLoader())

	const timelineLoader = createTimelineLoader(
		pool,
		relays,
		{ kinds: [31922, 31923], limit: 10 },
		{ eventStore }
	);
	let subscription = $state();

	onMount(() => {
		subscription = eventStore
			.model(TimelineModel, { kinds: [31922, 31923], limit: 10 })
			.subscribe((timeline) => {
				console.log(`Timeline updated: ${timeline.length} notes`);
				notes = timeline;
			});
	});

	onDestroy(() => {
		// subscription.unsubscribe();
	});

	function loadMore() {
		loading = true;
    // if requirements change i could change the loader here
		console.log('loading more');
		// const since = notes.length ? notes[notes.length - 1].created_at : Math.floor(Date.now() / 1000);
		loader().subscribe({
			complete: () => {
				loading = false;
			}
		});

		loading = false;
	}
</script>

{#each notes as note}
	<p>{JSON.stringify(note)}</p>
{/each}

<button class="btn" onclick={() => loadMore()} disabled={loading}>Load more</button>
