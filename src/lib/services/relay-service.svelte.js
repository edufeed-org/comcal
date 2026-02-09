/**
 * Relay Selection Service - NIP-65 implementation
 * Manages relay list fetching, caching, and selection for outbox model
 */
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { eventStore, pool } from '$lib/stores/nostr-infrastructure.svelte.js';
import { runtimeConfig } from '$lib/stores/config.svelte.js';
import { RelayListModel } from '$lib/models/relay-list-model.js';
import { createRelayListLoader } from '$lib/loaders/relay-list-loader.js';

/**
 * Get relay list lookup relays from runtime config
 * @returns {string[]}
 */
function getLookupRelays() {
  return runtimeConfig.relayListLookupRelays || [];
}

/**
 * Get default/fallback relays from runtime config
 * Used for users without kind 10002 relay list
 * @returns {string[]}
 */
function getDefaultRelays() {
  return runtimeConfig.fallbackRelays || [];
}

// Cache for relay lists (pubkey -> { writeRelays, readRelays, fetchedAt })
/** @type {SvelteMap<string, {writeRelays: string[], readRelays: string[], fetchedAt: number}>} */
const relayListCache = new SvelteMap();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch relay list for a pubkey (with caching)
 * @param {string} pubkey - User's public key
 * @returns {Promise<{writeRelays: string[], readRelays: string[]} | null>}
 */
export async function fetchRelayList(pubkey) {
  // Check cache
  const cached = relayListCache.get(pubkey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached;
  }

  // Fetch from relays
  return new Promise((resolve) => {
    const loader = createRelayListLoader(pool, getLookupRelays(), eventStore, pubkey);

    let resolved = false;
    /** @type {import('rxjs').Subscription | undefined} */
    let subscription;
    /** @type {import('rxjs').Subscription | undefined} */
    let loaderSub;

    const cleanup = () => {
      subscription?.unsubscribe();
      loaderSub?.unsubscribe();
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    }, 3000); // 3 second timeout

    // Subscribe to model for parsed relay list
    subscription = eventStore.model(RelayListModel, pubkey).subscribe((relayList) => {
      if (relayList && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        cleanup();

        const cacheEntry = {
          ...relayList,
          fetchedAt: Date.now()
        };
        relayListCache.set(pubkey, cacheEntry);
        resolve(cacheEntry);
      }
    });

    // Start loading kind 10002 events
    loaderSub = loader()().subscribe();
  });
}

/**
 * Get write relays for a user (used when downloading events FROM that user)
 * Falls back to defaultRelays if no relay list found
 * @param {string} pubkey - User's public key
 * @returns {Promise<string[]>}
 */
export async function getWriteRelays(pubkey) {
  const relayList = await fetchRelayList(pubkey);
  if (relayList && relayList.writeRelays.length > 0) {
    return relayList.writeRelays;
  }
  return getDefaultRelays();
}

/**
 * Get read relays for a user (used when publishing events ABOUT that user)
 * Falls back to defaultRelays if no relay list found
 * @param {string} pubkey - User's public key
 * @returns {Promise<string[]>}
 */
export async function getReadRelays(pubkey) {
  const relayList = await fetchRelayList(pubkey);
  if (relayList && relayList.readRelays.length > 0) {
    return relayList.readRelays;
  }
  return getDefaultRelays();
}

/**
 * Get primary write relay for a user (for relay hints in tags)
 * @param {string} pubkey - User's public key
 * @returns {Promise<string>}
 */
export async function getPrimaryWriteRelay(pubkey) {
  const relayList = await fetchRelayList(pubkey);
  if (relayList && relayList.writeRelays.length > 0) {
    return relayList.writeRelays[0];
  }
  return getDefaultRelays()[0];
}

/**
 * Calculate publish relays for outbox model
 * Sends to: author's write relays + all tagged users' read relays
 * @param {string} authorPubkey - Event author's public key
 * @param {string[]} taggedPubkeys - Array of pubkeys tagged in the event
 * @returns {Promise<string[]>}
 */
export async function getPublishRelays(authorPubkey, taggedPubkeys = []) {
  const relaySet = new SvelteSet();

  // Add author's write relays
  const authorRelays = await getWriteRelays(authorPubkey);
  authorRelays.forEach((r) => relaySet.add(r));

  // Add each tagged user's read relays (limit to 2 per user to avoid too many)
  if (taggedPubkeys.length > 0) {
    await Promise.all(
      taggedPubkeys.map(async (pubkey) => {
        const readRelays = await getReadRelays(pubkey);
        readRelays.slice(0, 2).forEach((r) => relaySet.add(r));
      })
    );
  }

  return Array.from(relaySet);
}

/**
 * Clear cache (for testing or forced refresh)
 */
export function clearRelayListCache() {
  relayListCache.clear();
}

/**
 * Invalidate cache for a specific pubkey (after saving new relay list)
 * @param {string} pubkey - User's public key
 */
export function invalidateRelayListCache(pubkey) {
  relayListCache.delete(pubkey);
}

/**
 * Get relay list lookup relays (for infrastructure)
 * @returns {string[]}
 */
export function getRelayListLookupRelays() {
  return getLookupRelays();
}
