/**
 * NIP-50 Search Loader for Educational Content (kind 30142)
 *
 * Uses the specialized AMB relay with Typesense backend for full-text search.
 * Uses applesauce's createTimelineLoader with the shared RelayPool for consistency
 * with the rest of the application.
 */
import { Observable } from 'rxjs';
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { getEducationalRelays } from '$lib/helpers/relay-helper.js';
import { buildSearchQuery, hasActiveFilters } from '$lib/helpers/educational/searchQueryBuilder.js';
import { timedPool } from './base.js';

/**
 * @typedef {import('$lib/helpers/educational/searchQueryBuilder.js').SearchFilters} SearchFilters
 */

/**
 * Create a search loader for AMB resources using NIP-50 full-text search
 *
 * Returns a stateful loader function that fetches results from the AMB relay.
 * The loader returns an Observable that emits individual events as they arrive.
 *
 * @param {SearchFilters} filters - The search filters
 * @param {number} limit - Maximum number of results
 * @returns {import('rxjs').Observable<import('nostr-tools').Event>} Observable that emits search results
 */
export function ambSearchLoader(filters, limit = 50) {
  // If no filters are active, return an empty observable that completes immediately
  if (!hasActiveFilters(filters)) {
    return new Observable((subscriber) => {
      subscriber.complete();
    });
  }

  // Build the NIP-50 search query
  const searchQuery = buildSearchQuery(filters);

  if (!searchQuery) {
    return new Observable((subscriber) => {
      subscriber.complete();
    });
  }

  console.log('🔍 AMB Search: Querying with:', searchQuery);

  // Use applesauce's createTimelineLoader with NIP-50 search filter
  // This properly serializes the REQ message according to Nostr protocol
  const loader = createTimelineLoader(
    timedPool,
    getEducationalRelays(),
    {
      kinds: [30142],
      search: searchQuery
    },
    { eventStore, limit }
  );

  // Return the loader function called immediately to get the Observable
  return loader();
}

/**
 * Create a reactive search loader that can be called multiple times with updated filters
 * Returns a function that triggers a new search when called
 *
 * @param {number} limit - Maximum number of results per search
 * @returns {(filters: SearchFilters) => import('rxjs').Observable<import('nostr-tools').Event>}
 */
export function createAMBSearchLoader(limit = 50) {
  return (filters) => ambSearchLoader(filters, limit);
}
