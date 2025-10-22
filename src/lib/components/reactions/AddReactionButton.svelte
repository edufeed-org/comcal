<script>
	/**
	 * AddReactionButton - Plus button that opens the emoji picker
	 * @component
	 */
	import ReactionPicker from './ReactionPicker.svelte';
	import { PlusIcon } from '$lib/components/icons';
	
	/** @type {any} */
	let { event } = $props();
	
	let showPicker = $state(false);
</script>

<button
	type="button"
	onclick={() => showPicker = true}
	class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all hover:scale-105 active:scale-95 border border-gray-600 bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:border-gray-500"
	title="Add reaction"
>
	<PlusIcon class_="w-4 h-4" />
</button>

{#if showPicker}
	<ReactionPicker {event} onClose={() => showPicker = false} />
{/if}
