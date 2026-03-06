/**
 * Kanban board loading utilities for kind 30301 board definitions.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { getKanbanRelays } from '$lib/helpers/relay-helper.js';
import { timedPool } from './base.js';
import { applyCuratedFilter } from '$lib/services/curated-authors-service.svelte.js';

/**
 * Factory: Create a stateful timeline loader for kind 30301 kanban boards with automatic pagination
 * @param {number} limit - Maximum number of boards to load per batch
 * @returns {Function} Stateful timeline loader function (call with no args, returns Observable)
 */
export function kanbanTimelineLoader(limit = 20) {
  const filter = applyCuratedFilter({ kinds: [30301] });
  return createTimelineLoader(timedPool, getKanbanRelays(), filter, { eventStore, limit });
}
