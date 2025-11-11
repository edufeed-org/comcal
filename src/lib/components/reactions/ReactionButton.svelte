<script>
	/**
	 * ReactionButton - Individual pill-style reaction button
	 * Shows emoji and count, highlights if user reacted
	 * @component
	 */
	import { reactionsStore } from '$lib/stores/reactions.svelte.js';
	import { TrashIcon } from '$lib/components/icons';
	import { manager } from '$lib/stores/accounts.svelte.js';
	import { deleteReaction } from '$lib/helpers/reactions.js';
	import { showToast } from '$lib/helpers/toast.js';
	import { appConfig } from '$lib/config.js';
	import * as m from '$lib/paraglide/messages';
	
	/** @type {any} */
	let { event, emoji, count = 0, userReacted = false, userReactionEvent = null } = $props();
	
	let loading = $state(false);
	let isHovering = $state(false);
	
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
	
	// Check if this is the logged-in user's reaction and can be deleted
	let canDelete = $derived(
		userReactionEvent && 
		activeUser && 
		userReactionEvent.pubkey === activeUser.pubkey
	);
	
	async function toggleReaction() {
		if (loading || !isLoggedIn) return;
		
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
			showToast(m.reactions_remove_success(), 'success');
		} catch (error) {
			console.error('Failed to delete reaction:', error);
			showToast(m.reactions_remove_error(), 'error');
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
	disabled={loading || !isLoggedIn}
	class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border backdrop-blur-sm shadow-sm {userReacted 
		? 'bg-blue-900/30 text-blue-300 border-blue-400/60 hover:bg-blue-500/20 hover:border-blue-400/80' 
		: 'bg-gray-800/30 text-gray-300 border-gray-700/50 hover:bg-gray-800/40 hover:border-gray-600/60'}"
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
			aria-label={m.reactions_delete_title()}
		>
			<TrashIcon class="w-3 h-3 text-red-400 hover:text-red-300 transition-colors" />
		</span>
	{/if}
</button>
