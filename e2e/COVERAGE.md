# E2E Test Coverage

This document tracks what E2E tests exist, what features they cover, and identifies gaps for future testing.

**Last updated:** 2026-02-09
**Total tests:** 79

## Quick Summary

| File                         | Tests | Auth | Coverage                                      |
| ---------------------------- | ----- | ---- | --------------------------------------------- |
| `account-management.test.js` | 14    | Both | Login, logout, persistence, account switching |
| `calendar.test.js`           | 4     | No   | Calendar page, events, modal                  |
| `calendar-creation.test.js`  | 10    | Yes  | FAB, event creation, validation, deletion     |
| `amb-creation.test.js`       | 10    | Yes  | FAB, wizard modal, step 1 form, validation    |
| `profile.test.js`            | 4     | No   | Profile page, notes, not-found                |
| `event-detail.test.js`       | 4     | No   | naddr routes (articles, calendar, AMB)        |
| `community.test.js`          | 5     | No   | Community Learning/Chat tabs                  |
| `discover.test.js`           | 10    | No   | Discovery tabs, infinite scroll               |
| `comments-reactions.test.js` | 18    | Both | Comments, reactions, auth flows               |

## Detailed Coverage

### account-management.test.js (14 tests)

**Route:** `/` (homepage), `/discover`
**Auth required:** Both authenticated and unauthenticated flows

#### Login Modal UI (3 tests)

| Test                                      | What it verifies                        |
| ----------------------------------------- | --------------------------------------- |
| login modal opens from navbar             | Click Login → modal visible             |
| login modal shows available login methods | Extension, NSEC, Signup buttons present |
| login modal closes on escape key          | Modal dismissal works                   |

#### NSEC Login Flow (3 tests)

| Test                                                     | What it verifies                                     |
| -------------------------------------------------------- | ---------------------------------------------------- |
| successful login with valid nsec shows profile in navbar | Enter nsec → modal closes → profile dropdown visible |
| login fails with invalid nsec and shows error            | Invalid input → modal stays open or error shown      |
| login button is disabled with empty input                | Empty input → submit prevented                       |

#### Logout Flow (2 tests)

| Test                                          | What it verifies                         |
| --------------------------------------------- | ---------------------------------------- |
| logout removes account and shows login button | Dropdown → Logout → Login button returns |
| logout clears account from localStorage       | After logout, localStorage is empty      |

#### Account Persistence (2 tests)

| Test                                        | What it verifies                                  |
| ------------------------------------------- | ------------------------------------------------- |
| logged-in state persists across page reload | Login → reload → still logged in                  |
| multiple accounts persist across reload     | Add 2 accounts → reload → both present in storage |

#### Account Switching (2 tests)

| Test                                             | What it verifies                        |
| ------------------------------------------------ | --------------------------------------- |
| can add second account without logging out first | Login modal allows adding more accounts |
| can switch between accounts via login modal      | Switch button changes active account    |

#### Error Handling (2 tests)

| Test                                             | What it verifies |
| ------------------------------------------------ | ---------------- |
| no critical JavaScript errors during login flow  | No JS errors     |
| no critical JavaScript errors during logout flow | No JS errors     |

**Components exercised:** LoginModal, LoginWithPrivateKey, Navbar (dropdown), AccountProfile

---

### calendar-creation.test.js (10 tests)

**Route:** `/calendar`, `/calendar/event/[naddr]`
**Auth required:** Yes (all tests use `authenticatedPage` fixture)

#### FAB and Modal UI (3 tests)

| Test                               | What it verifies                   |
| ---------------------------------- | ---------------------------------- |
| FAB is visible on calendar page    | FAB appears for authenticated user |
| clicking Create Event opens modal  | Modal visible with form fields     |
| modal closes on close button click | Modal dismissal works              |

#### Happy Path Creation (3 tests)

| Test                                            | What it verifies                            |
| ----------------------------------------------- | ------------------------------------------- |
| can create all-day event with required fields   | Fill title + date → navigates to event page |
| can create timed event with start and end times | Toggle timed, fill times → success          |
| created event shows title and metadata          | Event detail shows title + description      |

#### Form Validation (2 tests)

| Test                                           | What it verifies                |
| ---------------------------------------------- | ------------------------------- |
| shows error when submitting without title      | Empty title → validation error  |
| shows error when submitting without start date | Missing date → validation error |

#### Deletion (1 test)

| Test                                    | What it verifies                       |
| --------------------------------------- | -------------------------------------- |
| authenticated user can delete own event | Create → delete → confirm → redirected |

#### Error Handling (1 test)

| Test                                  | What it verifies              |
| ------------------------------------- | ----------------------------- |
| no critical JS errors during creation | Error capture throughout flow |

**Components exercised:** FloatingActionButton, CalendarEventModal, EventManagementActions

---

### amb-creation.test.js (10 tests)

**Route:** `/c/[pubkey]` (community Learning tab)
**Auth required:** Yes (all tests use `authenticatedPage` fixture)
**Note:** Full creation flow testing limited because SKOS dropdowns require external vocabulary data.

#### FAB and Modal UI (4 tests)

| Test                                                | What it verifies                   |
| --------------------------------------------------- | ---------------------------------- |
| FAB is visible on community Learning tab            | FAB appears for authenticated user |
| clicking Create Learning Content opens wizard modal | Modal visible with form fields     |
| modal closes on close button click                  | Modal dismissal via X button works |
| modal closes on backdrop click                      | Modal dismissal via backdrop works |

#### Step 1 Form (5 tests)

| Test                                              | What it verifies                                               |
| ------------------------------------------------- | -------------------------------------------------------------- |
| step 1 shows all required form fields             | Identifier, title, description, language, image fields visible |
| can fill step 1 form fields                       | All fields accept input, values are preserved                  |
| cannot proceed without filling required fields    | Validation prevents advancing to step 2                        |
| can proceed to step 2 with required fields filled | Navigation to step 2 works                                     |
| can go back from step 2 to step 1                 | Back navigation preserves form state                           |

#### Error Handling (1 test)

| Test                                                   | What it verifies              |
| ------------------------------------------------------ | ----------------------------- |
| no critical JavaScript errors during modal interaction | Error capture throughout flow |

**Components exercised:** EducationalFAB, AMBUploadModal, SKOSDropdown (partial)

---

### calendar.test.js (4 tests)

**Route:** `/calendar`
**Auth required:** No

| Test                                        | What it verifies                        |
| ------------------------------------------- | --------------------------------------- |
| loads and displays calendar events          | Page loads, events render from relay    |
| calendar events contain expected metadata   | Event titles (Workshop/Lecture) visible |
| clicking calendar event opens details modal | Modal opens, shows title, can close     |
| no critical JavaScript errors               | No JS errors during interaction         |

**Components exercised:** CalendarView, CalendarGrid, CalendarEventBar, CalendarEventDetailsModal

---

### profile.test.js (4 tests)

**Route:** `/p/[npub]`
**Auth required:** No

| Test                                  | What it verifies                   |
| ------------------------------------- | ---------------------------------- |
| loads and shows user info             | Name, avatar, bio render correctly |
| shows notes tab with user notes       | Notes load after "Load more" click |
| unknown profile shows not found state | 404-like UI after 5s timeout       |
| no critical JavaScript errors         | No JS errors during load           |

**Components exercised:** ProfilePage, NotesTimeline

---

### event-detail.test.js (4 tests)

**Route:** `/[naddr=naddr]`
**Auth required:** No
**Note:** Uses client-side navigation (SSR disabled for naddr routes)

| Test                                          | What it verifies                  |
| --------------------------------------------- | --------------------------------- |
| article detail page loads and shows content   | Article title, body render        |
| calendar date event detail page loads         | Event title visible               |
| AMB resource detail page loads                | Resource title renders in article |
| no critical JavaScript errors on article page | No JS errors                      |

**Components exercised:** ArticleView, CalendarEventDetailsModal, AMBResourceView

---

### community.test.js (5 tests)

**Route:** `/c/[pubkey]`
**Auth required:** No

| Test                                               | What it verifies                              |
| -------------------------------------------------- | --------------------------------------------- |
| loads community AMB resources                      | Learning tab shows resource cards             |
| shows author profile names on resource cards       | Profile names resolve (not truncated pubkeys) |
| loads community chat messages                      | Chat tab shows message bubbles                |
| shows sender profile names on messages             | Profile names resolve on chat                 |
| no critical JavaScript errors when navigating tabs | Tab switching works cleanly                   |

**Components exercised:** CommunitySidebar, LearningView, Chat, AMBResourceCard

---

### discover.test.js (10 tests)

**Route:** `/discover`
**Auth required:** No

| Test                                                           | What it verifies                        |
| -------------------------------------------------------------- | --------------------------------------- |
| All tab: loads initial content                                 | Cards render on page load               |
| All tab: infinite scroll loads more content                    | Scrolling loads more items              |
| Events tab: loads calendar events and supports infinite scroll | Tab filters to events only              |
| Learning tab: loads AMB resources and supports infinite scroll | Tab filters to AMB only                 |
| Articles tab: loads articles and supports infinite scroll      | Tab filters to articles only            |
| tab switching displays correct content types                   | Tabs are mutually exclusive             |
| Learning tab: no loading flicker during infinite scroll        | Spinner doesn't flicker rapidly         |
| Articles tab: shows "no more content" after all items loaded   | End-of-content message                  |
| Learning tab: spinner stops after all content loaded           | Tests timedPool timeout (hanging relay) |
| page loads without critical JavaScript errors                  | No JS errors                            |

**Components exercised:** DiscoverPage, ContentCard, InfiniteScroll sentinel

---

### comments-reactions.test.js (18 tests)

**Route:** `/calendar/event/[naddr]`
**Auth required:** Both authenticated and unauthenticated flows

#### Comments - Unauthenticated (5 tests)

| Test                                         | What it verifies                 |
| -------------------------------------------- | -------------------------------- |
| comment section renders with count badge     | Comment count > 0 displayed      |
| displays individual comment elements         | Comment content visible          |
| displays nested reply with indentation       | Reply threading works            |
| shows login prompt for unauthenticated users | Login prompt shown, input hidden |
| shows empty state when event has no comments | No infinite spinner on empty     |

#### Comments - Authenticated (4 tests)

| Test                                         | What it verifies            |
| -------------------------------------------- | --------------------------- |
| comment input is visible for logged in users | Input + submit button shown |
| authenticated user can post and see comment  | Optimistic UI works         |
| authenticated user can reply to a comment    | Reply flow works            |
| authenticated user can delete own comment    | Delete with confirmation    |

#### Reactions - Unauthenticated (3 tests)

| Test                                                   | What it verifies             |
| ------------------------------------------------------ | ---------------------------- |
| displays existing reactions on calendar event          | Seeded reactions visible     |
| reaction buttons show counts                           | data-count attribute correct |
| unauthenticated user sees disabled add reaction button | Add button disabled          |

#### Reactions - Authenticated (3 tests)

| Test                                       | What it verifies             |
| ------------------------------------------ | ---------------------------- |
| authenticated user can add a reaction      | Picker opens, reaction added |
| authenticated user can remove own reaction | Toggle off works             |
| reaction count updates after adding        | Count increments             |

#### Spot Check (1 test)

| Test                                 | What it verifies          |
| ------------------------------------ | ------------------------- |
| AMB resource page shows reaction bar | Reactions work on AMB too |

#### Error Handling (2 tests)

| Test                                            | What it verifies      |
| ----------------------------------------------- | --------------------- |
| no critical errors during comment interactions  | No JS errors posting  |
| no critical errors during reaction interactions | No JS errors reacting |

**Components exercised:** CommentThread, Comment, CommentInput, ReactionBar, ReactionButton, ReactionPicker, AddReactionButton

---

## Test Infrastructure

| File                 | Purpose                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `test-utils.js`      | Reusable wait/verify helpers (waitForContent, waitForEventDetail, setupErrorCapture, etc.)                                                     |
| `fixtures.js`        | Playwright fixtures (authenticatedPage), auth helpers (loginWithNsec, logout), creation helpers (openEventCreationModal, openAMBCreationModal) |
| `test-data.js`       | Deterministic mock data generator (150+ events, profiles, TEST_AUTHOR, TEST_AUTHOR_2)                                                          |
| `mock-relay.js`      | Mock Nostr relay with filter matching, hanging relay simulation                                                                                |
| `global-setup.js`    | Starts normal relay (9737) + hanging relay (9738)                                                                                              |
| `global-teardown.js` | Stops both relays                                                                                                                              |

---

## Coverage Gaps

### Not Yet Tested

| Feature                     | Priority | Notes                                                 |
| --------------------------- | -------- | ----------------------------------------------------- |
| **Article Creation**        | High     | No creation UI exists yet                             |
| **Settings Page**           | Medium   | Gated mode toggle, relay settings, theme switching    |
| **Search Functionality**    | Medium   | NIP-50 search on discover page                        |
| **Community Management**    | Medium   | Create community, join/leave flows, chat messages     |
| **Signup Wizard**           | Medium   | 4-step signup flow (intro, profile, key gen, follows) |
| **Mobile Responsive**       | Low      | Viewport-specific tests                               |
| **Accessibility (a11y)**    | Low      | Keyboard navigation, screen reader                    |
| **Relay Override Settings** | Low      | Kind 30002 user relay customization                   |
| **Error Recovery**          | Low      | Offline handling, relay failures                      |

### Partially Covered

| Feature            | What's Covered                             | What's Missing                                       |
| ------------------ | ------------------------------------------ | ---------------------------------------------------- |
| Account management | NSEC login, logout, persistence, switching | NIP-07 extension, NIP-49 encrypted keys              |
| Calendar events    | View, create, delete                       | Edit event flow                                      |
| AMB resources      | Modal UI, step 1 form, navigation          | Full creation (SKOS dropdowns, file upload, publish) |
| Profile page       | View profile, notes                        | Edit profile, avatar upload                          |
| Comments           | Post, reply, delete                        | Edit comment                                         |
| Reactions          | Add, remove                                | Custom emoji support                                 |

---

## Maintenance Guidelines

### When to Update This Document

1. **Adding new test file** - Add new section under Detailed Coverage
2. **Adding tests to existing file** - Update test count and add row to table
3. **Removing tests** - Update counts, remove from tables
4. **Identifying new gaps** - Add to Coverage Gaps section
5. **Closing a gap** - Move from Gaps to appropriate test file section

### Test Naming Convention

Tests should be named descriptively: `[feature]: [specific behavior being tested]`

Examples:

- `loads and displays calendar events` (good)
- `test calendar` (bad - too vague)

### Running Tests

```bash
# Run all E2E tests
pnpm run test:e2e

# Run specific file
pnpm run test:e2e e2e/calendar.test.js

# Run with UI (debugging)
pnpm run test:e2e --ui
```

**Note:** Tests require the nix development shell for Chromium access.
