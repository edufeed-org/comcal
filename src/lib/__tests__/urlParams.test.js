/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// Mock SvelteKit modules that urlParams.js imports at top level
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: vi.fn((/** @type {string} */ x) => x) }));

const { parseFeedFilters, hasFeedFilters } = await import('$lib/helpers/urlParams.js');

describe('parseFeedFilters', () => {
  it('returns search from URL params', () => {
    const params = new URLSearchParams('search=chemie');
    const filters = parseFeedFilters(params);
    expect(filters.search).toBe('chemie');
  });

  it('defaults search to empty string when absent', () => {
    const params = new URLSearchParams('');
    const filters = parseFeedFilters(params);
    expect(filters.search).toBe('');
  });

  it('returns empty string for empty search param', () => {
    const params = new URLSearchParams('search=');
    const filters = parseFeedFilters(params);
    expect(filters.search).toBe('');
  });

  it('preserves other fields alongside search', () => {
    const params = new URLSearchParams('type=learning&search=chemie&community=abc123');
    const filters = parseFeedFilters(params);
    expect(filters.search).toBe('chemie');
    expect(filters.type).toBe('learning');
    expect(filters.community).toBe('abc123');
  });
});

describe('hasFeedFilters', () => {
  it('returns true when search param is present', () => {
    const params = new URLSearchParams('search=chemie');
    expect(hasFeedFilters(params)).toBe(true);
  });

  it('returns false when no filters are set', () => {
    const params = new URLSearchParams('');
    expect(hasFeedFilters(params)).toBe(false);
  });

  it('returns false when search is empty string', () => {
    const params = new URLSearchParams('search=');
    expect(hasFeedFilters(params)).toBe(false);
  });

  it('returns true when other filters are set without search', () => {
    const params = new URLSearchParams('community=abc123');
    expect(hasFeedFilters(params)).toBe(true);
  });
});
