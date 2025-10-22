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
	import { manager } from '$lib/stores/accounts.svelte.js';
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
	
	// Derive aggregated reactions from reactions array
	let aggregated = $derived.by(() => {
		const currentUser = manager.active;
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
		
		console.log('ReactionBar: Loading reactions for event:', event.id);
		isLoading = true;
		// Reset the map when event changes
		loadedReactions.clear();
		
		// Subscribe to reactions loader to fetch from relays
		loaderSubscription = reactionsLoader(event, relays).subscribe({
			next: (reaction) => {
				console.log('ReactionBar: Received reaction from relay:', reaction);
			},
			error: (error) => {
				console.error('ReactionBar: Error loading reactions:', error);
				isLoading = false;
			},
			complete: () => {
				console.log('ReactionBar: Reactions loading complete');
				isLoading = false;
			}
		});
		
		// Subscribe to ReactionsModel to get reactions from EventStore
		// The model emits an array of reaction events directly
		modelSubscription = eventStore.model(ReactionsModel, event).subscribe((reactionEvents) => {
			console.log('ReactionBar: ReactionsModel emitted:', reactionEvents);
			
			// Use deduplication to prevent infinite loop
			// Only update if we have new reactions
			let hasNewReactions = false;
			for (const reaction of reactionEvents || []) {
				if (!loadedReactions.has(reaction.id)) {
					loadedReactions.set(reaction.id, reaction);
					hasNewReactions = true;
				}
			}
			
			// Only update reactions array if there are new reactions
			if (hasNewReactions) {
				reactions = Array.from(loadedReactions.values());
				console.log('ReactionBar: Updated reactions array with new reactions');
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
	<div class="flex items-center gap-2 flex-wrap">
		{#if isLoading && reactions.length === 0}
			<span class="text-gray-500 text-sm">Loading reactions...</span>
		{:else}
			<!-- Display reaction buttons -->
			{#each Array.from(aggregated.entries()) as [emoji, summary]}
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
