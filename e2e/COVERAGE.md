# E2E Test Coverage

This document tracks what E2E tests exist, what features they cover, and identifies gaps for future testing.

**Last updated:** 2026-02-11
**Total tests:** 160

## Quick Summary

| File                              | Tests | Auth | Coverage                                      |
| --------------------------------- | ----- | ---- | --------------------------------------------- |
| `account-management.test.js`      | 14    | Both | Login, logout, persistence, account switching |
| `calendar.test.js`                | 4     | No   | Calendar page, events, modal                  |
| `calendar-creation.test.js`       | 10    | Yes  | FAB, event creation, validation, deletion     |
| `calendar-editing.test.js`        | 10    | Yes  | Edit button, form pre-population, validation  |
| `calendar-date-filtering.test.js` | 10    | No   | Date range loading, navigation, view modes    |
| `amb-creation.test.js`            | 10    | Yes  | FAB, wizard modal, step 1 form, validation    |
| `profile.test.js`                 | 4     | No   | Profile page, notes, not-found                |
| `event-detail.test.js`            | 4     | No   | naddr routes (articles, calendar, AMB)        |
| `community.test.js`               | 5     | No   | Community Learning/Chat tabs                  |
| `community-membership.test.js`    | 12    | Both | Join/leave flows, persistence, error handling |
| `community-creation.test.js`      | 12    | Yes  | Modal access, keypair selection, settings     |
| `discover.test.js`                | 10    | No   | Discovery tabs, infinite scroll               |
| `discover-events-filter.test.js`  | 9     | No   | Events tab date range filter, URL persistence |
| `learning-search.test.js`         | 13    | No   | Search input, SKOS filters, tab visibility    |
| `comments-reactions.test.js`      | 18    | Both | Comments, reactions, auth flows               |
| `settings.test.js`                | 15    | Both | Theme switching, relay settings, gated/debug  |

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

### calendar-editing.test.js (10 tests)

**Route:** `/calendar/event/[naddr]`
**Auth required:** Yes (all tests use `authenticatedPage` fixture)
**Note:** 3 update flow tests skipped due to app bug (`state_unsafe_mutation` in CalendarEventModal).

#### Edit Button Access (4 tests)

| Test                                       | What it verifies                      |
| ------------------------------------------ | ------------------------------------- |
| edit button visible in dropdown for owner  | Manage dropdown shows Edit option     |
| edit button not visible for non-owner      | Edit hidden when not event owner      |
| clicking Edit opens modal in edit mode     | Modal opens with pre-filled form      |
| edit modal has different title than create | "Edit Calendar Event" not "Create..." |

#### Form Pre-population (3 tests)

| Test                                 | What it verifies          |
| ------------------------------------ | ------------------------- |
| form shows correct event title       | Title field matches event |
| form shows correct event description | Description field matches |
| form shows correct dates and times   | Date fields pre-populated |

#### Update Flow (2 tests) - SKIPPED

| Test                            | What it verifies            | Status  |
| ------------------------------- | --------------------------- | ------- |
| can update title and save       | Title change persists       | SKIPPED |
| can update description and save | Description change persists | SKIPPED |

**Skip reason:** `state_unsafe_mutation` error in CalendarEventModal prevents saves. Tracked for fix.

#### Error Handling (1 test)

| Test                                      | What it verifies              |
| ----------------------------------------- | ----------------------------- |
| no critical JavaScript errors during edit | Error capture throughout flow |

**Components exercised:** EventManagementActions (dropdown), CalendarEventModal (edit mode)

---

### calendar-date-filtering.test.js (10 tests)

**Route:** `/calendar`
**Auth required:** No
**Note:** Tests date range loading using calendar-relay's special filter syntax (#start_after, #start_before).

#### Date Range Loading (4 tests)

| Test                                             | What it verifies                           |
| ------------------------------------------------ | ------------------------------------------ |
| calendar page loads events for current month     | Current month events visible on load       |
| navigating to next month loads new events        | Next button → next month events appear     |
| navigating to previous month loads past events   | Previous button → past month events appear |
| multi-day event spanning month boundary is shown | Events overlapping view edges included     |

#### View Mode Changes (3 tests)

| Test                                                 | What it verifies             |
| ---------------------------------------------------- | ---------------------------- |
| switching to week view shows events for current week | Week view narrows date range |
| switching to day view shows single day events        | Day view shows precise range |
| switching back to month view from week view works    | View mode transitions work   |

#### Error Handling (2 tests)

| Test                                                   | What it verifies               |
| ------------------------------------------------------ | ------------------------------ |
| no critical JavaScript errors during date navigation   | No JS errors on prev/next      |
| no critical JavaScript errors during view mode changes | No JS errors on view switching |

**Components exercised:** CalendarView, CalendarNavigation, CalendarGrid, createDateRangeCalendarLoader

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

### community-membership.test.js (12 tests)

**Route:** `/discover` (Communities tab), `/c/[pubkey]`
**Auth required:** Both authenticated and unauthenticated flows

#### Unauthenticated (3 tests)

| Test                                                         | What it verifies                  |
| ------------------------------------------------------------ | --------------------------------- |
| join button not visible on discover page when not logged in  | Button hidden for unauthenticated |
| community header shows "Not Joined" badge when not logged in | Badge indicates non-member status |
| join button in header is visible when not logged in          | Header shows join option          |

#### Join Flow - Authenticated (4 tests)

| Test                                                | What it verifies                      |
| --------------------------------------------------- | ------------------------------------- |
| join button visible on discover page when logged in | Button shown for authenticated user   |
| can join community from discover page               | Button changes to "Leave" after join  |
| can join community from community page header       | "Joined" badge appears                |
| join shows loading state during publish             | Loading spinner visible during action |

#### Leave Flow - Authenticated (2 tests)

| Test                                          | What it verifies              |
| --------------------------------------------- | ----------------------------- |
| can leave joined community from discover page | Button changes back to "Join" |
| leave removes joined badge from card          | Card styling updates on leave |

#### Persistence (1 test)

| Test                                             | What it verifies                     |
| ------------------------------------------------ | ------------------------------------ |
| membership state persists across page navigation | Leave button still visible after nav |

#### Error Handling (2 tests)

| Test                                            | What it verifies     |
| ----------------------------------------------- | -------------------- |
| no critical JavaScript errors during join flow  | No JS errors joining |
| no critical JavaScript errors during leave flow | No JS errors leaving |

**Components exercised:** CommunikeyCard (join button), CommunikeyHeader (join button, badges), community.js helpers

---

### community-creation.test.js (12 tests)

**Route:** `/discover` (Communities tab), `/c/[pubkey]`
**Auth required:** Yes (all tests use `authenticatedPage` fixture)
**Note:** Tests create communities using "Use Current Keypair" path (simpler 2-step flow).

#### Modal Access (3 tests)

| Test                                                   | What it verifies                     |
| ------------------------------------------------------ | ------------------------------------ |
| Create Community button not visible when not logged in | Button hidden for unauthenticated    |
| Create Community button visible when logged in         | Button shown for authenticated users |
| clicking Create Community button opens modal           | Modal opens with keypair options     |

#### Step 0 - Keypair Selection (2 tests)

| Test                                               | What it verifies                  |
| -------------------------------------------------- | --------------------------------- |
| step 0 shows two keypair options                   | Use Current vs Create New buttons |
| selecting "Use Current Keypair" advances to step 1 | Navigation to community settings  |

#### Step 1 - Community Settings (3 tests)

| Test                              | What it verifies                       |
| --------------------------------- | -------------------------------------- |
| step 1 shows settings form fields | Relays, content types sections visible |
| can toggle content types          | Checkbox toggling works                |
| default relay is pre-populated    | wss://relay.edufeed.org present        |

#### Creation Flow (3 tests)

| Test                                   | What it verifies                  |
| -------------------------------------- | --------------------------------- |
| can advance to confirmation step       | Next button navigates to step 2   |
| can complete community creation        | Creation navigates to /c/[pubkey] |
| created community shows user as joined | Auto-join works (kind 30382)      |

#### Error Handling (1 test)

| Test                                                   | What it verifies              |
| ------------------------------------------------------ | ----------------------------- |
| no critical JavaScript errors during modal interaction | Error capture throughout flow |

**Components exercised:** CreateCommunityModal, discover page CTA buttons

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

### discover-events-filter.test.js (9 tests)

**Route:** `/discover` (Events tab)
**Auth required:** No
**Note:** Tests the EventDateRangeFilter component for calendar events on the discover page.

#### Date Range Filter UI (4 tests)

| Test                                                  | What it verifies                            |
| ----------------------------------------------------- | ------------------------------------------- |
| date range filter is visible on events tab            | Filter appears with current range displayed |
| prev button shifts date range backward                | Range updates, URL params set               |
| next button shifts date range forward                 | Range updates, URL params set               |
| today button appears after navigating away and resets | Today button visibility, range reset        |

#### URL Persistence (1 test)

| Test                                                | What it verifies                     |
| --------------------------------------------------- | ------------------------------------ |
| date range persists in URL and survives page reload | eventStart/eventEnd params preserved |

#### Custom Date Picker (2 tests)

| Test                                                    | What it verifies                           |
| ------------------------------------------------------- | ------------------------------------------ |
| custom date picker opens and applies range              | Modal opens, dates selectable, apply works |
| custom date picker cancel button closes without changes | Cancel preserves original range            |

#### Tab Visibility (1 test)

| Test                                        | What it verifies                |
| ------------------------------------------- | ------------------------------- |
| date range filter not visible on other tabs | Filter only shows on Events tab |

#### Error Handling (1 test)

| Test                                                 | What it verifies                      |
| ---------------------------------------------------- | ------------------------------------- |
| no critical JavaScript errors during date navigation | No JS errors during navigation/picker |

**Components exercised:** EventDateRangeFilter, createDateRangeCalendarLoader

---

### learning-search.test.js (13 tests)

**Route:** `/discover` (Learning tab)
**Auth required:** No
**Note:** Tests UI element presence and basic interactions. Full NIP-50 search flow depends on relay behavior.

#### Search Input (3 tests)

| Test                                                | What it verifies                 |
| --------------------------------------------------- | -------------------------------- |
| search input visible on Learning tab                | Search input renders             |
| can type in search input                            | Input accepts and retains text   |
| clear button appears and works when text is entered | Clear button removes search text |

#### SKOS Filters (3 tests)

| Test                                              | What it verifies                                    |
| ------------------------------------------------- | --------------------------------------------------- |
| Resource Type dropdown is visible on Learning tab | SKOS dropdown label + button visible                |
| Subject dropdown is visible on Learning tab       | Second SKOS dropdown visible                        |
| Resource Type dropdown opens with options         | Dropdown expands, shows options (Text, Video, etc.) |

#### Tab Navigation (3 tests)

| Test                                                | What it verifies                    |
| --------------------------------------------------- | ----------------------------------- |
| SKOS filters not visible on Events tab              | Filters hidden on non-Learning tabs |
| SKOS filters not visible on Communities tab         | Filters hidden on Communities tab   |
| SKOS filters appear after switching to Learning tab | Filters show only on Learning tab   |

#### Common Filters (2 tests)

| Test                                             | What it verifies               |
| ------------------------------------------------ | ------------------------------ |
| Sort dropdown is visible on Learning tab         | Sort by Newest/Oldest dropdown |
| Relay filter dropdown is visible on Learning tab | Relay filter UI present        |

#### Error Handling (2 tests)

| Test                                                | What it verifies           |
| --------------------------------------------------- | -------------------------- |
| no critical JavaScript errors during page load      | No JS errors on tab switch |
| no critical JavaScript errors when typing in search | No JS errors during search |

**Components exercised:** LearningContentFilters, SKOSDropdown, SearchInput, DiscoverPage tabs

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

### settings.test.js (15 tests)

**Route:** `/settings`
**Auth required:** Both authenticated and unauthenticated flows

#### Theme Switching - Unauthenticated (3 tests)

| Test                                          | What it verifies                     |
| --------------------------------------------- | ------------------------------------ |
| settings page loads and shows theme switcher  | Page loads with Appearance section   |
| can switch between light and dark color modes | Dark/light buttons change data-theme |
| can switch between theme families             | Default/STIL buttons change theme    |

#### Unauthenticated State (2 tests)

| Test                                    | What it verifies                       |
| --------------------------------------- | -------------------------------------- |
| shows login prompt when not logged in   | Warning alert with login prompt        |
| hides relay settings when not logged in | Relay prefs and gated mode not visible |

#### Relay Settings - Authenticated (4 tests)

| Test                                       | What it verifies                          |
| ------------------------------------------ | ----------------------------------------- |
| shows relay preferences when logged in     | Relay Preferences section visible         |
| can see existing relays or create defaults | Relay URLs or Create default button shown |
| shows Blossom servers section              | Blossom/media server section visible      |
| shows app-specific relay categories        | Calendar/Educational categories visible   |

#### Gated Mode - Authenticated (2 tests)

| Test                                   | What it verifies              |
| -------------------------------------- | ----------------------------- |
| shows gated mode toggle when logged in | Gated Mode card visible       |
| gated mode toggle is functional        | Toggle is enabled/interactive |

#### Debug Mode - Authenticated (2 tests)

| Test                                   | What it verifies              |
| -------------------------------------- | ----------------------------- |
| shows debug mode toggle when logged in | Developer section visible     |
| debug mode toggle is functional        | Toggle state changes on click |

#### Error Handling (2 tests)

| Test                                             | What it verifies               |
| ------------------------------------------------ | ------------------------------ |
| no critical JavaScript errors on settings page   | No JS errors (unauthenticated) |
| no critical JavaScript errors when authenticated | No JS errors (authenticated)   |

**Components exercised:** ThemeSwitcher, RelaySettings, GatedModeCard, DeveloperSettingsCard

---

## Test Infrastructure

### Relay Architecture

Tests use Docker Compose with three real Nostr relays plus a mock hanging relay:

| Relay          | Port | Image                                    | Event Kinds                        |
| -------------- | ---- | ---------------------------------------- | ---------------------------------- |
| amb-relay      | 7001 | `git.edufeed.org/edufeed/amb-relay`      | 30142 (AMB educational)            |
| calendar-relay | 7002 | `git.edufeed.org/edufeed/calendar-relay` | 31922-31925 (calendar)             |
| strfry         | 7003 | `dockurr/strfry`                         | All others (profiles, notes, etc.) |
| mock-relay     | 9738 | Node.js (local)                          | Hanging relay for timedPool tests  |

### Files

| File                     | Purpose                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `docker-compose.e2e.yml` | Docker Compose config for amb-relay, calendar-relay, strfry, typesense                |
| `strfry.conf`            | Strfry relay configuration                                                            |
| `seed-relays.js`         | Seeds test events to appropriate relays based on kind                                 |
| `global-setup.js`        | Starts Docker Compose, waits for health, seeds data, starts hanging relay             |
| `global-teardown.js`     | Stops Docker Compose (with --volumes), stops hanging relay                            |
| `test-data.js`           | Deterministic mock data generator (150+ events, profiles, TEST_AUTHOR, TEST_AUTHOR_2) |
| `mock-relay.js`          | Mock Nostr relay for hanging relay simulation (never sends EOSE for kind 30142)       |
| `fixtures.js`            | Playwright fixtures (authenticatedPage), auth helpers, creation helpers               |
| `test-utils.js`          | Reusable wait/verify helpers (waitForContent, waitForEventDetail, setupErrorCapture)  |

---

## Coverage Gaps

### Not Yet Tested

| Feature                     | Priority | Notes                                                 |
| --------------------------- | -------- | ----------------------------------------------------- |
| **Article Creation**        | High     | No creation UI exists yet                             |
| **Signup Wizard**           | Medium   | 4-step signup flow (intro, profile, key gen, follows) |
| **Mobile Responsive**       | Low      | Viewport-specific tests                               |
| **Accessibility (a11y)**    | Low      | Keyboard navigation, screen reader                    |
| **Relay Override Settings** | Low      | Kind 30002 user relay customization                   |
| **Error Recovery**          | Low      | Offline handling, relay failures                      |

### Partially Covered

| Feature              | What's Covered                               | What's Missing                                        |
| -------------------- | -------------------------------------------- | ----------------------------------------------------- |
| Account management   | NSEC login, logout, persistence, switching   | NIP-07 extension, NIP-49 encrypted keys               |
| Settings page        | Theme switching, gated mode, debug mode      | Relay editing, Blossom add/remove, kind 30002 publish |
| Calendar events      | View, create, delete, edit UI (modal/form)   | Edit save flow (blocked by app bug)                   |
| AMB resources        | Modal UI, step 1 form, navigation            | Full creation (SKOS dropdowns, file upload, publish)  |
| Profile page         | View profile, notes                          | Edit profile, avatar upload                           |
| Comments             | Post, reply, delete                          | Edit comment                                          |
| Reactions            | Add, remove                                  | Custom emoji support                                  |
| NIP-50 Search        | Search input, SKOS filter UI, tab visibility | Full search flow (depends on relay NIP-50 support)    |
| Community membership | Join/leave on discover & community pages     | Chat message posting                                  |
| Community creation   | Use Current Keypair flow, settings, publish  | Create New Keypair flow (4 steps), badge access ctrl  |

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

# Start relays manually (for debugging)
docker compose -f e2e/docker-compose.e2e.yml up -d

# Check relay health
curl -H "Accept: application/nostr+json" http://localhost:7001  # amb-relay
curl -H "Accept: application/nostr+json" http://localhost:7002  # calendar-relay
curl -H "Accept: application/nostr+json" http://localhost:7003  # strfry

# Stop relays (with volume cleanup)
docker compose -f e2e/docker-compose.e2e.yml down --volumes
```

**Requirements:**

- nix development shell (for Chromium)
- Docker and Docker Compose (for relay containers)
