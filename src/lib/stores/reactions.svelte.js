/**
 * Reactions store using Svelte 5 runes
 * Manages reactive state for NIP-25 reactions across the application
 */
import { reactionsLoader } from '$lib/loaders/reactions.js';
import { normalizeReactionContent, publishReaction, deleteReaction } from '$lib/helpers/reactions.js';
import { manager } from './accounts.svelte.js';
import { appConfig } from '$lib/config.js';
import { showToast } from '$lib/helpers/toast.js';

/**
 * @typedef {Object} ReactionSummary
 * @property {number} count - Number of reactions
 * @property {boolean} userReacted - Whether current user reacted
 * @property {any} [userReactionEvent] - The user's reaction event if they reacted
 */

/**
 * @typedef {Object} EventReactions
 * @property {any[]} reactions - All reaction events
 * @property {Map<string, ReactionSummary>} aggregated - Aggregated by emoji
 * @property {boolean} loading - Whether reactions are loading
 */

class ReactionsStore {
	/** @type {Map<string, EventReactions>} */
	#reactionsMap = $state(new Map());
	
	/** @type {Map<string, any>} */
	#subscriptions = new Map();

	/**
	 * Get reactions for an event
	 * @param {string} eventId - The event ID
	 * @returns {EventReactions}
	 */
	getReactions(eventId) {
		return this.#reactionsMap.get(eventId) || {
			reactions: [],
			aggregated: new Map(),
			loading: false
		};
	}

	/**
	 * Load reactions for an event
	 * @param {any} event - The event to load reactions for
	 * @param {string[]} [relays] - Optional relay list
	 */
	loadReactions(event, relays) {
		if (!event?.id) return;

		// Check if already loading
		if (this.#subscriptions.has(event.id)) {
			return;
		}

		// Initialize loading state
		this.#reactionsMap.set(event.id, {
			reactions: [],
			aggregated: new Map(),
			loading: true
		});

		// Get relay list
		const relaySources = relays || appConfig.calendar.defaultRelays;

		// Subscribe to reactions
		const subscription = reactionsLoader(event, relaySources).subscribe({
			next: (reactionEvent) => {
				this.#addReaction(event.id, reactionEvent);
			},
			error: (error) => {
				console.error('Error loading reactions:', error);
				const current = this.#reactionsMap.get(event.id);
				if (current) {
					this.#reactionsMap.set(event.id, {
						...current,
						loading: false
					});
				}
			},
			complete: () => {
				const current = this.#reactionsMap.get(event.id);
				if (current) {
					this.#reactionsMap.set(event.id, {
						...current,
						loading: false
					});
				}
			}
		});

		this.#subscriptions.set(event.id, subscription);
	}

	/**
	 * Add a reaction to the store
	 * @param {string} eventId - The event ID
	 * @param {any} reactionEvent - The reaction event
	 */
	#addReaction(eventId, reactionEvent) {
		const current = this.#reactionsMap.get(eventId);
		if (!current) return;

		// Check if reaction already exists
		const exists = current.reactions.some(r => r.id === reactionEvent.id);
		if (exists) return;

		// Add reaction
		const newReactions = [...current.reactions, reactionEvent];
		const aggregated = this.#aggregateReactions(newReactions);

		this.#reactionsMap.set(eventId, {
			reactions: newReactions,
			aggregated,
			loading: current.loading
		});
	}

	/**
	 * Aggregate reactions by emoji
	 * @param {any[]} reactions - Array of reaction events
	 * @returns {Map<string, ReactionSummary>}
	 */
	#aggregateReactions(reactions) {
		// eslint-disable-next-line no-undef
		const aggregated = new Map();
		const currentUser = manager.active;

		for (const reaction of reactions) {
			const emoji = normalizeReactionContent(reaction.content);
			const existing = aggregated.get(emoji) || {
				count: 0,
				userReacted: false,
				userReactionEvent: null
			};

			const isUserReaction = currentUser && reaction.pubkey === currentUser.pubkey;

			aggregated.set(emoji, {
				count: existing.count + 1,
				userReacted: existing.userReacted || isUserReaction,
				userReactionEvent: isUserReaction ? reaction : existing.userReactionEvent
			});
		}

		return aggregated;
	}

	/**
	 * React to an event
	 * @param {any} event - The event to react to
	 * @param {string} emoji - The emoji to react with
	 * @param {string[]} [relays] - Optional relay list
	 */
	async react(event, emoji, relays) {
		if (!event?.id) {
			throw new Error('Invalid event');
		}

		const currentUser = manager.active;
		if (!currentUser) {
			showToast('Please sign in to react', 'error');
			throw new Error('No active account');
		}

		try {
			// Check if already reacted with this emoji
			const current = this.#reactionsMap.get(event.id);
			const normalizedEmoji = normalizeReactionContent(emoji);
			
			if (current) {
				const summary = current.aggregated.get(normalizedEmoji);
				if (summary?.userReacted) {
					showToast('You already reacted with this emoji', 'info');
					return;
				}
			}

			// Publish the reaction
			const result = await publishReaction(event, emoji, { relays });
			
			if (result.success) {
				// Optimistically add to store
				this.#addReaction(event.id, result.event);
				showToast('Reaction added!', 'success');
			} else {
				throw new Error('Failed to publish reaction');
			}
		} catch (error) {
			console.error('Failed to react:', error);
			showToast('Failed to add reaction', 'error');
			throw error;
		}
	}

	/**
	 * Remove a reaction
	 * @param {any} event - The event that was reacted to
	 * @param {string} emoji - The emoji to remove
	 * @param {string[]} [relays] - Optional relay list
	 */
	async unreact(event, emoji, relays) {
		if (!event?.id) {
			throw new Error('Invalid event');
		}

		const currentUser = manager.active;
		if (!currentUser) {
			throw new Error('No active account');
		}

		try {
			const current = this.#reactionsMap.get(event.id);
			if (!current) return;

			const normalizedEmoji = normalizeReactionContent(emoji);
			const summary = current.aggregated.get(normalizedEmoji);

			if (!summary?.userReacted || !summary.userReactionEvent) {
				return;
			}

			// Delete the reaction
			await deleteReaction(summary.userReactionEvent, 'Reaction removed', { relays });

			// Remove from store
			const newReactions = current.reactions.filter(
				r => r.id !== summary.userReactionEvent.id
			);
			const aggregated = this.#aggregateReactions(newReactions);

			this.#reactionsMap.set(event.id, {
				reactions: newReactions,
				aggregated,
				loading: false
			});

			showToast('Reaction removed', 'success');
		} catch (error) {
			console.error('Failed to remove reaction:', error);
			showToast('Failed to remove reaction', 'error');
			throw error;
		}
	}

	/**
	 * Unload reactions for an event (cleanup)
	 * @param {string} eventId - The event ID
	 */
	unload(eventId) {
		const subscription = this.#subscriptions.get(eventId);
		if (subscription) {
			subscription.unsubscribe();
			this.#subscriptions.delete(eventId);
		}
		this.#reactionsMap.delete(eventId);
	}

	/**
	 * Clear all reactions
	 */
	clear() {
		for (const subscription of this.#subscriptions.values()) {
			subscription.unsubscribe();
		}
		this.#subscriptions.clear();
		this.#reactionsMap.clear();
	}
}

// Export singleton instance
export const reactionsStore = new ReactionsStore();
