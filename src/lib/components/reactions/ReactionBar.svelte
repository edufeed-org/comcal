<script>
	/**
	 * ReactionBar - Container for all reactions on an event
	 * Shows existing reactions and add button
	 * Uses applesauce ReactionsModel for reactive queries
	 * @component
	 */
	import { onDestroy } from 'svelte';
	import { reactionsLoader } from '$lib/loaders/reactions.js';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { ReactionsModel } from 'applesauce-core/models';
	import { useActiveUser } from '$lib/stores/accounts.svelte.js';
	import { normalizeReactionContent } from '$lib/helpers/reactions.js';
	import ReactionButton from './ReactionButton.svelte';
	import AddReactionButton from './AddReactionButton.svelte';
	
	/** @type {any} */
	let { event, relays } = $props();
	
	/** @type {any} */
	let loaderSubscription = $state(null);
	/** @type {any} */
	let modelSubscription = $state(null);
	/** @type {any[]} */
	let reactions = $state([]);
	let isLoading = $state(true);
	// Map to track loaded reactions and prevent duplicates
	let loadedReactions = new Map();
	
	// Use reactive getter for active user to ensure proper reactivity on login/logout
	const getActiveUser = useActiveUser();
	
	// Derive aggregated reactions from reactions array
	let aggregated = $derived.by(() => {
		const currentUser = getActiveUser();
		const agg = new Map();
		
		for (const reaction of reactions) {
			const emoji = normalizeReactionContent(reaction.content);
			const existing = agg.get(emoji) || {
				count: 0,
				userReacted: false,
				userReactionEvent: null
			};
			
			const isUserReaction = currentUser && reaction.pubkey === currentUser.pubkey;
			
			agg.set(emoji, {
				count: existing.count + 1,
				userReacted: existing.userReacted || isUserReaction,
				userReactionEvent: isUserReaction ? reaction : existing.userReactionEvent
			});
		}
		
		return agg;
	});
	
	// Load reactions when component mounts or event changes
	$effect(() => {
		if (!event?.id) {
			isLoading = false;
			return;
		}
		
		isLoading = true;
		// Reset the map when event changes
		loadedReactions.clear();
		
		// Subscribe to reactions loader to fetch from relays
		loaderSubscription = reactionsLoader(event, relays).subscribe({
			next: (reaction) => {
			},
			error: (error) => {
				console.error('ReactionBar: Error loading reactions:', error);
				isLoading = false;
			},
			complete: () => {
				isLoading = false;
			}
		});
		
		// Subscribe to ReactionsModel to get reactions from EventStore
		// The model emits an array of reaction events directly
		modelSubscription = eventStore.model(ReactionsModel, event).subscribe((reactionEvents) => {
			
			// Create a Set of current and new reaction IDs for comparison
			const currentIds = new Set(loadedReactions.keys());
			const newIds = new Set((reactionEvents || []).map(r => r.id));
			
			// Check if there's any difference (additions OR removals)
			const hasChanges = 
				currentIds.size !== newIds.size ||
				[...currentIds].some(id => !newIds.has(id)) ||
				[...newIds].some(id => !currentIds.has(id));
			
			if (hasChanges) {
				// Rebuild the map with the new state
				loadedReactions.clear();
				for (const reaction of reactionEvents || []) {
					loadedReactions.set(reaction.id, reaction);
				}
				reactions = Array.from(loadedReactions.values());
			}
		});
		
		return () => {
			if (loaderSubscription) {
				loaderSubscription.unsubscribe();
				loaderSubscription = null;
			}
			if (modelSubscription) {
				modelSubscription.unsubscribe();
				modelSubscription = null;
			}
		};
	});
	
	onDestroy(() => {
		if (loaderSubscription) {
			loaderSubscription.unsubscribe();
		}
		if (modelSubscription) {
			modelSubscription.unsubscribe();
		}
	});
</script>

{#if event?.id}
	<div class="flex items-center gap-2 flex-wrap min-h-[32px]">
		{#if isLoading && reactions.length === 0}
			<!-- Skeleton loader to reserve space and prevent layout shift -->
			<div class="skeleton h-8 w-16 rounded-lg"></div>
			<div class="skeleton h-8 w-16 rounded-lg"></div>
		{:else}
			<!-- Display reaction buttons -->
			{#each Array.from(aggregated.entries()) as [emoji, summary]}
				<ReactionButton
					{event}
					{emoji}
					count={summary.count}
					userReacted={summary.userReacted}
					userReactionEvent={summary.userReactionEvent}
				/>
			{/each}
			
			<!-- Add reaction button -->
			<AddReactionButton {event} />
		{/if}
	</div>
{/if}
