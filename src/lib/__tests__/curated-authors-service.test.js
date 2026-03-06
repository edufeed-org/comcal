/**
 * Curated Authors Service Tests
 *
 * Tests the core logic of the per-category curated authors service:
 * - naddr decoding
 * - direct pubkey parsing (hex + npub)
 * - p-tag extraction from follow sets
 * - getCuratedAuthors(category) behavior when configured vs not
 * - applyCuratedFilter() auto-category-detection utility
 * - per-category isolation
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock nostr-tools/nip19 and dependencies before importing the service
vi.mock('nostr-tools', () => ({
  nip19: {
    decode: vi.fn()
  }
}));

vi.mock('$lib/stores/nostr-infrastructure.svelte', () => ({
  pool: { request: vi.fn() },
  eventStore: { add: vi.fn() }
}));

vi.mock('$lib/stores/config.svelte.js', () => ({
  runtimeConfig: {
    curatedMode: {
      calendar: { sets: [], direct: [] },
      communikey: { sets: [], direct: [] },
      educational: { sets: [], direct: [] },
      longform: { sets: [], direct: [] },
      kanban: { sets: [], direct: [] }
    }
  }
}));

vi.mock('$lib/helpers/relay-helper.js', () => ({
  getAllLookupRelays: vi.fn(() => ['wss://relay.example.com'])
}));

vi.mock('$lib/services/app-relay-service.svelte.js', () => ({
  kindToAppRelayCategory: vi.fn((kind) => {
    if ([31922, 31923, 31924, 31925].includes(kind)) return 'calendar';
    if ([10222, 30222, 30382].includes(kind)) return 'communikey';
    if ([30142].includes(kind)) return 'educational';
    if ([30023].includes(kind)) return 'longform';
    if ([30301, 30302, 8571].includes(kind)) return 'kanban';
    return null;
  })
}));

describe('curated-authors-service', () => {
  describe('decodeNaddrs', () => {
    let decodeNaddrs;
    let nip19Mock;

    beforeEach(async () => {
      vi.resetModules();
      const nostrTools = await import('nostr-tools');
      nip19Mock = nostrTools.nip19;
      const service = await import('../services/curated-authors-service.svelte.js');
      decodeNaddrs = service.decodeNaddrs;
    });

    it('should decode valid naddr for kind 30000', () => {
      nip19Mock.decode.mockReturnValue({
        type: 'naddr',
        data: {
          kind: 30000,
          pubkey: 'abc123',
          identifier: 'curated-list',
          relays: ['wss://relay1.example.com']
        }
      });

      const result = decodeNaddrs(['naddr1valid']);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        pubkey: 'abc123',
        identifier: 'curated-list',
        relays: ['wss://relay1.example.com']
      });
    });

    it('should skip non-naddr identifiers', () => {
      nip19Mock.decode.mockReturnValue({
        type: 'npub',
        data: 'abc123'
      });

      const result = decodeNaddrs(['npub1invalid']);
      expect(result).toHaveLength(0);
    });

    it('should skip naddr with wrong kind', () => {
      nip19Mock.decode.mockReturnValue({
        type: 'naddr',
        data: {
          kind: 30001,
          pubkey: 'abc123',
          identifier: 'wrong-kind',
          relays: []
        }
      });

      const result = decodeNaddrs(['naddr1wrongkind']);
      expect(result).toHaveLength(0);
    });

    it('should handle decode errors gracefully', () => {
      nip19Mock.decode.mockImplementation(() => {
        throw new Error('Invalid bech32');
      });

      const result = decodeNaddrs(['invalid-naddr']);
      expect(result).toHaveLength(0);
    });

    it('should use empty relays array when naddr has no relay hints', () => {
      nip19Mock.decode.mockReturnValue({
        type: 'naddr',
        data: {
          kind: 30000,
          pubkey: 'abc123',
          identifier: 'list',
          relays: undefined
        }
      });

      const result = decodeNaddrs(['naddr1nohints']);
      expect(result[0].relays).toEqual([]);
    });

    it('should handle multiple naddrs and skip invalid ones', () => {
      nip19Mock.decode
        .mockReturnValueOnce({
          type: 'naddr',
          data: { kind: 30000, pubkey: 'pub1', identifier: 'list1', relays: [] }
        })
        .mockImplementationOnce(() => {
          throw new Error('bad');
        })
        .mockReturnValueOnce({
          type: 'naddr',
          data: { kind: 30000, pubkey: 'pub2', identifier: 'list2', relays: ['wss://r.com'] }
        });

      const result = decodeNaddrs(['valid1', 'invalid', 'valid2']);
      expect(result).toHaveLength(2);
      expect(result[0].pubkey).toBe('pub1');
      expect(result[1].pubkey).toBe('pub2');
    });
  });

  describe('parseDirectPubkeys', () => {
    let parseDirectPubkeys;
    let nip19Mock;

    beforeEach(async () => {
      vi.resetModules();
      const nostrTools = await import('nostr-tools');
      nip19Mock = nostrTools.nip19;
      const service = await import('../services/curated-authors-service.svelte.js');
      parseDirectPubkeys = service.parseDirectPubkeys;
    });

    it('should pass through valid 64-char hex pubkeys', () => {
      const hex = 'a'.repeat(64);
      const result = parseDirectPubkeys([hex]);
      expect(result).toEqual([hex]);
    });

    it('should lowercase hex pubkeys', () => {
      const hex = 'A'.repeat(64);
      const result = parseDirectPubkeys([hex]);
      expect(result).toEqual(['a'.repeat(64)]);
    });

    it('should decode npub to hex', () => {
      nip19Mock.decode.mockReturnValue({
        type: 'npub',
        data: 'decoded_hex_pubkey_' + '0'.repeat(45)
      });

      const result = parseDirectPubkeys(['npub1abc123']);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('decoded_hex_pubkey_' + '0'.repeat(45));
      expect(nip19Mock.decode).toHaveBeenCalledWith('npub1abc123');
    });

    it('should skip invalid npub that fails to decode', () => {
      nip19Mock.decode.mockImplementation(() => {
        throw new Error('Invalid bech32');
      });

      const result = parseDirectPubkeys(['npub1invalid']);
      expect(result).toHaveLength(0);
    });

    it('should skip entries that are not hex or npub', () => {
      const result = parseDirectPubkeys(['not-a-pubkey', 'abc', '12345']);
      expect(result).toHaveLength(0);
    });

    it('should skip empty and whitespace-only entries', () => {
      const result = parseDirectPubkeys(['', '  ', '\t']);
      expect(result).toHaveLength(0);
    });

    it('should trim whitespace from entries', () => {
      const hex = 'b'.repeat(64);
      const result = parseDirectPubkeys(['  ' + hex + '  ']);
      expect(result).toEqual([hex]);
    });

    it('should handle mixed valid and invalid entries', () => {
      const hex = 'c'.repeat(64);
      nip19Mock.decode.mockReturnValue({
        type: 'npub',
        data: 'd'.repeat(64)
      });

      const result = parseDirectPubkeys([hex, 'npub1valid', 'invalid', '']);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(hex);
      expect(result[1]).toBe('d'.repeat(64));
    });

    it('should warn and skip npub that decodes to non-npub type', () => {
      nip19Mock.decode.mockReturnValue({
        type: 'nprofile',
        data: { pubkey: 'abc' }
      });

      const result = parseDirectPubkeys(['npub1actuallynprofile']);
      expect(result).toHaveLength(0);
    });
  });

  describe('extractPubkeysFromFollowSets', () => {
    let extractPubkeysFromFollowSets;

    beforeEach(async () => {
      vi.resetModules();
      const service = await import('../services/curated-authors-service.svelte.js');
      extractPubkeysFromFollowSets = service.extractPubkeysFromFollowSets;
    });

    it('should extract unique p-tag pubkeys from events', () => {
      const events = [
        {
          tags: [
            ['p', 'pubkey1'],
            ['p', 'pubkey2'],
            ['d', 'list-name']
          ]
        },
        {
          tags: [
            ['p', 'pubkey2'],
            ['p', 'pubkey3']
          ]
        }
      ];

      const result = extractPubkeysFromFollowSets(/** @type {any} */ (events));
      expect(result).toHaveLength(3);
      expect(result).toContain('pubkey1');
      expect(result).toContain('pubkey2');
      expect(result).toContain('pubkey3');
    });

    it('should return empty array for events with no p-tags', () => {
      const events = [
        {
          tags: [
            ['d', 'list-name'],
            ['t', 'tag']
          ]
        }
      ];

      const result = extractPubkeysFromFollowSets(/** @type {any} */ (events));
      expect(result).toHaveLength(0);
    });

    it('should deduplicate pubkeys across multiple events', () => {
      const events = [
        { tags: [['p', 'same-pubkey']] },
        { tags: [['p', 'same-pubkey']] },
        { tags: [['p', 'same-pubkey']] }
      ];

      const result = extractPubkeysFromFollowSets(/** @type {any} */ (events));
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('same-pubkey');
    });

    it('should skip p-tags without a value', () => {
      const events = [{ tags: [['p'], ['p', 'valid']] }];

      const result = extractPubkeysFromFollowSets(/** @type {any} */ (events));
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('valid');
    });
  });

  describe('isCuratedModeConfigured', () => {
    it('should return false when both sources are empty for category', async () => {
      vi.resetModules();
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');
      expect(service.isCuratedModeConfigured('calendar')).toBe(false);
    });

    it('should return true when sets has entries for category', async () => {
      vi.resetModules();
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: ['naddr1...'], direct: [] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');
      expect(service.isCuratedModeConfigured('calendar')).toBe(true);
    });

    it('should return true when direct has entries for category', async () => {
      vi.resetModules();
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: ['a'.repeat(64)] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');
      expect(service.isCuratedModeConfigured('calendar')).toBe(true);
    });

    it('should return true when both sources have entries for category', async () => {
      vi.resetModules();
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: ['naddr1...'], direct: ['a'.repeat(64)] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');
      expect(service.isCuratedModeConfigured('calendar')).toBe(true);
    });
  });

  describe('getCuratedAuthors', () => {
    it('should return null when not configured for category', async () => {
      vi.resetModules();
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');
      expect(service.getCuratedAuthors('calendar')).toBeNull();
    });

    it('should lazily parse direct pubkeys on first access for a category', async () => {
      vi.resetModules();
      const hexPubkey = 'a'.repeat(64);
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [hexPubkey] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      const result = service.getCuratedAuthors('calendar');
      expect(result).toEqual([hexPubkey]);
    });
  });

  describe('isAllowedAuthor', () => {
    it('should return true when curated mode is not active for category', async () => {
      vi.resetModules();
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');
      expect(service.isAllowedAuthor('calendar', 'any-pubkey')).toBe(true);
    });

    it('should filter authors per category', async () => {
      vi.resetModules();
      const hexPubkey = 'b'.repeat(64);
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [hexPubkey] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      expect(service.isAllowedAuthor('calendar', hexPubkey)).toBe(true);
      expect(service.isAllowedAuthor('calendar', 'c'.repeat(64))).toBe(false);
    });
  });

  describe('per-category isolation', () => {
    it('should not leak authors between categories', async () => {
      vi.resetModules();
      const calendarPubkey = 'a'.repeat(64);
      const educationalPubkey = 'b'.repeat(64);
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [calendarPubkey] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [educationalPubkey] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      // Calendar should have its own pubkey
      expect(service.getCuratedAuthors('calendar')).toEqual([calendarPubkey]);
      // Educational should have its own pubkey
      expect(service.getCuratedAuthors('educational')).toEqual([educationalPubkey]);
      // Communikey should have no filtering
      expect(service.getCuratedAuthors('communikey')).toBeNull();
      // Longform should have no filtering
      expect(service.getCuratedAuthors('longform')).toBeNull();
    });

    it('should allow different pubkeys per category', async () => {
      vi.resetModules();
      const calendarPubkey = 'a'.repeat(64);
      const educationalPubkey = 'b'.repeat(64);
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [calendarPubkey] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [educationalPubkey] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      // Calendar pubkey is NOT allowed in educational
      expect(service.isAllowedAuthor('educational', calendarPubkey)).toBe(false);
      // Educational pubkey is NOT allowed in calendar
      expect(service.isAllowedAuthor('calendar', educationalPubkey)).toBe(false);
      // Unconfigured categories allow everyone
      expect(service.isAllowedAuthor('communikey', calendarPubkey)).toBe(true);
    });
  });

  describe('applyCuratedFilter', () => {
    it('should add authors when curated mode is active for the kind category', async () => {
      vi.resetModules();
      const hexPubkey = 'a'.repeat(64);
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [hexPubkey] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      const result = service.applyCuratedFilter({ kinds: [30142] });
      expect(result.authors).toEqual([hexPubkey]);
    });

    it('should not modify filter when no kinds provided', async () => {
      vi.resetModules();
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: ['a'.repeat(64)] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      const filter = { limit: 50 };
      const result = service.applyCuratedFilter(filter);
      expect(result).toBe(filter); // Same reference, unmodified
    });

    it('should not modify filter for unmapped kind', async () => {
      vi.resetModules();
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: ['a'.repeat(64)] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      const filter = { kinds: [99999] };
      const result = service.applyCuratedFilter(filter);
      expect(result).toBe(filter);
    });

    it('should not override explicit authors filter', async () => {
      vi.resetModules();
      const hexPubkey = 'a'.repeat(64);
      const explicitAuthor = 'b'.repeat(64);
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [hexPubkey] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      const filter = { kinds: [31922], authors: [explicitAuthor] };
      const result = service.applyCuratedFilter(filter);
      expect(result).toBe(filter); // Same reference, unmodified
      expect(result.authors).toEqual([explicitAuthor]);
    });

    it('should fall through when authors is empty array (no UI filter)', async () => {
      vi.resetModules();
      const hexPubkey = 'a'.repeat(64);
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [hexPubkey] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      // Empty authors array means "no UI filter selected" — should apply curated
      const filter = { kinds: [31922], authors: [] };
      const result = service.applyCuratedFilter(filter);
      expect(result.authors).toEqual([hexPubkey]);
    });

    it('should not modify filter when category has no curated config', async () => {
      vi.resetModules();
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      const filter = { kinds: [30142] };
      const result = service.applyCuratedFilter(filter);
      expect(result).toBe(filter);
    });

    it('should preserve other filter fields when adding authors', async () => {
      vi.resetModules();
      const hexPubkey = 'a'.repeat(64);
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [hexPubkey] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      const result = service.applyCuratedFilter({ kinds: [30142], search: 'test', limit: 50 });
      expect(result.authors).toEqual([hexPubkey]);
      expect(result.search).toBe('test');
      expect(result.limit).toBe(50);
      expect(result.kinds).toEqual([30142]);
    });
  });

  describe('_resetForTesting', () => {
    it('should reset a specific category', async () => {
      vi.resetModules();
      const hexPubkey = 'a'.repeat(64);
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [hexPubkey] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [hexPubkey] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      // Initialize both
      expect(service.getCuratedAuthors('calendar')).toEqual([hexPubkey]);
      expect(service.getCuratedAuthors('educational')).toEqual([hexPubkey]);

      // Reset only calendar
      service._resetForTesting('calendar');
      // Calendar re-initializes from config on next access
      expect(service.getCuratedAuthors('calendar')).toEqual([hexPubkey]);
      // Educational should still work
      expect(service.getCuratedAuthors('educational')).toEqual([hexPubkey]);
    });

    it('should reset all categories when no argument', async () => {
      vi.resetModules();
      const hexPubkey = 'a'.repeat(64);
      vi.doMock('$lib/stores/config.svelte.js', () => ({
        runtimeConfig: {
          curatedMode: {
            calendar: { sets: [], direct: [hexPubkey] },
            communikey: { sets: [], direct: [] },
            educational: { sets: [], direct: [hexPubkey] },
            longform: { sets: [], direct: [] },
            kanban: { sets: [], direct: [] }
          }
        }
      }));
      const service = await import('../services/curated-authors-service.svelte.js');

      // Initialize both
      service.getCuratedAuthors('calendar');
      service.getCuratedAuthors('educational');

      // Reset all
      service._resetForTesting();
      // Both should re-initialize from config
      expect(service.getCuratedAuthors('calendar')).toEqual([hexPubkey]);
      expect(service.getCuratedAuthors('educational')).toEqual([hexPubkey]);
    });
  });
});
