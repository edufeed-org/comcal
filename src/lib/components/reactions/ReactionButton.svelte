<script>
	/**
	 * ReactionButton - Individual pill-style reaction button
	 * Shows emoji and count, highlights if user reacted
	 * @component
	 */
	import { reactionsStore } from '$lib/stores/reactions.svelte.js';
	
	/** @type {any} */
	let { event, emoji, count = 0, userReacted = false } = $props();
	
	let loading = $state(false);
	
	async function toggleReaction() {
		if (loading) return;
		
		loading = true;
		try {
			if (userReacted) {
				await reactionsStore.unreact(event, emoji);
			} else {
				await reactionsStore.react(event, emoji);
			}
		} catch (error) {
			console.error('Failed to toggle reaction:', error);
		} finally {
			loading = false;
		}
	}
</script>

<button
	type="button"
	onclick={toggleReaction}
	disabled={loading}
	class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border {userReacted 
		? 'bg-blue-500/20 text-blue-400 border-blue-500 hover:bg-blue-500/30' 
		: 'bg-gray-700/50 text-gray-300 border-gray-600 hover:bg-gray-700'}"
>
	<span class="text-base leading-none">{emoji}</span>
	{#if count > 0}
		<span class="font-medium text-xs">{count}</span>
	{/if}
</button>
