<script>
	/**
	 * AddReactionButton - Plus button that opens the emoji picker
	 * @component
	 */
	import ReactionPicker from './ReactionPicker.svelte';
	import { SmilePlusIcon } from '$lib/components/icons';
	import { manager } from '$lib/stores/accounts.svelte.js';
	
	/** @type {any} */
	let { event } = $props();
	
	let showPicker = $state(false);
	
	// Track active user with direct subscription for proper reactivity
	let activeUser = $state(manager.active);
	
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});
	
	// Check if user is logged in
	let isLoggedIn = $derived(!!activeUser);
</script>

<button
	type="button"
	onclick={() => isLoggedIn && (showPicker = true)}
	disabled={!isLoggedIn}
	class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600 bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:border-gray-500"
	title={isLoggedIn ? "Add reaction" : "Login to add reaction"}
>
	<SmilePlusIcon class="w-4 h-4" />
</button>

{#if showPicker}
	<ReactionPicker {event} onClose={() => showPicker = false} />
{/if}
