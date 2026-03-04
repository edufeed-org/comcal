/**
 * Curated Authors Service
 *
 * Restricts primary content (calendar events, AMB resources, articles, community definitions)
 * to specific authors defined in NIP-51 follow sets (kind 30000).
 *
 * Configured via:
 * - CURATED_PUBKEYS_SETS: comma-separated naddr identifiers for kind 30000 follow sets
 * - CURATED_PUBKEYS: comma-separated hex pubkeys or npub-encoded pubkeys (direct)
 *
 * Both sources are unioned together. If either has entries, curated mode is active.
 * When not configured, all functions return null (feature inactive, no filtering applied).
 */
import { nip19 } from 'nostr-tools';
import { pool } from '$lib/stores/nostr-infrastructure.svelte';
import { runtimeConfig } from '$lib/stores/config.svelte.js';
import { getAllLookupRelays } from '$lib/helpers/relay-helper.js';
import { lastValueFrom, toArray } from 'rxjs';

/**
 * Reactive cache of curated author pubkeys.
 * null = feature not configured/active (no filtering)
 * string[] = list of allowed pubkeys (filtering active)
 * @type {string[] | null}
 */
let curatedAuthors = $state(null);

/** Whether direct pubkeys have been lazily parsed from config */
let directPubkeysInitialized = false;

/**
 * Parse direct pubkeys from config on first access (lazy, synchronous).
 * Eliminates timing race — works regardless of when callers run.
 */
function ensureDirectPubkeysInitialized() {
  if (directPubkeysInitialized) return;
  directPubkeysInitialized = true;

  const entries = runtimeConfig.curatedPubkeys;
  if (Array.isArray(entries) && entries.length > 0) {
    const parsed = parseDirectPubkeys(entries);
    if (parsed.length > 0 && curatedAuthors === null) {
      curatedAuthors = parsed;
      console.log('Curated authors: Loaded', parsed.length, 'direct pubkeys');
    }
  }
}

/**
 * Parse direct pubkey entries (hex or npub) into hex pubkeys.
 * Skips invalid entries with a warning.
 * @param {string[]} entries
 * @returns {string[]}
 */
export function parseDirectPubkeys(entries) {
  /** @type {string[]} */
  const pubkeys = [];

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('npub1')) {
      try {
        const decoded = nip19.decode(trimmed);
        if (decoded.type === 'npub') {
          pubkeys.push(/** @type {string} */ (decoded.data));
        } else {
          console.warn('Curated authors: Expected npub, got', decoded.type, 'for', trimmed);
        }
      } catch (err) {
        console.warn('Curated authors: Failed to decode npub:', trimmed, err);
      }
    } else if (/^[0-9a-f]{64}$/i.test(trimmed)) {
      pubkeys.push(trimmed.toLowerCase());
    } else {
      console.warn('Curated authors: Invalid pubkey entry (not hex or npub):', trimmed);
    }
  }

  return pubkeys;
}

/**
 * Check if curated mode is configured (either env var has entries)
 * @returns {boolean}
 */
export function isCuratedModeConfigured() {
  /** @type {string[]} */
  const sets = runtimeConfig.curatedPubkeysSets;
  /** @type {string[]} */
  const direct = runtimeConfig.curatedPubkeys;
  return (Array.isArray(sets) && sets.length > 0) || (Array.isArray(direct) && direct.length > 0);
}

/**
 * Check if curated mode is active (configured AND loaded with >0 pubkeys)
 * @returns {boolean}
 */
export function isCuratedModeActive() {
  return curatedAuthors !== null && curatedAuthors.length > 0;
}

/**
 * Get the curated author pubkeys for use in relay filters.
 * Returns null when curated mode is not configured (no filtering should be applied).
 * Returns string[] when active (add as `authors` filter).
 * @returns {string[] | null}
 */
export function getCuratedAuthors() {
  ensureDirectPubkeysInitialized();
  return curatedAuthors;
}

/**
 * Check if a pubkey is in the curated authors list.
 * Returns true if curated mode is not active (all authors allowed).
 * @param {string} pubkey
 * @returns {boolean}
 */
export function isAllowedAuthor(pubkey) {
  ensureDirectPubkeysInitialized();
  if (curatedAuthors === null) return true;
  return curatedAuthors.includes(pubkey);
}

/**
 * Decode naddr identifiers into address pointers.
 * Skips invalid identifiers with a warning.
 * @param {string[]} naddrs
 * @returns {Array<{pubkey: string, identifier: string, relays: string[]}>}
 */
export function decodeNaddrs(naddrs) {
  /** @type {Array<{pubkey: string, identifier: string, relays: string[]}>} */
  const pointers = [];

  for (const naddr of naddrs) {
    try {
      const decoded = nip19.decode(naddr.trim());
      if (decoded.type !== 'naddr') {
        console.warn('Curated authors: Expected naddr, got', decoded.type, 'for', naddr);
        continue;
      }
      const data = /** @type {import('nostr-tools/nip19').AddressPointer} */ (decoded.data);
      if (data.kind !== 30000) {
        console.warn('Curated authors: Expected kind 30000, got', data.kind, 'for', naddr);
        continue;
      }
      pointers.push({
        pubkey: data.pubkey,
        identifier: data.identifier,
        relays: data.relays || []
      });
    } catch (err) {
      console.warn('Curated authors: Failed to decode naddr:', naddr, err);
    }
  }

  return pointers;
}

/**
 * Extract unique p-tag pubkeys from kind 30000 events.
 * @param {import('nostr-tools').Event[]} events
 * @returns {string[]}
 */
export function extractPubkeysFromFollowSets(events) {
  /** @type {string[]} */
  const pubkeys = [];
  for (const event of events) {
    for (const tag of event.tags) {
      if (tag[0] === 'p' && tag[1] && !pubkeys.includes(tag[1])) {
        pubkeys.push(tag[1]);
      }
    }
  }
  return pubkeys;
}

/**
 * Initialize the curated authors cache from direct pubkeys and/or follow sets.
 * Direct pubkeys are available immediately; follow sets require async network fetch.
 * Call this after runtime config is loaded.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initializeCuratedAuthors() {
  if (!isCuratedModeConfigured()) return;

  // Step 1: Ensure direct pubkeys are parsed (may already be done by lazy init)
  ensureDirectPubkeysInitialized();
  const directPubkeys = curatedAuthors ? [...curatedAuthors] : [];

  // Step 2: Fetch follow sets (async, may expand the list)
  /** @type {string[]} */
  const naddrs = runtimeConfig.curatedPubkeysSets;
  const pointers = Array.isArray(naddrs) ? decodeNaddrs(naddrs) : [];

  if (pointers.length === 0) {
    if (directPubkeys.length === 0) {
      console.warn('Curated authors: No valid entries found in either source');
    }
    return;
  }

  console.log('Curated authors: Fetching', pointers.length, 'follow sets');

  try {
    const fallbackRelays = getAllLookupRelays();
    /** @type {import('nostr-tools').Event[]} */
    const allEvents = [];

    for (const pointer of pointers) {
      const relays = pointer.relays.length > 0 ? pointer.relays : fallbackRelays;
      const filter = {
        kinds: [30000],
        authors: [pointer.pubkey],
        '#d': [pointer.identifier]
      };

      try {
        const events = await lastValueFrom(
          pool.request(relays, filter, { timeout: 5000 }).pipe(toArray())
        );
        allEvents.push(...events);
      } catch (err) {
        console.warn('Curated authors: Failed to fetch follow set for', pointer.identifier, err);
      }
    }

    const followSetPubkeys = extractPubkeysFromFollowSets(allEvents);

    // Union direct + follow set pubkeys (deduplicated)
    const allPubkeys = [...directPubkeys, ...followSetPubkeys].filter(
      (pk, i, arr) => arr.indexOf(pk) === i
    );

    if (allPubkeys.length > 0) {
      curatedAuthors = allPubkeys;
      console.log('Curated authors: Loaded', allPubkeys.length, 'allowed pubkeys (total)');
    } else {
      console.warn('Curated authors: No pubkeys found from any source, curated mode inactive');
    }
  } catch (err) {
    console.error('Curated authors: Initialization failed', err);
  }
}

/**
 * Reset curated authors state (for testing)
 */
export function _resetForTesting() {
  curatedAuthors = null;
  directPubkeysInitialized = false;
}
