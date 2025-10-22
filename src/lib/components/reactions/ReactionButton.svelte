<script>
	/**
	 * ReactionButton - Individual pill-style reaction button
	 * Shows emoji and count, highlights if user reacted
	 * @component
	 */
	import { reactionsStore } from '$lib/stores/reactions.svelte.js';
	import { TrashIcon } from '$lib/components/icons';
	import { useActiveUser } from '$lib/stores/accounts.svelte.js';
	import { deleteReaction } from '$lib/helpers/reactions.js';
	import { showToast } from '$lib/helpers/toast.js';
	import { appConfig } from '$lib/config.js';
	
	/** @type {any} */
	let { event, emoji, count = 0, userReacted = false, userReactionEvent = null } = $props();
	
	let loading = $state(false);
	let isHovering = $state(false);
	
	// Use reactive getter for active user to ensure proper reactivity on login/logout
	const getActiveUser = useActiveUser();
	
	// Check if this is the logged-in user's reaction and can be deleted
	let canDelete = $derived(
		userReactionEvent && 
		getActiveUser() && 
		userReactionEvent.pubkey === getActiveUser().pubkey
	);
	
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
	
	async function handleDelete() {
		if (loading || !canDelete) return;
		loading = true;
		try {
			// Delete the reaction event using the helper
			await deleteReaction(userReactionEvent, {
				relays: appConfig.calendar.defaultRelays
			});
			showToast('Reaction removed', 'success');
		} catch (error) {
			console.error('Failed to delete reaction:', error);
			showToast('Failed to remove reaction', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<button
	type="button"
	onclick={toggleReaction}
	onmouseenter={() => isHovering = true}
	onmouseleave={() => isHovering = false}
	disabled={loading}
	class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border {userReacted 
		? 'bg-blue-500/20 text-blue-400 border-blue-500 hover:bg-blue-500/30' 
		: 'bg-gray-700/50 text-gray-300 border-gray-600 hover:bg-gray-700'}"
>
	<span class="text-base leading-none">{emoji}</span>
	{#if count > 0}
		<span class="font-medium text-xs">{count}</span>
	{/if}
	
	{#if canDelete && isHovering}
		<span
			role="button"
			tabindex="0"
			onclick={(e) => {
				e.stopPropagation();
				handleDelete();
			}}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					e.stopPropagation();
					handleDelete();
				}
			}}
			class="ml-0.5 cursor-pointer transition-opacity inline-flex items-center"
			aria-label="Delete reaction"
		>
			<TrashIcon class="w-3 h-3 text-red-400 hover:text-red-300 transition-colors" />
		</span>
	{/if}
</button>
