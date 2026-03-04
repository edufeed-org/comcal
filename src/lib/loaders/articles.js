/**
 * Article loading utilities for kind 30023 long-form content.
 */
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { getArticleRelays } from '$lib/helpers/relay-helper.js';
import { timedPool } from './base.js';
import { getCuratedAuthors } from '$lib/services/curated-authors-service.svelte.js';

/**
 * Factory: Create a stateful timeline loader for kind 30023 articles with automatic pagination
 * The returned loader function automatically tracks state and fetches the next chronological block on each call
 * @param {number} limit - Maximum number of articles to load per batch
 * @returns {Function} Stateful timeline loader function (call with no args, returns Observable)
 */
export function articleTimelineLoader(limit = 20) {
  /** @type {import('nostr-tools').Filter} */
  const filter = { kinds: [30023] };
  const authors = getCuratedAuthors();
  if (authors) filter.authors = authors;
  return createTimelineLoader(timedPool, getArticleRelays(), filter, { eventStore, limit });
}
