<script>
	/**
	 * ReactionBar - Container for all reactions on an event
	 * Shows existing reactions and add button
	 * @component
	 */
	import { onMount, onDestroy } from 'svelte';
	import { reactionsStore } from '$lib/stores/reactions.svelte.js';
	import ReactionButton from './ReactionButton.svelte';
	import AddReactionButton from './AddReactionButton.svelte';
	
	/** @type {any} */
	let { event, relays } = $props();
	
	// Get reactions from store
	const eventReactions = $derived(reactionsStore.getReactions(event?.id));
	
	onMount(() => {
		if (event?.id) {
			reactionsStore.loadReactions(event, relays);
		}
	});
	
	onDestroy(() => {
		if (event?.id) {
			reactionsStore.unload(event.id);
		}
	});
</script>

{#if event?.id}
	<div class="flex items-center gap-2 flex-wrap">
		{#if eventReactions.loading && eventReactions.reactions.length === 0}
			<span class="text-gray-500 text-sm">Loading reactions...</span>
		{:else}
			<!-- Display reaction buttons -->
			{#each Array.from(eventReactions.aggregated.entries()) as [emoji, summary]}
				<ReactionButton
					{event}
					{emoji}
					count={summary.count}
					userReacted={summary.userReacted}
				/>
			{/each}
			
			<!-- Add reaction button -->
			<AddReactionButton {event} />
		{/if}
	</div>
{/if}
