/**
 * Content Types Tests
 *
 * Tests CONTENT_TYPE_CONFIG, kindToContentType, and getCommunityAvailableContentTypes.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  CONTENT_TYPE_CONFIG,
  kindToContentType,
  getCommunityAvailableContentTypes
} from '$lib/helpers/contentTypes.js';

describe('CONTENT_TYPE_CONFIG', () => {
  it('has entry for kind 30818 (wikis)', () => {
    const config = CONTENT_TYPE_CONFIG[30818];
    expect(config).toBeDefined();
    expect(config.kind).toBe(30818);
    expect(config.name).toBe('Wikis');
    expect(config.supported).toBe(true);
    expect(config.component).toBe('WikisView');
  });
});

describe('kindToContentType', () => {
  it('maps 30818 to wikis', () => {
    expect(kindToContentType(30818)).toBe('wikis');
  });

  it('maps known kinds correctly', () => {
    expect(kindToContentType(9)).toBe('chat');
    expect(kindToContentType(30023)).toBe('articles');
    expect(kindToContentType(30142)).toBe('learning');
    expect(kindToContentType(31923)).toBe('calendar');
  });

  it('returns null for unknown kinds', () => {
    expect(kindToContentType(99999)).toBeNull();
  });
});

describe('getCommunityAvailableContentTypes', () => {
  it('includes wikis when community event has kind 30818', () => {
    const communityEvent = {
      tags: [
        ['content', 'Wikis'],
        ['k', '30818']
      ]
    };

    const result = getCommunityAvailableContentTypes(communityEvent);
    const wikiEntry = result.find((ct) => ct.kind === 30818);

    expect(wikiEntry).toBeDefined();
    expect(/** @type {any} */ (wikiEntry).name).toBe('Wikis');
    expect(/** @type {any} */ (wikiEntry).supported).toBe(true);
    expect(/** @type {any} */ (wikiEntry).enabled).toBe(true);
  });

  it('does not include wikis when community event lacks kind 30818', () => {
    const communityEvent = {
      tags: [
        ['content', 'Chat'],
        ['k', '9']
      ]
    };

    const result = getCommunityAvailableContentTypes(communityEvent);
    const wikiEntry = result.find((ct) => ct.kind === 30818);

    expect(wikiEntry).toBeUndefined();
  });
});
