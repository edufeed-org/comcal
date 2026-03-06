/**
 * Community Content Model Factory Tests
 *
 * Tests the generic createCommunityContentModel factory and CommunityBoardModel.
 * Pure RxJS logic — no DOM, no network, no relays.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import {
  createCommunityContentModel,
  CommunityBoardModel,
  CommunityAMBResourceModel,
  CommunityCalendarEventModel,
  CommunityArticleModel
} from '$lib/models/community-content.js';

const COMMUNITY_PUBKEY = 'community123';

/**
 * Create a mock event
 * @param {Partial<{id: string, kind: number, pubkey: string, tags: string[][], created_at: number, content: string}>} overrides
 */
function mockEvent(overrides = {}) {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    kind: overrides.kind || 30142,
    pubkey: overrides.pubkey || 'author1',
    tags: overrides.tags || [],
    created_at: overrides.created_at || Math.floor(Date.now() / 1000),
    content: overrides.content || ''
  };
}

/**
 * Create a mock EventStore that returns predefined observables for model() calls.
 *
 * @param {Object} opts
 * @param {any[]} opts.direct - Direct community events (h-tagged)
 * @param {any[]} opts.shares - Targeted publication events (kind 30222)
 * @param {any[]} opts.all - All events of the content kind
 */
function createMockEventStore({ direct = [], shares = [], all = [] }) {
  return {
    model: (ModelClass, filter) => {
      // Detect which stream based on filter
      if (filter.kinds?.includes(30222) || filter['#k']) {
        return of(shares);
      }
      if (filter['#h']) {
        return of(direct);
      }
      // All events stream (no #h, no #k)
      return of(all);
    }
  };
}

describe('createCommunityContentModel', () => {
  it('returns direct community content (h-tagged events)', () => {
    const event1 = mockEvent({ kind: 30142, tags: [['h', COMMUNITY_PUBKEY]] });
    const event2 = mockEvent({ kind: 30142, tags: [['h', COMMUNITY_PUBKEY]] });

    const store = createMockEventStore({
      direct: [event1, event2],
      shares: [],
      all: [event1, event2]
    });

    const Model = createCommunityContentModel([30142]);
    const model$ = Model(COMMUNITY_PUBKEY)(store);

    let result;
    model$.subscribe((items) => (result = items));

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toContain(event1.id);
    expect(result.map((r) => r.id)).toContain(event2.id);
  });

  it('resolves targeted publication references by event ID (e-tag)', () => {
    const referencedEvent = mockEvent({ id: 'event-abc', kind: 30142 });
    const shareEvent = mockEvent({
      kind: 30222,
      tags: [
        ['p', COMMUNITY_PUBKEY],
        ['e', 'event-abc'],
        ['k', '30142']
      ]
    });

    const store = createMockEventStore({
      direct: [],
      shares: [shareEvent],
      all: [referencedEvent]
    });

    const Model = createCommunityContentModel([30142]);
    let result;
    Model(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('event-abc');
  });

  it('resolves targeted publication references by address (a-tag)', () => {
    const referencedEvent = mockEvent({
      id: 'event-xyz',
      kind: 30142,
      pubkey: 'author1',
      tags: [['d', 'my-resource']]
    });
    const shareEvent = mockEvent({
      kind: 30222,
      tags: [
        ['p', COMMUNITY_PUBKEY],
        ['a', '30142:author1:my-resource'],
        ['k', '30142']
      ]
    });

    const store = createMockEventStore({
      direct: [],
      shares: [shareEvent],
      all: [referencedEvent]
    });

    const Model = createCommunityContentModel([30142]);
    let result;
    Model(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('event-xyz');
  });

  it('deduplicates — direct content takes priority over shares', () => {
    const event = mockEvent({
      id: 'dup-event',
      kind: 30142,
      tags: [
        ['h', COMMUNITY_PUBKEY],
        ['d', 'dup']
      ]
    });
    const shareEvent = mockEvent({
      kind: 30222,
      tags: [
        ['p', COMMUNITY_PUBKEY],
        ['e', 'dup-event'],
        ['k', '30142']
      ]
    });

    const store = createMockEventStore({
      direct: [event],
      shares: [shareEvent],
      all: [event]
    });

    const Model = createCommunityContentModel([30142]);
    let result;
    Model(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    // Should appear only once despite being both direct and shared
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('dup-event');
  });

  it('applies optional transform function', () => {
    const event = mockEvent({ kind: 30142, tags: [['h', COMMUNITY_PUBKEY]] });

    const store = createMockEventStore({
      direct: [event],
      shares: [],
      all: [event]
    });

    const transform = (e) => ({ ...e, transformed: true });
    const Model = createCommunityContentModel([30142], { transform });
    let result;
    Model(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(1);
    expect(result[0].transformed).toBe(true);
    expect(result[0].id).toBe(event.id);
  });

  it('applies transform to shared (resolved) events too', () => {
    const referencedEvent = mockEvent({ id: 'shared-event', kind: 30142 });
    const shareEvent = mockEvent({
      kind: 30222,
      tags: [
        ['p', COMMUNITY_PUBKEY],
        ['e', 'shared-event'],
        ['k', '30142']
      ]
    });

    const store = createMockEventStore({
      direct: [],
      shares: [shareEvent],
      all: [referencedEvent]
    });

    const transform = (e) => ({ ...e, transformed: true });
    const Model = createCommunityContentModel([30142], { transform });
    let result;
    Model(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(1);
    expect(result[0].transformed).toBe(true);
  });

  it('returns empty array when no content exists', () => {
    const store = createMockEventStore({
      direct: [],
      shares: [],
      all: []
    });

    const Model = createCommunityContentModel([30142]);
    let result;
    Model(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toEqual([]);
  });

  it('ignores share events whose references are not in the store', () => {
    const shareEvent = mockEvent({
      kind: 30222,
      tags: [
        ['p', COMMUNITY_PUBKEY],
        ['e', 'nonexistent-id'],
        ['k', '30142']
      ]
    });

    const store = createMockEventStore({
      direct: [],
      shares: [shareEvent],
      all: [] // referenced event not loaded
    });

    const Model = createCommunityContentModel([30142]);
    let result;
    Model(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toEqual([]);
  });
});

describe('CommunityBoardModel', () => {
  it('works with kind 30301 board events', () => {
    const board = mockEvent({
      kind: 30301,
      tags: [
        ['h', COMMUNITY_PUBKEY],
        ['d', 'my-board'],
        ['title', 'Sprint Board']
      ]
    });

    const store = createMockEventStore({
      direct: [board],
      shares: [],
      all: [board]
    });

    // Override mock store to handle kind 30301 filters correctly
    store.model = (ModelClass, filter) => {
      if (filter.kinds?.includes(30222)) return of([]);
      if (filter['#h']) return of([board]);
      return of([board]);
    };

    let result;
    CommunityBoardModel(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(board.id);
  });

  it('resolves board targeted publications', () => {
    const board = mockEvent({
      kind: 30301,
      pubkey: 'boardauthor',
      tags: [['d', 'sprint-1']]
    });
    const share = mockEvent({
      kind: 30222,
      tags: [
        ['p', COMMUNITY_PUBKEY],
        ['a', '30301:boardauthor:sprint-1'],
        ['k', '30301']
      ]
    });

    const store = {
      model: (ModelClass, filter) => {
        if (filter.kinds?.includes(30222)) return of([share]);
        if (filter['#h']) return of([]);
        return of([board]);
      }
    };

    let result;
    CommunityBoardModel(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(board.id);
  });
});

describe('CommunityAMBResourceModel', () => {
  it('returns formatted AMB resources for kind 30142', () => {
    const resource = mockEvent({
      kind: 30142,
      tags: [
        ['h', COMMUNITY_PUBKEY],
        ['d', 'res-1'],
        ['name', 'Test Resource']
      ]
    });

    const store = createMockEventStore({
      direct: [resource],
      shares: [],
      all: [resource]
    });

    let result;
    CommunityAMBResourceModel(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(resource.id);
    // formatAMBResource adds 'name' field from tags
    expect(result[0]).toHaveProperty('name');
  });

  it('resolves shared AMB resources via targeted publications', () => {
    const resource = mockEvent({
      id: 'amb-shared',
      kind: 30142,
      pubkey: 'author1',
      tags: [['d', 'shared-res']]
    });
    const share = mockEvent({
      kind: 30222,
      tags: [
        ['p', COMMUNITY_PUBKEY],
        ['a', '30142:author1:shared-res'],
        ['k', '30142']
      ]
    });

    const store = createMockEventStore({
      direct: [],
      shares: [share],
      all: [resource]
    });

    let result;
    CommunityAMBResourceModel(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('amb-shared');
  });
});

describe('CommunityCalendarEventModel', () => {
  it('returns formatted calendar events for kinds 31922 and 31923', () => {
    const dateEvent = mockEvent({
      kind: 31922,
      tags: [
        ['h', COMMUNITY_PUBKEY],
        ['d', 'cal-1'],
        ['title', 'All Day Event'],
        ['start', '2025-01-15']
      ]
    });
    const timeEvent = mockEvent({
      kind: 31923,
      tags: [
        ['h', COMMUNITY_PUBKEY],
        ['d', 'cal-2'],
        ['title', 'Timed Event'],
        ['start', '1705334400']
      ]
    });

    const store = {
      model: (ModelClass, filter) => {
        if (filter.kinds?.includes(30222)) return of([]);
        if (filter['#h']) return of([dateEvent, timeEvent]);
        return of([dateEvent, timeEvent]);
      }
    };

    let result;
    CommunityCalendarEventModel(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(2);
    // getCalendarEventMetadata adds 'title' field
    expect(result.map((r) => r.title)).toContain('All Day Event');
    expect(result.map((r) => r.title)).toContain('Timed Event');
  });

  it('resolves shared calendar events via targeted publications', () => {
    const calEvent = mockEvent({
      id: 'cal-shared',
      kind: 31923,
      pubkey: 'author1',
      tags: [
        ['d', 'shared-cal'],
        ['title', 'Shared Event'],
        ['start', '1705334400']
      ]
    });
    const share = mockEvent({
      kind: 30222,
      tags: [
        ['p', COMMUNITY_PUBKEY],
        ['e', 'cal-shared'],
        ['k', '31923']
      ]
    });

    const store = {
      model: (ModelClass, filter) => {
        if (filter.kinds?.includes(30222)) return of([share]);
        if (filter['#h']) return of([]);
        return of([calEvent]);
      }
    };

    let result;
    CommunityCalendarEventModel(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cal-shared');
  });
});

describe('CommunityArticleModel', () => {
  it('returns articles for kind 30023 without transform', () => {
    const article = mockEvent({
      kind: 30023,
      tags: [
        ['h', COMMUNITY_PUBKEY],
        ['d', 'article-1'],
        ['title', 'My Article']
      ],
      content: '# Hello World'
    });

    const store = {
      model: (ModelClass, filter) => {
        if (filter.kinds?.includes(30222)) return of([]);
        if (filter['#h']) return of([article]);
        return of([article]);
      }
    };

    let result;
    CommunityArticleModel(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(1);
    // No transform — raw event returned
    expect(result[0].id).toBe(article.id);
    expect(result[0].content).toBe('# Hello World');
  });

  it('resolves shared articles via targeted publications', () => {
    const article = mockEvent({
      id: 'article-shared',
      kind: 30023,
      pubkey: 'author1',
      tags: [['d', 'shared-art']]
    });
    const share = mockEvent({
      kind: 30222,
      tags: [
        ['p', COMMUNITY_PUBKEY],
        ['a', '30023:author1:shared-art'],
        ['k', '30023']
      ]
    });

    const store = {
      model: (ModelClass, filter) => {
        if (filter.kinds?.includes(30222)) return of([share]);
        if (filter['#h']) return of([]);
        return of([article]);
      }
    };

    let result;
    CommunityArticleModel(COMMUNITY_PUBKEY)(store).subscribe((items) => (result = items));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('article-shared');
  });
});
