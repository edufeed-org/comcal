/**
 * Kanban board loading utilities for kind 30301 board definitions.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { getKanbanRelays } from '$lib/helpers/relay-helper.js';
import { timedPool } from './base.js';
import { getCuratedAuthors } from '$lib/services/curated-authors-service.svelte.js';

/**
 * Factory: Create a stateful timeline loader for kind 30301 kanban boards with automatic pagination
 * @param {number} limit - Maximum number of boards to load per batch
 * @returns {Function} Stateful timeline loader function (call with no args, returns Observable)
 */
export function kanbanTimelineLoader(limit = 20) {
  /** @type {import('nostr-tools').Filter} */
  const filter = { kinds: [30301] };
  const authors = getCuratedAuthors();
  if (authors) filter.authors = authors;
  return createTimelineLoader(timedPool, getKanbanRelays(), filter, { eventStore, limit });
}
