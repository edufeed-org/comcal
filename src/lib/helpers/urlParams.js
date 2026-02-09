/**
 * URL Parameter Management Utilities
 *
 * Provides helpers for managing query parameters in SvelteKit applications,
 * specifically for calendar filter state management.
 */

import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

/**
 * Update URL query parameters while preserving others
 *
 * @param {URLSearchParams} currentParams - Current URL params from $page.url.searchParams
 * @param {Object} updates - Key-value pairs to update. Use array for multiple values.
 * @param {Object} [options] - Navigation options
 * @param {boolean} [options.replaceState=true] - Replace current history entry
 * @param {boolean} [options.keepFocus=true] - Keep focus on current element
 * @param {boolean} [options.noScroll=true] - Don't scroll to top
 * @returns {Promise<void>} - Navigation promise
 *
 * @example
 * // Single value
 * updateQueryParams(params, { view: 'list', search: 'bitcoin' });
 *
 * // Multiple values (repeated keys)
 * updateQueryParams(params, {
 *   tags: ['bitcoin', 'nostr', 'conference'],
 *   relays: ['wss://relay.damus.io', 'wss://nos.lol']
 * });
 *
 * // Remove parameter (pass null, undefined, empty string, or empty array)
 * updateQueryParams(params, { search: null, tags: [] });
 */
export function updateQueryParams(currentParams, updates, options = {}) {
  const params = new URLSearchParams(currentParams);

  Object.entries(updates).forEach(([key, value]) => {
    // Delete existing values for this key
    params.delete(key);

    // Add new value(s)
    if (Array.isArray(value)) {
      // Multiple values (tags, relays, authors) - use repeated keys
      value.forEach((v) => {
        if (v !== null && v !== undefined && v !== '') {
          params.append(key, v);
        }
      });
    } else if (value !== null && value !== undefined && value !== '') {
      // Single value (view, search)
      params.set(key, value);
    }
    // If value is null/undefined/empty string/empty array, param is removed
  });

  const queryString = params.toString();
  // Always include pathname - resolve() needs a proper path, not just query string
  const pathname = window.location.pathname;
  const url = queryString ? `${pathname}?${queryString}` : pathname;

  return goto(resolve(url), {
    replaceState: options.replaceState ?? true,
    keepFocus: options.keepFocus ?? true,
    noScroll: options.noScroll ?? true
  });
}

/**
 * Parse calendar filter parameters from URL
 *
 * @param {URLSearchParams} searchParams - URL search params from $page.url.searchParams
 * @returns {Object} - Parsed filter state
 *
 * @example
 * const filters = parseCalendarFilters($page.url.searchParams);
 * // Returns: {
 * //   view: 'list',
 * //   period: 'month',
 * //   tags: ['bitcoin', 'nostr'],
 * //   relays: ['wss://relay.damus.io'],
 * //   authors: ['npub1...'],
 * //   search: 'conference'
 * // }
 */
export function parseCalendarFilters(searchParams) {
  return {
    view: searchParams.get('view') || 'calendar',
    period: searchParams.get('period') || 'month',
    tags: searchParams.getAll('tags'),
    relays: searchParams.getAll('relays'),
    authors: searchParams.getAll('authors'),
    search: searchParams.get('search') || ''
  };
}

/**
 * Build calendar URL with specified filters
 *
 * @param {Object} filters - Filter parameters
 * @param {string} [filters.view] - Presentation view mode
 * @param {string} [filters.period] - Time period (month/week/day/all)
 * @param {string[]} [filters.tags] - Tag filters
 * @param {string[]} [filters.relays] - Relay filters
 * @param {string[]} [filters.authors] - Author filters
 * @param {string} [filters.search] - Search query
 * @param {string} [basePath='/calendar'] - Base path for URL
 * @returns {string} - Complete URL with query parameters
 *
 * @example
 * const url = buildCalendarURL({
 *   view: 'list',
 *   period: 'all',
 *   tags: ['bitcoin', 'nostr'],
 *   search: 'conference'
 * });
 * // Returns: '/calendar?view=list&period=all&tags=bitcoin&tags=nostr&search=conference'
 */
export function buildCalendarURL(filters, basePath = '/calendar') {
  const params = new URLSearchParams();

  // Add view mode
  if (filters.view && filters.view !== 'calendar') {
    params.set('view', filters.view);
  }

  // Add period (time range)
  if (filters.period && filters.period !== 'month') {
    params.set('period', filters.period);
  }

  // Add tags (repeated keys)
  if (filters.tags && filters.tags.length > 0) {
    filters.tags.forEach((tag) => params.append('tags', tag));
  }

  // Add relays (repeated keys)
  if (filters.relays && filters.relays.length > 0) {
    filters.relays.forEach((relay) => params.append('relays', relay));
  }

  // Add authors (repeated keys)
  if (filters.authors && filters.authors.length > 0) {
    filters.authors.forEach((author) => params.append('authors', author));
  }

  // Add search query
  if (filters.search) {
    params.set('search', filters.search);
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * Check if URL has any active filters
 *
 * @param {URLSearchParams} searchParams - URL search params
 * @returns {boolean} - True if any filters are active
 */
export function hasActiveFilters(searchParams) {
  return (
    searchParams.getAll('tags').length > 0 ||
    searchParams.getAll('relays').length > 0 ||
    searchParams.getAll('authors').length > 0 ||
    (searchParams.get('search') !== null && searchParams.get('search') !== '') ||
    (searchParams.get('view') !== null && searchParams.get('view') !== 'calendar') ||
    (searchParams.get('period') !== null && searchParams.get('period') !== 'month')
  );
}

/**
 * Clear all filters from URL
 *
 * @param {string} [basePath='/calendar'] - Base path to navigate to
 * @param {Object} [options] - Navigation options
 * @param {boolean} [options.replaceState] - Replace current history entry
 * @param {boolean} [options.keepFocus] - Keep focus on current element
 * @param {boolean} [options.noScroll] - Don't scroll to top
 * @returns {Promise<void>} - Navigation promise
 */
export function clearAllFilters(basePath = '/calendar', options = {}) {
  return goto(resolve(basePath), {
    replaceState: options.replaceState ?? true,
    keepFocus: options.keepFocus ?? true,
    noScroll: options.noScroll ?? false // Allow scroll to top when clearing
  });
}

// ============================================================
// Feed Page URL Parameter Functions
// ============================================================

/**
 * @typedef {Object} FeedFilters
 * @property {string[]} tags - Tag filters
 * @property {string | null} community - Community filter (pubkey, 'joined', or null)
 * @property {string} type - Content type filter ('all', 'events', 'learning', 'articles', 'communities')
 */

/**
 * Parse feed filter parameters from URL
 *
 * @param {URLSearchParams} searchParams - URL search params from $page.url.searchParams
 * @returns {FeedFilters} - Parsed filter state
 *
 * @example
 * const filters = parseFeedFilters($page.url.searchParams);
 * // Returns: {
 * //   tags: ['bitcoin', 'nostr'],
 * //   community: 'abc123' | 'joined' | null,
 * //   type: 'all' | 'events' | 'learning' | 'articles' | 'communities'
 * // }
 */
export function parseFeedFilters(searchParams) {
  return {
    tags: searchParams.getAll('tags'),
    community: searchParams.get('community') || null,
    type: searchParams.get('type') || 'all'
  };
}

/**
 * Build feed URL with specified filters
 *
 * @param {Object} filters - Filter parameters
 * @param {string[]} [filters.tags] - Tag filters
 * @param {string | null} [filters.community] - Community filter (pubkey, 'joined', or null)
 * @param {string} [basePath='/discover'] - Base path for URL
 * @returns {string} - Complete URL with query parameters
 *
 * @example
 * const url = buildFeedURL({
 *   tags: ['education', 'nostr'],
 *   community: 'joined'
 * });
 * // Returns: '/discover?tags=education&tags=nostr&community=joined'
 */
export function buildFeedURL(filters, basePath = '/discover') {
  const params = new URLSearchParams();

  // Add tags (repeated keys)
  if (filters.tags && filters.tags.length > 0) {
    filters.tags.forEach((tag) => params.append('tags', tag));
  }

  // Add community filter
  if (filters.community) {
    params.set('community', filters.community);
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * Check if feed URL has any active filters
 *
 * @param {URLSearchParams} searchParams - URL search params
 * @returns {boolean} - True if any filters are active
 */
export function hasFeedFilters(searchParams) {
  return searchParams.getAll('tags').length > 0 || searchParams.get('community') !== null;
}
