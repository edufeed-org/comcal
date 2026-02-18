/**
 * Relay Capabilities Service
 * Detects and caches relay NIP support for intelligent query routing
 */

import { pool } from '$lib/stores/nostr-infrastructure.svelte';

/** @type {Map<string, Set<number>>} */
const relayNipsCache = new Map();

/** Timeout for relay info fetch (ms) */
const RELAY_INFO_TIMEOUT = 2000;

/**
 * Check if a relay supports a specific NIP
 * @param {string} relayUrl
 * @param {number} nip
 * @returns {Promise<boolean>}
 */
export async function relaySupportsNip(relayUrl, nip) {
  if (!relayNipsCache.has(relayUrl)) {
    try {
      const relay = pool.relay(relayUrl);
      // Add timeout - if relay doesn't respond in 2s, assume no NIP-52 support
      const supported = await Promise.race([
        relay.getSupported(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Relay info timeout')), RELAY_INFO_TIMEOUT)
        )
      ]);
      relayNipsCache.set(relayUrl, new Set(supported || []));
    } catch {
      // If we can't get info or timeout, assume standard filter only
      relayNipsCache.set(relayUrl, new Set());
    }
  }
  return relayNipsCache.get(relayUrl)?.has(nip) || false;
}

/**
 * Partition relays by NIP-52 support
 * @param {string[]} relays
 * @returns {Promise<{nip52Relays: string[], standardRelays: string[]}>}
 */
export async function partitionRelaysByNip52Support(relays) {
  const results = await Promise.all(
    relays.map(async (url) => ({ url, supportsNip52: await relaySupportsNip(url, 52) }))
  );
  return {
    nip52Relays: results.filter((r) => r.supportsNip52).map((r) => r.url),
    standardRelays: results.filter((r) => !r.supportsNip52).map((r) => r.url)
  };
}

/**
 * Pre-warm the relay capabilities cache for a list of relays.
 * Call this on page load so pagination doesn't wait for capability detection.
 * @param {string[]} relays
 * @returns {Promise<void>}
 */
export async function preWarmRelayCapabilitiesCache(relays) {
  await Promise.all(relays.map((url) => relaySupportsNip(url, 52)));
}

/**
 * Clear the relay capabilities cache (useful for testing or forced refresh)
 */
export function clearRelayCapabilitiesCache() {
  relayNipsCache.clear();
}
