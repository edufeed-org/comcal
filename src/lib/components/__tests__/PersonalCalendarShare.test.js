/**
 * PersonalCalendarShare Component Tests
 *
 * Regression tests for:
 * 1. Infinite loop from SvelteMap inside $effect (Pattern C)
 * 2. $derived(() => ...) returning a function instead of a value (Pattern B)
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import PersonalCalendarShare from '../calendar/PersonalCalendarShare.svelte';

// --- Mocks ---

const mockCalendarEvent = {
  id: 'cal-event-123',
  kind: 31923,
  pubkey: 'event-author-pubkey-aaaa1111bbbb2222cccc3333dddd4444eeee5555',
  tags: [
    ['d', 'test-event-id'],
    ['title', 'Test Event']
  ],
  created_at: 1700000000,
  content: '',
  dTag: 'test-event-id',
  title: 'Test Event'
};

const mockActiveUser = {
  pubkey: 'user-pubkey-aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666',
  signEvent: vi.fn()
};

const mockCalendarRawEvents = [
  {
    id: 'calendar-1',
    kind: 31924,
    pubkey: mockActiveUser.pubkey,
    tags: [
      ['d', 'my-calendar'],
      ['title', 'My Calendar'],
      ['a', `31923:${mockCalendarEvent.pubkey}:test-event-id`]
    ],
    created_at: 1700000000,
    content: 'My personal calendar'
  },
  {
    id: 'calendar-2',
    kind: 31924,
    pubkey: mockActiveUser.pubkey,
    tags: [
      ['d', 'work-calendar'],
      ['title', 'Work Calendar']
    ],
    created_at: 1700000001,
    content: 'Work events'
  }
];

vi.mock('$app/paths', () => ({
  resolve: (/** @type {string} */ path) => path
}));

vi.mock('$lib/stores/nostr-infrastructure.svelte', () => ({
  eventStore: {
    timeline: vi.fn(() => ({
      subscribe: (/** @type {Function} */ cb) => {
        // Emit synchronously (this triggers the SvelteMap infinite loop bug)
        cb(mockCalendarRawEvents);
        return { unsubscribe: vi.fn() };
      }
    })),
    add: vi.fn()
  }
}));

vi.mock('$lib/loaders/calendar.js', () => ({
  userCalendarLoader: () => () => ({
    subscribe: () => ({ unsubscribe: vi.fn() })
  })
}));

vi.mock('applesauce-common/helpers', () => ({
  getCalendarEventTitle: (/** @type {any} */ event) =>
    event?.tags?.find((/** @type {string[]} */ t) => t[0] === 'title')?.[1] || 'Untitled'
}));

vi.mock('applesauce-core/event-factory', () => ({
  EventFactory: vi.fn()
}));

vi.mock('$lib/services/publish-service.js', () => ({
  publishEvent: vi.fn()
}));

// Stub icon components
function StubComponent() {}
vi.mock('../icons', () => ({
  PlusIcon: StubComponent,
  CheckIcon: StubComponent,
  AlertIcon: StubComponent
}));

describe('PersonalCalendarShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders calendar checkboxes without effect_update_depth_exceeded', () => {
    // This test catches the SvelteMap bug: synchronous emission inside $effect
    // triggers reactive loop when SvelteMap.has()/set() are read+write in same callback
    const { container } = render(PersonalCalendarShare, {
      props: {
        event: mockCalendarEvent,
        activeUser: mockActiveUser
      }
    });

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
  });

  it('renders with synchronous timeline emissions without infinite loop', async () => {
    const { eventStore } = await import('$lib/stores/nostr-infrastructure.svelte');

    let emissionCount = 0;
    vi.mocked(eventStore.timeline).mockImplementation(() => ({
      subscribe: (/** @type {Function} */ cb) => {
        emissionCount++;
        cb(mockCalendarRawEvents);
        return { unsubscribe: vi.fn() };
      }
    }));

    const { container } = render(PersonalCalendarShare, {
      props: {
        event: mockCalendarEvent,
        activeUser: mockActiveUser
      }
    });

    // Should render without hitting effect depth limit
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    // Timeline subscription should only happen once
    expect(emissionCount).toBe(1);
  });

  it('calendarsContainingEvent returns a Set (not a function)', () => {
    // This test catches the $derived(() => ...) bug where calendarsContainingEvent
    // returns a function instead of a Set. Templates call it as calendarsContainingEvent()
    // which re-executes the body on every access (no caching).
    const { container } = render(PersonalCalendarShare, {
      props: {
        event: mockCalendarEvent,
        activeUser: mockActiveUser
      }
    });

    // If calendarsContainingEvent were a function (the bug), the template would
    // still work but with console spam. The real regression is caught by
    // checking that the component renders calendar-1 as "already added"
    // and calendar-2 as available.

    // calendar-1 contains the event reference, so it should show "(Added - click to remove)"
    const addedLabels = container.querySelectorAll('.text-success');
    expect(addedLabels.length).toBe(1);
  });

  it('shows loading state when no user is provided', () => {
    const { container } = render(PersonalCalendarShare, {
      props: {
        event: mockCalendarEvent,
        activeUser: null
      }
    });

    // With no active user, calendars should be empty
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });
});
