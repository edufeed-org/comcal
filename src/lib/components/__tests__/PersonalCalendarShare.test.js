/**
 * PersonalCalendarShare Component Tests
 *
 * Regression tests for:
 * 1. Infinite loop from SvelteMap inside $effect (Pattern C)
 * 2. $derived(() => ...) returning a function instead of a value (Pattern B)
 * 3. DRY consolidation: uses shared calendar management store
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

/** @type {import('$lib/stores/calendar-management-store.svelte.js').Calendar[]} */
const mockCalendars = [
  {
    id: 'calendar-1',
    kind: 31924,
    pubkey: mockActiveUser.pubkey,
    title: 'My Calendar',
    description: 'My personal calendar',
    dTag: 'my-calendar',
    eventReferences: [`31923:${mockCalendarEvent.pubkey}:test-event-id`],
    createdAt: 1700000000,
    originalEvent: {
      id: 'calendar-1',
      kind: 31924,
      pubkey: mockActiveUser.pubkey,
      tags: [
        ['d', 'my-calendar'],
        ['title', 'My Calendar'],
        ['a', `31923:${mockCalendarEvent.pubkey}:test-event-id`]
      ],
      created_at: 1700000000,
      content: 'My personal calendar',
      sig: 'mock-sig-1'
    }
  },
  {
    id: 'calendar-2',
    kind: 31924,
    pubkey: mockActiveUser.pubkey,
    title: 'Work Calendar',
    description: 'Work events',
    dTag: 'work-calendar',
    eventReferences: [],
    createdAt: 1700000001,
    originalEvent: {
      id: 'calendar-2',
      kind: 31924,
      pubkey: mockActiveUser.pubkey,
      tags: [
        ['d', 'work-calendar'],
        ['title', 'Work Calendar']
      ],
      created_at: 1700000001,
      content: 'Work events',
      sig: 'mock-sig-2'
    }
  }
];

vi.mock('$app/paths', () => ({
  resolve: (/** @type {string} */ path) => path
}));

const mockAddEventToCalendar = vi.fn().mockResolvedValue(true);
const mockRemoveEventFromCalendar = vi.fn().mockResolvedValue(true);

vi.mock('$lib/stores/calendar-management-store.svelte.js', () => ({
  useCalendarManagement: vi.fn(() => ({
    calendars: mockCalendars,
    loading: false,
    error: null,
    addEventToCalendar: mockAddEventToCalendar,
    removeEventFromCalendar: mockRemoveEventFromCalendar,
    refresh: vi.fn(),
    destroy: vi.fn()
  }))
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
    const { container } = render(PersonalCalendarShare, {
      props: {
        event: mockCalendarEvent,
        activeUser: mockActiveUser
      }
    });

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
  });

  it('renders with shared store data without infinite loop', async () => {
    const { useCalendarManagement } = await import(
      '$lib/stores/calendar-management-store.svelte.js'
    );

    const { container } = render(PersonalCalendarShare, {
      props: {
        event: mockCalendarEvent,
        activeUser: mockActiveUser
      }
    });

    // Should render without hitting effect depth limit
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);

    // Store should be called with the active user's pubkey
    expect(useCalendarManagement).toHaveBeenCalledWith(mockActiveUser.pubkey);
  });

  it('calendarsContainingEvent returns a Set (not a function)', () => {
    const { container } = render(PersonalCalendarShare, {
      props: {
        event: mockCalendarEvent,
        activeUser: mockActiveUser
      }
    });

    // calendar-1 contains the event reference, so it should show "(Added - click to remove)"
    const addedLabels = container.querySelectorAll('.text-success');
    expect(addedLabels.length).toBe(1);
  });

  it('shows empty state when no user is provided', () => {
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
