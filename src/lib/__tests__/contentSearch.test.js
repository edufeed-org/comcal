/**
 * Content Search Helper Tests
 *
 * Tests matchesTextSearch() for correct text matching across content types:
 * - AMB resources: name, description, keywords, subjects[].label, creatorNames, author profile
 * - Articles: title, summary, author profile
 * - Calendar events: title, summary, locations, author profile
 * - Kanban boards: title, description, author profile
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { matchesTextSearch } from '../helpers/contentSearch.js';

/** @param {Partial<Record<string, string>>} [overrides] */
function makeProfile(overrides = {}) {
  return { name: 'Alice', display_name: 'Alice Wonderland', ...overrides };
}

/**
 * @param {string} pubkey
 * @param {any} profile
 */
function makeProfiles(pubkey, profile) {
  const map = new Map();
  map.set(pubkey, profile);
  return map;
}

const PK = 'abc123';

describe('matchesTextSearch', () => {
  describe('AMB items', () => {
    /** @param {Record<string, any>} [overrides] */
    function makeAMB(overrides = {}) {
      return {
        type: 'amb',
        data: {
          pubkey: PK,
          name: 'Physics Course',
          description: 'An intro to physics',
          keywords: ['quantum', 'mechanics'],
          subjects: [
            { id: 'https://example.com/physics', label: 'Physik' },
            { id: 'https://example.com/math', label: 'Mathematik' }
          ],
          creatorNames: ['Dr. Schmidt'],
          ...overrides
        }
      };
    }

    it('matches on name', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeAMB(), 'physics', profiles)).toBe(true);
    });

    it('matches on description', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeAMB(), 'intro', profiles)).toBe(true);
    });

    it('matches on keywords', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeAMB(), 'quantum', profiles)).toBe(true);
    });

    it('matches on subject labels', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeAMB(), 'physik', profiles)).toBe(true);
    });

    it('matches on creatorNames', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeAMB(), 'schmidt', profiles)).toBe(true);
    });

    it('matches on author profile name', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeAMB(), 'alice', profiles)).toBe(true);
    });

    it('matches on author display_name', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeAMB(), 'wonderland', profiles)).toBe(true);
    });

    it('does NOT match when query is in none of the fields', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeAMB(), 'blockchain', profiles)).toBe(false);
    });

    it('handles missing optional fields gracefully', () => {
      const item = makeAMB({ keywords: undefined, subjects: undefined, creatorNames: undefined });
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(item, 'physics', profiles)).toBe(true);
      expect(matchesTextSearch(item, 'blockchain', profiles)).toBe(false);
    });

    it('is case insensitive', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeAMB(), 'QUANTUM', profiles)).toBe(true);
      expect(matchesTextSearch(makeAMB(), 'PHYSIK', profiles)).toBe(true);
    });
  });

  describe('article items', () => {
    function makeArticle(overrides = {}) {
      return {
        type: 'article',
        data: {
          pubkey: PK,
          tags: [
            ['title', 'Sermon on the Mount'],
            ['summary', 'A deep dive into scripture']
          ],
          ...overrides
        }
      };
    }

    it('matches on title tag', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeArticle(), 'sermon', profiles)).toBe(true);
    });

    it('matches on summary tag', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeArticle(), 'scripture', profiles)).toBe(true);
    });

    it('matches on author name', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeArticle(), 'alice', profiles)).toBe(true);
    });

    it('does NOT match unrelated query', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeArticle(), 'blockchain', profiles)).toBe(false);
    });
  });

  describe('event items', () => {
    function makeEvent(overrides = {}) {
      return {
        type: 'event',
        data: {
          pubkey: PK,
          title: 'Community Meetup',
          summary: 'Monthly gathering',
          locations: ['Berlin', 'Cafe Central'],
          ...overrides
        }
      };
    }

    it('matches on title', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeEvent(), 'meetup', profiles)).toBe(true);
    });

    it('matches on summary', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeEvent(), 'gathering', profiles)).toBe(true);
    });

    it('matches on locations', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeEvent(), 'berlin', profiles)).toBe(true);
    });

    it('matches on author name', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeEvent(), 'wonderland', profiles)).toBe(true);
    });

    it('does NOT match unrelated query', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeEvent(), 'blockchain', profiles)).toBe(false);
    });
  });

  describe('board items', () => {
    function makeBoard(overrides = {}) {
      return {
        type: 'board',
        data: {
          pubkey: PK,
          tags: [
            ['title', 'Project Board'],
            ['description', 'Track tasks and progress']
          ],
          ...overrides
        }
      };
    }

    it('matches on title tag', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeBoard(), 'project', profiles)).toBe(true);
    });

    it('matches on description tag', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeBoard(), 'tasks', profiles)).toBe(true);
    });

    it('matches on author name', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeBoard(), 'alice', profiles)).toBe(true);
    });

    it('does NOT match unrelated query', () => {
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(makeBoard(), 'blockchain', profiles)).toBe(false);
    });
  });

  describe('unknown type', () => {
    it('returns false for unknown item types', () => {
      const item = { type: 'unknown', data: { pubkey: PK } };
      const profiles = makeProfiles(PK, makeProfile());
      expect(matchesTextSearch(item, 'anything', profiles)).toBe(false);
    });
  });

  describe('missing profile', () => {
    it('still matches on data fields when profile is missing', () => {
      const item = {
        type: 'amb',
        data: { pubkey: 'no-profile', name: 'Physics', description: '', keywords: [] }
      };
      expect(matchesTextSearch(item, 'physics', new Map())).toBe(true);
    });

    it('does not crash when profile map is empty', () => {
      const item = {
        type: 'amb',
        data: { pubkey: 'no-profile', name: '', description: '' }
      };
      expect(matchesTextSearch(item, 'something', new Map())).toBe(false);
    });
  });
});
