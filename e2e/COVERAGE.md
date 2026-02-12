# E2E Test Coverage

This document tracks what E2E tests exist, what features they cover, and identifies gaps for future testing.

**Last updated:** 2026-02-12
**Total tests:** 225

## Quick Summary

| File                              | Tests | Auth | Coverage                                      |
| --------------------------------- | ----- | ---- | --------------------------------------------- |
| `account-management.test.js`      | 14    | Both | Login, logout, persistence, account switching |
| `calendar.test.js`                | 4     | No   | Calendar page, events, modal                  |
| `calendar-creation.test.js`       | 10    | Yes  | FAB, event creation, validation, deletion     |
| `calendar-editing.test.js`        | 10    | Yes  | Edit button, form pre-population, validation  |
| `calendar-date-filtering.test.js` | 10    | No   | Date range loading, navigation, view modes    |
| `amb-creation.test.js`            | 20    | Yes  | FAB, wizard modal, all 4 steps, validation    |
| `profile.test.js`                 | 4     | No   | Profile page, notes, not-found                |
| `profile-editing.test.js`         | 10    | Yes  | Edit modal, form pre-population, save flow    |
| `event-detail.test.js`            | 4     | No   | naddr routes (articles, calendar, AMB)        |
| `community.test.js`               | 5     | No   | Community Learning/Chat tabs                  |
| `community-membership.test.js`    | 12    | Both | Join/leave flows, persistence, error handling |
| `community-creation.test.js`      | 23    | Yes  | Both keypair flows, all steps, settings       |
| `discover.test.js`                | 10    | No   | Discovery tabs, infinite scroll               |
| `discover-events-filter.test.js`  | 9     | No   | Events tab date range filter, URL persistence |
| `learning-search.test.js`         | 13    | No   | Search input, SKOS filters, tab visibility    |
| `comments-reactions.test.js`      | 18    | Both | Comments, reactions, auth flows               |
| `chat-posting.test.js`            | 8     | Both | Chat input visibility, message posting flow   |
| `signup.test.js`                  | 15    | No   | 4-step signup wizard, key generation          |
| `settings.test.js`                | 20    | Both | Theme, relays, relay editing, gated/debug     |
| `settings-blossom.test.js`        | 6     | Yes  | Blossom server management                     |

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

#### Edit Button Visibility (2 tests)

| Test                             | What it verifies                  |
| -------------------------------- | --------------------------------- |
| edit button visible for owner    | Manage dropdown shows Edit option |
| edit button hidden for non-owner | Edit hidden when not event owner  |

#### Form Pre-population (3 tests)

| Test                                | What it verifies                 |
| ----------------------------------- | -------------------------------- |
| clicking Edit opens modal with data | Modal opens with pre-filled form |
| form shows correct title            | Title field matches event        |
| form shows correct date             | Date fields pre-populated        |

#### Update Flow (2 tests)

| Test                            | What it verifies            |
| ------------------------------- | --------------------------- |
| can update title and save       | Title change persists       |
| can update description and save | Description change persists |

#### Form Validation (2 tests)

| Test                                      | What it verifies               |
| ----------------------------------------- | ------------------------------ |
| cannot submit with empty title            | Empty title → validation error |
| updated event shows new data after reload | Verify persistence after edit  |

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

### amb-creation.test.js (20 tests)

**Route:** `/c/[pubkey]` (community Learning tab)
**Auth required:** Yes (all tests use `authenticatedPage` fixture)
**Note:** Full creation flow testing limited because SKOS dropdowns require external vocabulary data.

#### FAB and Modal UI (4 tests)

| Test                                                | What it verifies                   |
| --------------------------------------------------- | ---------------------------------- |
| FAB is visible on community Learning tab            | FAB appears for authenticated user |
| clicking Create Learning Content opens wizard modal | Modal visible with form fields     |
| modal closes on close button click                  | Modal dismissal via X button works |
| modal closes on Escape key                          | Modal dismissal via Escape works   |

#### Step 1 Form (5 tests)

| Test                                              | What it verifies                                               |
| ------------------------------------------------- | -------------------------------------------------------------- |
| step 1 shows all required form fields             | Identifier, title, description, language, image fields visible |
| can fill step 1 form fields                       | All fields accept input, values are preserved                  |
| cannot proceed without filling required fields    | Validation prevents advancing to step 2                        |
| can proceed to step 2 with required fields filled | Navigation to step 2 works                                     |
| can go back from step 2 to step 1                 | Back navigation preserves form state                           |

#### Step 2 - Classification (4 tests)

| Test                                | What it verifies             |
| ----------------------------------- | ---------------------------- |
| step 2 shows Resource Type dropdown | SKOS dropdown visible        |
| step 2 shows Subject dropdown       | Second SKOS dropdown visible |
| step 2 shows Keywords input         | Keywords input field visible |
| can add keyword on step 2           | Keyword appears as badge     |

#### Step 3 - Content & Creators (2 tests)

| Test                             | What it verifies                         |
| -------------------------------- | ---------------------------------------- |
| step 3 shows Creators input      | Creators label/input visible (or step 2) |
| step 3 shows External URLs input | External References visible (or step 2)  |

#### Step 4 - License & Publish (2 tests)

| Test                                                  | What it verifies                      |
| ----------------------------------------------------- | ------------------------------------- |
| step 4 shows License dropdown when navigated properly | License dropdown visible (if reached) |
| step 4 shows Free Access checkbox                     | Checkbox visible (if reached)         |

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

### profile-editing.test.js (10 tests)

**Route:** `/p/[npub]`
**Auth required:** Yes (all tests use `authenticatedPage` fixture)

#### Edit Button Visibility (2 tests)

| Test                               | What it verifies                      |
| ---------------------------------- | ------------------------------------- |
| edit button visible on own profile | Edit button shows for profile owner   |
| edit button not visible on other   | Edit button hidden on other's profile |

#### Edit Modal Form (4 tests)

| Test                                 | What it verifies                     |
| ------------------------------------ | ------------------------------------ |
| clicking Edit opens modal            | Modal visible after button click     |
| modal shows correct title            | Modal header present                 |
| form pre-populates with current data | Name field has current profile value |
| modal closes on close button click   | Modal dismissal works                |

#### Update Flow (2 tests)

| Test                      | What it verifies                  |
| ------------------------- | --------------------------------- |
| can update name and save  | Name change persists after reload |
| can update about and save | About change triggers save        |

#### Form Validation (2 tests)

| Test                        | What it verifies             |
| --------------------------- | ---------------------------- |
| shows error for empty name  | Empty name keeps modal open  |
| shows error for invalid URL | Invalid website URL rejected |

#### Error Handling (1 test)

| Test                                           | What it verifies              |
| ---------------------------------------------- | ----------------------------- |
| no critical JavaScript errors during edit flow | Error capture throughout flow |

**Components exercised:** ProfilePage, ProfileEditModal

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

### community-creation.test.js (23 tests)

**Route:** `/discover` (Communities tab), `/c/[pubkey]`
**Auth required:** Yes (all tests use `authenticatedPage` fixture)

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

#### Create New Keypair Flow (11 tests)

| Test                                                    | What it verifies                    |
| ------------------------------------------------------- | ----------------------------------- |
| selecting "Create New Keypair" advances to profile step | Profile form visible                |
| profile step shows name input field                     | Name input visible                  |
| profile step shows about textarea                       | About textarea visible              |
| profile step shows picture URL input                    | Picture input visible               |
| can fill profile form and proceed to key generation     | Navigation to key gen step          |
| key generation step shows public key (npub)             | npub displayed in code block        |
| key generation step shows download backup button        | Download button visible             |
| key generation step shows encrypted backup option       | Password input visible              |
| cannot proceed from key generation without downloading  | Validation blocks advancement       |
| back button works on profile step                       | Returns to keypair selection        |
| back button works on key generation step                | Returns to profile with data intact |

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

### chat-posting.test.js (8 tests)

**Route:** `/c/[pubkey]` (community Chat tab)
**Auth required:** Both authenticated and unauthenticated flows

#### Unauthenticated (2 tests)

| Test                                           | What it verifies   |
| ---------------------------------------------- | ------------------ |
| chat input is hidden for unauthenticated users | Input not visible  |
| send button is not visible for unauthenticated | Send button hidden |

#### Authenticated (5 tests)

| Test                                           | What it verifies                 |
| ---------------------------------------------- | -------------------------------- |
| chat input is visible for authenticated users  | Input field appears              |
| send button is visible for authenticated users | Submit button shown              |
| can type message in chat input                 | Input accepts and retains text   |
| send button is disabled when input is empty    | Empty input disables submit      |
| can send message and see it appear in chat     | Optimistic UI works              |
| sent message appears with correct styling      | Own messages have chat-end class |

#### Error Handling (1 test)

| Test                                                  | What it verifies              |
| ----------------------------------------------------- | ----------------------------- |
| no critical JavaScript errors during chat interaction | Error capture throughout flow |

**Components exercised:** Chat, ChatInput, ChatBubble

---

### signup.test.js (15 tests)

**Route:** `/` (homepage, login modal → signup modal)
**Auth required:** No

#### Modal Access (3 tests)

| Test                                 | What it verifies             |
| ------------------------------------ | ---------------------------- |
| signup button opens modal from login | Signup modal becomes visible |
| signup modal shows step indicator    | 4 steps displayed            |
| signup modal starts at step 1        | First step has step-primary  |

#### Step 1 - Introduction (3 tests)

| Test                              | What it verifies      |
| --------------------------------- | --------------------- |
| step 1 shows introduction text    | Prose content visible |
| can navigate to step 2 from intro | Next button advances  |
| back button not visible on step 1 | No back on first step |

#### Step 2 - Profile Creation (5 tests)

| Test                                  | What it verifies            |
| ------------------------------------- | --------------------------- |
| step 2 shows name input field         | Name input visible          |
| step 2 shows about textarea           | About textarea visible      |
| step 2 shows profile picture URL      | Picture input visible       |
| step 2 shows website input            | Website input visible       |
| can fill profile form fields          | All inputs accept values    |
| cannot proceed to step 3 without name | Validation requires name    |
| can proceed to step 3 with name       | Navigation to key gen works |
| back button visible and works         | Returns to step 1           |

#### Step 3 - Key Generation (4 tests)

| Test                                     | What it verifies         |
| ---------------------------------------- | ------------------------ |
| step 3 generates and displays public key | npub in code block       |
| step 3 shows download backup button      | Download button visible  |
| step 3 shows encrypted backup option     | Password input visible   |
| cannot proceed without downloading       | Validation blocks step 4 |

#### Step 4 - Follow Suggestions (2 tests)

| Test                       | What it verifies      |
| -------------------------- | --------------------- |
| modal shows Cancel button  | Cancel button present |
| cancel button closes modal | Modal dismissal works |

#### Error Handling (1 test)

| Test                                             | What it verifies              |
| ------------------------------------------------ | ----------------------------- |
| no critical JavaScript errors during signup flow | Error capture throughout flow |

**Components exercised:** SignupWizard, KeyGenerator, FollowSuggestions

---

### settings.test.js (20 tests)

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

#### Relay Editing - Authenticated (5 tests)

| Test                                      | What it verifies                    |
| ----------------------------------------- | ----------------------------------- |
| can see Add Relay form                    | Add Relay divider and input visible |
| can type relay URL in input               | Input accepts wss:// URL            |
| Add button is visible next to relay input | Add button present                  |
| read/write checkboxes visible in add form | Read/Write checkboxes visible       |
| can toggle read/write checkboxes          | Checkbox state changes on click     |

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

### settings-blossom.test.js (6 tests)

**Route:** `/settings`
**Auth required:** Yes (all tests use `authenticatedPage` fixture)

#### Section Visibility (3 tests)

| Test                                               | What it verifies                   |
| -------------------------------------------------- | ---------------------------------- |
| Blossom servers section visible when authenticated | Section appears for logged in user |
| shows Add Blossom Server input                     | Input field for URL visible        |
| shows Add button for Blossom server                | Add button present in section      |

#### Server Management (3 tests)

| Test                                           | What it verifies                       |
| ---------------------------------------------- | -------------------------------------- |
| can type Blossom server URL in input           | Input accepts https:// URL             |
| shows validation error for invalid Blossom URL | Invalid URL rejected or stays in input |
| shows existing Blossom servers if configured   | Server URLs or input visible           |
| Blossom server list shows remove button        | Remove button for each server          |

#### Error Handling (1 test)

| Test                                                  | What it verifies              |
| ----------------------------------------------------- | ----------------------------- |
| no critical JavaScript errors during Blossom settings | Error capture throughout flow |

**Components exercised:** BlossomServerSettings

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
| blossom        | 3000 | `ghcr.io/hzrd149/blossom-server`         | File upload server                 |

### Files

| File                     | Purpose                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `docker-compose.e2e.yml` | Docker Compose config for amb-relay, calendar-relay, strfry, typesense, blossom       |
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

| Feature                  | Priority | Notes                              |
| ------------------------ | -------- | ---------------------------------- |
| **Article Creation**     | High     | No creation UI exists yet          |
| **Mobile Responsive**    | Low      | Viewport-specific tests            |
| **Accessibility (a11y)** | Low      | Keyboard navigation, screen reader |
| **Error Recovery**       | Low      | Offline handling, relay failures   |

### Partially Covered

| Feature              | What's Covered                                   | What's Missing                                     |
| -------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Account management   | NSEC login, logout, persistence, switching       | NIP-07 extension, NIP-49 encrypted keys            |
| Settings page        | Theme, gated/debug mode, relay editing, Blossom  | Kind 30002 publish verification                    |
| Calendar events      | View, create, delete, edit (full CRUD)           | -                                                  |
| AMB resources        | Modal UI, all 4 steps, navigation                | Full creation (file upload, kind 30142 publish)    |
| Profile page         | View profile, notes, edit modal, save flow       | Avatar upload (Blossom integration)                |
| Comments             | Post, reply, delete                              | Edit comment                                       |
| Reactions            | Add, remove                                      | Custom emoji support                               |
| NIP-50 Search        | Search input, SKOS filter UI, tab visibility     | Full search flow (depends on relay NIP-50 support) |
| Community membership | Join/leave, chat message posting                 | -                                                  |
| Community creation   | Both keypair flows, all steps, settings, publish | Badge access control                               |
| Signup wizard        | All 4 steps, key generation UI                   | Full completion (requires file download handling)  |

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
