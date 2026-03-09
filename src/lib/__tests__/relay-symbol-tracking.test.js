/**
 * Relay Symbol Tracking Tests
 *
 * Tests whether applesauce's Symbol-based relay provenance (getSeenRelays/addSeenRelay)
 * survives the EventStore pipeline. This directly investigates the relay filter bug
 * on /discover where "no content matches" despite correct relay list.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { EventStore } from 'applesauce-core';
import {
  addSeenRelay,
  getSeenRelays,
  normalizeURL,
  fakeVerifyEvent
} from 'applesauce-core/helpers';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';

// Helper: create a valid-looking Nostr event
// v5 EventStore verifies events by default, so we use fakeVerifyEvent
function createMockEvent(/** @type {string} */ id, /** @type {number} */ kind = 1) {
  // IDs must be 64 hex chars for EventStore
  const paddedId = (id || 'test').padEnd(64, '0');
  const event = {
    id: paddedId,
    pubkey: 'deadbeef'.repeat(8),
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags: [],
    content: 'test message',
    sig: 'cafebabe'.repeat(16)
  };
  fakeVerifyEvent(/** @type {any} */ (event));
  return event;
}

describe('Relay Symbol tracking', () => {
  it('should store and retrieve seen relays on a raw event', () => {
    const event = createMockEvent('raw-event');
    const relayUrl = 'wss://relay.example.com/';

    addSeenRelay(/** @type {any} */ (event), relayUrl);
    const seen = getSeenRelays(/** @type {any} */ (event));

    expect(seen).toBeInstanceOf(Set);
    expect(seen?.has(relayUrl)).toBe(true);
  });

  it('should preserve Symbol through EventStore.add()', () => {
    const store = new EventStore();
    const event = createMockEvent('store-add');
    const relayUrl = 'wss://relay.example.com/';

    addSeenRelay(/** @type {any} */ (event), relayUrl);
    store.add(/** @type {any} */ (event));

    const retrieved = store.getEvent(event.id);
    expect(retrieved).toBeDefined();

    const seen = getSeenRelays(/** @type {any} */ (retrieved));
    expect(seen).toBeInstanceOf(Set);
    expect(seen?.has(relayUrl)).toBe(true);
  });

  it('should merge seen relays when duplicate event is added from different relay', () => {
    const store = new EventStore();
    const event1 = createMockEvent('duplicate');
    const event2 = { ...event1 };
    fakeVerifyEvent(/** @type {any} */ (event2)); // Also mark clone as verified

    addSeenRelay(/** @type {any} */ (event1), 'wss://relay1.example.com/');
    addSeenRelay(/** @type {any} */ (event2), 'wss://relay2.example.com/');

    store.add(/** @type {any} */ (event1));
    store.add(/** @type {any} */ (event2));

    const retrieved = store.getEvent(event1.id);
    const seen = getSeenRelays(/** @type {any} */ (retrieved));

    expect(seen).toBeInstanceOf(Set);
    expect(seen?.has('wss://relay1.example.com/')).toBe(true);
    expect(seen?.has('wss://relay2.example.com/')).toBe(true);
  });

  it('should preserve Symbol through timeline() observable', async () => {
    const store = new EventStore();
    const event = createMockEvent('timeline');
    const relayUrl = 'wss://relay.example.com/';

    addSeenRelay(/** @type {any} */ (event), relayUrl);

    // Subscribe first, then add — v5 emits on new inserts
    const eventsPromise = firstValueFrom(
      store.timeline({ kinds: [1] }).pipe(
        filter((arr) => arr.length > 0),
        take(1)
      )
    );
    store.add(/** @type {any} */ (event));

    const events = await eventsPromise;

    expect(events.length).toBeGreaterThan(0);
    const timelineEvent = events[0];
    const seen = getSeenRelays(/** @type {any} */ (timelineEvent));

    expect(seen).toBeInstanceOf(Set);
    expect(seen?.has(relayUrl)).toBe(true);
  });

  it('should preserve Symbol through replaceable() observable', async () => {
    const store = new EventStore();
    const pubkey = 'deadbeef'.repeat(8);
    const event = {
      id: 'replaceable'.padEnd(64, '0'),
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: 30023,
      tags: [['d', 'test-article']],
      content: 'test article',
      sig: 'cafebabe'.repeat(16)
    };
    fakeVerifyEvent(/** @type {any} */ (event));
    const relayUrl = 'wss://relay.example.com/';

    addSeenRelay(/** @type {any} */ (event), relayUrl);

    // Subscribe first, then add — v5 emits on new inserts
    const retrievedPromise = firstValueFrom(
      store.replaceable(30023, pubkey, 'test-article').pipe(
        filter((e) => e !== undefined),
        take(1)
      )
    );
    store.add(/** @type {any} */ (event));

    const retrieved = await retrievedPromise;

    const seen = getSeenRelays(/** @type {any} */ (retrieved));
    expect(seen).toBeInstanceOf(Set);
    expect(seen?.has(relayUrl)).toBe(true);
  });
});

describe('normalizeURL behavior', () => {
  it('should add trailing slash to bare URLs', () => {
    expect(normalizeURL('wss://relay.example.com')).toBe('wss://relay.example.com/');
  });

  it('should lowercase hostname', () => {
    const normalized = normalizeURL('wss://RELAY.Example.COM');
    expect(normalized).toBe('wss://relay.example.com/');
  });

  it('should preserve paths', () => {
    const normalized = normalizeURL('wss://relay.example.com/path');
    expect(normalized).toContain('/path');
  });

  it('should produce consistent output for matching URLs', () => {
    const url1 = normalizeURL('wss://relay.example.com');
    const url2 = normalizeURL('wss://relay.example.com/');
    expect(url1).toBe(url2);
  });
});

describe('Wrapped event pattern (custom model simulation)', () => {
  it('should preserve Symbol when accessed via rawEvent property', () => {
    const store = new EventStore();
    const event = createMockEvent('wrapped-raw');
    const relayUrl = 'wss://relay.example.com/';

    addSeenRelay(/** @type {any} */ (event), relayUrl);
    store.add(/** @type {any} */ (event));

    // Simulate how AMBResourceModel wraps events
    const wrapped = {
      type: 'article',
      data: {
        title: 'Test',
        rawEvent: event
      }
    };

    const extractedEvent =
      /** @type {any} */ (wrapped).data?.rawEvent ||
      /** @type {any} */ (wrapped).data?.originalEvent ||
      wrapped.data;
    const seen = getSeenRelays(/** @type {any} */ (extractedEvent));

    expect(seen).toBeInstanceOf(Set);
    expect(seen?.has(relayUrl)).toBe(true);
  });

  it('should preserve Symbol when accessed via originalEvent property', () => {
    const event = createMockEvent('wrapped-original');
    const relayUrl = 'wss://relay.example.com/';

    addSeenRelay(/** @type {any} */ (event), relayUrl);

    // Simulate how GlobalCalendarEventModel wraps events
    const wrapped = {
      type: 'calendar',
      data: {
        title: 'Test Event',
        originalEvent: event
      }
    };

    const extractedEvent =
      /** @type {any} */ (wrapped).data?.rawEvent ||
      /** @type {any} */ (wrapped).data?.originalEvent ||
      wrapped.data;
    const seen = getSeenRelays(/** @type {any} */ (extractedEvent));

    expect(seen).toBeInstanceOf(Set);
    expect(seen?.has(relayUrl)).toBe(true);
  });

  it('should match relay URL using normalizeURL in filter pattern', () => {
    const event = createMockEvent('filter-pattern');
    const relayUrl = 'wss://relay.example.com/';

    addSeenRelay(/** @type {any} */ (event), relayUrl);

    const wrapped = {
      type: 'article',
      data: { rawEvent: event }
    };

    // Exact replica of the filter logic in discover/+page.svelte
    const relayFilter = 'wss://relay.example.com'; // Without trailing slash (as dropdown might provide)
    const normalizedFilter = normalizeURL(relayFilter);
    const extractedEvent =
      /** @type {any} */ (wrapped).data?.rawEvent ||
      /** @type {any} */ (wrapped).data?.originalEvent ||
      wrapped.data;
    const match = getSeenRelays(/** @type {any} */ (extractedEvent))?.has(normalizedFilter);

    expect(match).toBe(true);
  });
});

describe('JavaScript Proxy behavior with Symbols (Svelte 5 $state simulation)', () => {
  it('should preserve Symbol access through a basic Proxy', () => {
    const event = createMockEvent('proxy-basic');
    addSeenRelay(/** @type {any} */ (event), 'wss://relay.example.com/');

    // Create a basic proxy like Svelte 5 $state does
    const proxy = new Proxy(event, {
      get(target, prop, receiver) {
        return Reflect.get(target, prop, receiver);
      }
    });

    const seen = getSeenRelays(/** @type {any} */ (proxy));
    expect(seen).toBeInstanceOf(Set);
    expect(seen?.has('wss://relay.example.com/')).toBe(true);
  });

  it('should throw when Set.prototype.has is called on a deep-proxied Set', () => {
    // This documents WHY $state.raw() is needed: deep proxies break Set methods.
    // The Set is returned through the proxy, but Set.prototype.has requires
    // `this` to be a real Set, not a Proxy wrapping a Set.
    const event = createMockEvent('proxy-nested');
    addSeenRelay(/** @type {any} */ (event), 'wss://relay.example.com/');

    const wrapped = { type: 'amb', data: { rawEvent: event } };
    const deepProxy = createDeepProxy(wrapped);

    const extractedEvent =
      deepProxy.data?.rawEvent || deepProxy.data?.originalEvent || deepProxy.data;
    const seen = getSeenRelays(/** @type {any} */ (extractedEvent));

    // The Symbol IS accessible through the proxy
    expect(seen).toBeDefined();

    // But calling Set methods on the proxied Set throws
    expect(() => /** @type {Set<string>} */ (seen).has('wss://relay.example.com/')).toThrow(
      'Method Set.prototype.has called on incompatible receiver'
    );
  });

  it('should throw when filtering proxied array elements by relay', () => {
    // This documents the exact bug on /discover: $state() deep-proxies event data,
    // making getSeenRelays().has() throw on the proxied Set.
    const event1 = createMockEvent('proxy-arr-1');
    addSeenRelay(/** @type {any} */ (event1), 'wss://relay1.example.com/');

    const items = createDeepProxy([{ type: 'amb', data: { rawEvent: event1 } }]);

    expect(() => {
      const ambEvent = items[0].data?.rawEvent || items[0].data?.originalEvent || items[0].data;
      getSeenRelays(/** @type {any} */ (ambEvent))?.has('wss://relay1.example.com/');
    }).toThrow('Method Set.prototype.has called on incompatible receiver');
  });
});

describe('Fix verification: non-proxied access (simulating $state.raw)', () => {
  it('should work correctly when events are NOT wrapped in a deep proxy', () => {
    const event = createMockEvent('raw-state');
    addSeenRelay(/** @type {any} */ (event), 'wss://relay.example.com/');

    // Simulate $state.raw() - no proxy wrapping, just the plain array
    const items = [{ type: 'amb', data: { rawEvent: event } }];

    // This is the exact relay filter logic from discover/+page.svelte
    const relayFilter = 'wss://relay.example.com';
    const normalizedFilter = normalizeURL(relayFilter);
    const filtered = items.filter((item) => {
      const evt =
        /** @type {any} */ (item).data?.rawEvent ||
        /** @type {any} */ (item).data?.originalEvent ||
        item.data;
      return getSeenRelays(/** @type {any} */ (evt))?.has(normalizedFilter);
    });

    expect(filtered.length).toBe(1);
  });

  it('should FAIL when events ARE wrapped in a deep proxy (documenting the bug)', () => {
    const event = createMockEvent('proxied-state');
    addSeenRelay(/** @type {any} */ (event), 'wss://relay.example.com/');

    // Simulate $state() - deep proxy wrapping
    const items = createDeepProxy([{ type: 'amb', data: { rawEvent: event } }]);

    const relayFilter = 'wss://relay.example.com';
    const normalizedFilter = normalizeURL(relayFilter);

    // This should throw because Set.prototype.has fails on proxied Set
    expect(() => {
      items.filter((/** @type {any} */ item) => {
        const evt = item.data?.rawEvent || item.data?.originalEvent || item.data;
        return getSeenRelays(/** @type {any} */ (evt))?.has(normalizedFilter);
      });
    }).toThrow('Method Set.prototype.has called on incompatible receiver');
  });
});

// Helper: create a deep reactive proxy similar to Svelte 5's $state
function createDeepProxy(/** @type {any} */ obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      // Recursively proxy nested objects (like Svelte 5 does)
      if (value !== null && typeof value === 'object') {
        return createDeepProxy(value);
      }
      return value;
    }
  });
}
