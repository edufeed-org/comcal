# ComCal - Claude Code Context

## Project Overview

ComCal (Communikey Calendar) is a decentralized social education platform built on the Nostr protocol using SvelteKit. It enables users to:
- Create and interact in communities
- Create and manage events/calendars (NIP-52)
- Search through educational content (kind 30142 - AMB spec)
- Organize content in lists and share with communities

## Tech Stack

- **Framework:** SvelteKit with Svelte 5 (runes-based reactivity)
- **Styling:** TailwindCSS 4.0 + DaisyUI 5.0
- **Language:** JavaScript with JSDoc type annotations
- **Build:** Vite 7.x
- **i18n:** Paraglide.js
- **Protocol:** Nostr (Network of Simple Transport Relays)

### Key Dependencies
```
applesauce-core      # Event handling, models, stores
applesauce-factory   # Event creation and signing
applesauce-relay     # Relay pool and WebSocket management
applesauce-accounts  # Account management
applesauce-loaders   # Network data fetching
nostr-tools          # Protocol utilities (DO NOT use directly for relay comm)
blossom-client-sdk   # File uploads with NIP-98 auth
rxjs                 # Reactive observables
```

## Critical Architecture Rules

### 1. ALWAYS Use Applesauce for Nostr Operations

**NEVER use nostr-tools directly for relay communication!** nostr-tools `SimplePool` has incorrect message serialization.

```javascript
// ❌ WRONG - nostr-tools sends malformed requests
import { SimplePool } from 'nostr-tools';
const pool = new SimplePool();
pool.subscribeMany(relays, [filter], opts);
// Sends: ["REQ", "sub:1", [{...}]] - MALFORMED!

// ✅ CORRECT - Use applesauce infrastructure
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';

const loader = createTimelineLoader(pool, relays, filter, { eventStore, limit });
return loader();  // Returns Observable
```

### 2. Loader/Model Pattern (Essential)

Three-layer reactive data architecture:

**Loaders** - Fetch from network → populate EventStore
**Models** - Subscribe to EventStore → transform/filter data
**Components** - Use `$effect()` to combine loader + model subscriptions

```javascript
import { TimelineModel } from 'applesauce-core/models';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';

let items = $state([]);
let loadedItems = new Map();

$effect(() => {
  loadedItems.clear();

  // Step 1: Loader fetches from network
  const loaderSub = loader(params).subscribe();

  // Step 2: Model subscribes to EventStore
  const modelSub = eventStore.model(TimelineModel, params).subscribe((data) => {
    let hasNew = false;
    for (const item of data || []) {
      if (!loadedItems.has(item.id)) {
        loadedItems.set(item.id, item);
        hasNew = true;
      }
    }
    if (hasNew) items = Array.from(loadedItems.values());
  });

  // Step 3: Cleanup
  return () => {
    loaderSub.unsubscribe();
    modelSub.unsubscribe();
  };
});
```

**Models do NOT fetch events** - they only subscribe to what's already in EventStore!

### 3. Deletion Filtering

```javascript
// ❌ WRONG - Returns all events (including deleted)
eventStore.timeline({ ids: [...] })

// ✅ CORRECT - Filters deleted events automatically
eventStore.model(TimelineModel, { ids: [...] })
```

## Svelte 5 Critical Patterns

### $state() vs Plain let

```javascript
// ❌ WRONG - INFINITE LOOP! $state inside $effect causes re-triggers
let subscription = $state(undefined);
$effect(() => {
  subscription?.unsubscribe();
  subscription = eventStore.timeline({...}).subscribe(); // Triggers re-run!
});

// ✅ CORRECT - Use plain let for subscriptions/timers/internal refs
/** @type {import('rxjs').Subscription | undefined} */
let subscription;
$effect(() => {
  subscription?.unsubscribe();
  subscription = eventStore.timeline({...}).subscribe();
  return () => subscription?.unsubscribe();
});
```

**Rule:** `$state()` = value triggers UI re-renders. Plain `let` = internal references.

### $derived() Must Be Pure

```javascript
// ❌ WRONG - Mutates in $derived
let sorted = $derived(items.sort());

// ✅ CORRECT - Creates new array
let sorted = $derived([...items].sort());
// or
let sorted = $derived(items.toSorted((a, b) => a.name.localeCompare(b.name)));
```

### Applesauce Functions That Mutate

Some applesauce-core functions use internal caching that causes `state_unsafe_mutation` errors in `$derived()`:

```javascript
// ❌ WRONG - getReplaceableAddress() caches internally
import { getReplaceableAddress } from 'applesauce-core/helpers';
const filtered = $derived.by(() => {
  return items.filter(item => {
    const address = getReplaceableAddress(item.data); // MUTATION!
  });
});

// ✅ CORRECT - Use pure function
function getAddressableReference(event) {
  if (!event || event.kind < 30000 || event.kind >= 40000) return undefined;
  const dTag = event.tags?.find(t => t[0] === 'd')?.[1] || '';
  return `${event.kind}:${event.pubkey}:${dTag}`;
}
```

### RxJS Subscription Variable Order

```javascript
// ❌ WRONG - "Cannot access 'sub' before initialization"
let sub = eventStore.replaceable({...}).subscribe((event) => {
  if (sub) sub.unsubscribe(); // sub not initialized yet!
});

// ✅ CORRECT - Declare first, then assign
/** @type {import('rxjs').Subscription | undefined} */
let sub;
sub = eventStore.replaceable({...}).subscribe((event) => {
  if (sub) sub.unsubscribe();
});
```

### Hooks Cannot Be Called from Async Handlers

```javascript
// ❌ WRONG - Causes "effect_orphan" error
async function handleClick() {
  const getProfile = useUserProfile(pubkey); // FAILS
}

// ✅ CORRECT - Call hooks during component initialization
// In template:
{@const getProfile = useUserProfile(pubkey)}
```

## Project Structure

```
src/
├── lib/
│   ├── components/     # Svelte components
│   │   ├── calendar/   # Calendar-related components
│   │   ├── community/  # Community views and management
│   │   ├── educational/# AMB content components
│   │   ├── icons/      # Icon components (by category)
│   │   ├── reactions/  # NIP-25 reactions
│   │   └── shared/     # Reusable components
│   ├── helpers/        # Utility functions
│   │   └── educational/# SKOS loader, search builders
│   ├── loaders/        # Applesauce loaders
│   ├── models/         # Custom applesauce models
│   ├── stores/         # Svelte reactive stores
│   │   ├── nostr-infrastructure.svelte.js  # EventStore, RelayPool
│   │   ├── accounts.svelte.js              # User authentication
│   │   ├── config.svelte.js                # Runtime configuration
│   │   └── calendar-*.svelte.js            # Calendar domain
│   └── types/          # JSDoc types
├── routes/
│   ├── calendar/       # Calendar routes
│   ├── discover/       # Unified discovery page
│   ├── c/[pubkey]/     # Community pages
│   ├── p/[pubkey]/     # Profile pages
│   └── [naddr=naddr]/  # Dynamic Nostr address routes
└── params/             # SvelteKit param matchers
```

## Important Event Kinds

| Kind | Description |
|------|-------------|
| 0 | User profile (metadata) |
| 1 | Text note |
| 3 | Contact list |
| 5 | Deletion (NIP-09) |
| 7 | Reaction (NIP-25) |
| 10222 | Community definition (Communikey) |
| 30382 | Community relationship - join/leave (Communikey) |
| 30222 | Targeted publication (Communikey) |
| 30023 | Long-form article |
| 30142 | AMB Educational Resource |
| 31922 | Date-based calendar event (NIP-52) |
| 31923 | Time-based calendar event (NIP-52) |

## Communikey Protocol

This app implements the Communikey community specification. Use `/communikey` skill for protocol details.

**Core concepts:**
- **Communities = npubs** - Any keypair can become a community (kind 10222)
- **Membership via kind 30382** - `d` tag = community pubkey, `n` tag = "follow"
- **Targeted publications (kind 30222)** - Share content to multiple communities
- **Exclusive content** - Use `h` tag for community-only content (chat, forum)

**Key implementation files:**
- `src/lib/helpers/community.js` - Join/leave logic
- `src/lib/models/community-relationship.js` - Membership queries
- `src/lib/loaders/community.js` - Community loaders
- `src/lib/loaders/targeted-publications.js` - Targeted publication loaders

## Configuration

Runtime config loaded from `/api/config` endpoint, sourced from `.env`:

```javascript
import { runtimeConfig } from '$lib/stores/config.svelte.js';

// App-specific relays (by content type)
runtimeConfig.appRelays?.calendar      // Calendar events (31922, 31923, 31925)
runtimeConfig.appRelays?.communikey    // Community content (10222, 30382, 30222)
runtimeConfig.appRelays?.educational   // AMB resources (30142)

// Fallback relays (general purpose)
runtimeConfig.fallbackRelays           // Used when no app-specific relays configured

// Other config
runtimeConfig.blossom?.serverUrl       // Blossom file upload server
```

## Publishing & Relay Management

### App-Specific Relays

Each content type has dedicated relays configured via environment variables:

| Category | Env Variable | Event Kinds |
|----------|--------------|-------------|
| calendar | `PUBLIC_CALENDAR_RELAYS` | 31922, 31923, 31924, 31925 |
| communikey | `PUBLIC_COMMUNIKEY_RELAYS` | 10222, 30382, 30222 |
| educational | `PUBLIC_EDUCATIONAL_RELAYS` | 30142 |

```javascript
import { kindToAppRelayCategory, getAppRelaysForCategory } from '$lib/services/app-relay-service.js';

const category = kindToAppRelayCategory(event.kind); // 'calendar' | 'communikey' | 'educational' | null
const relays = getAppRelaysForCategory('calendar');  // string[]
```

### NIP-65 Outbox Model

Publishing uses the outbox model to maximize event discoverability:

```javascript
import { publishEvent } from '$lib/services/publish-service.js';

// Calculates relays automatically:
// 1. Author's write relays (NIP-65)
// 2. Tagged users' read relays (for p-tags)
// 3. App-specific relays (based on event kind)
// 4. Community relays (if h-tag present)
await publishEvent(signedEvent, taggedPubkeys, { communityEvent });
```

**Key services:**
- `src/lib/services/publish-service.js` - Unified publishing with outbox model
- `src/lib/services/relay-service.svelte.js` - NIP-65 relay list helpers
- `src/lib/loaders/relay-list-loader.js` - Loads user's kind 10002 relay lists

### Relay Hints

All `a`, `e`, `p` tags should include relay hints for discoverability:

```javascript
import { buildATagWithHint, buildETagWithHint, buildPTagsWithHints } from '$lib/services/publish-service.js';

// Instead of: ['a', coordinate]
const aTag = await buildATagWithHint('31923:pubkey:identifier');
// Returns: ['a', '31923:pubkey:identifier', 'wss://relay.example.com']

// Instead of: ['e', eventId]
const eTag = await buildETagWithHint(eventId, authorPubkey);
// Returns: ['e', eventId, 'wss://relay.example.com']

// Instead of: ['p', pubkey]
const pTags = await buildPTagsWithHints([pubkey1, pubkey2]);
// Returns: [['p', pubkey1, 'wss://...'], ['p', pubkey2, 'wss://...']]
```

## Educational Content (AMB - kind 30142)

Educational content uses the AMB (Allgemeines Metadatenprofil) spec with JSON-flattening:

- Search via NIP-50 `search` filter parameter
- SKOS vocabularies for classification (learningResourceType, about, audience)
- Special relay for AMB indexing: `runtimeConfig.educational.ambRelays`

### SKOS Filter Pattern
```javascript
// Use concept IDs, not labels
parts.push(`learningResourceType.id:${concept.id}`);
// Example: learningResourceType.id:https://w3id.org/kim/hcrt/text
```

## Calendar Events (NIP-52)

- Kind 31922: Date-based (all-day events)
- Kind 31923: Time-based (specific times)
- Required tags: `d` (identifier), `title`, `start`
- Always validate before display: `validateCalendarEvent(event)`

## SSR Considerations

Nostr-dependent routes must disable SSR:

```javascript
// +page.js
export const ssr = false;
export const prerender = false;

export async function load({ params }) {
  return { naddr: params.naddr };
}
```

Then fetch data client-side in the component using `$effect()`.

## Development Environment

### Nix (Recommended)

The project uses Nix flakes for reproducible development environments:

```bash
# Environment auto-activates with direnv
direnv allow

# Or manually enter the dev shell
nix develop
```

The `flake.nix` provides:
- Node.js 22
- pnpm

### Commands

```bash
pnpm install         # Install dependencies
pnpm run dev         # Start dev server
pnpm run build       # Production build
pnpm run check       # TypeScript checking
pnpm run lint        # Prettier + ESLint
pnpm run format      # Auto-format code
pnpm run machine-translate  # i18n translation
```

## Design Principles

1. **DRY** - Reuse functionality wherever possible
2. **Applesauce First** - ALWAYS use applesauce for Nostr operations
3. **Comments** - Keep small and concise, only where necessary
4. **Use MCPs** - For Nostr protocol or technical documentation lookup

## Reference Files

- `memory-bank/systemPatterns.md` - Detailed architecture patterns
- `memory-bank/activeContext.md` - Current work focus and recent changes
- `memory-bank/progress.md` - Feature status and roadmap
- `memory-bank/nips/edufeed.md` - AMB NIP specification
- `memory-bank/nips/communikey_nip.asciidoc` - Communikey community spec

## Skills

- `/communikey` - Communikey protocol (kinds 10222, 30382, 30222) for community management
