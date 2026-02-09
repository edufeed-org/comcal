/**
 * Blossom Settings Service - Save NIP-B7 Blossom server preferences (kind 10063)
 */

import { publishEvent } from './publish-service.js';
import { manager } from '$lib/stores/accounts.svelte.js';
import { runtimeConfig } from '$lib/stores/config.svelte.js';

/**
 * Get default Blossom servers from runtime config
 * @returns {string[]}
 */
export function getDefaultBlossomServers() {
  return (
    runtimeConfig.defaultBlossomServers || [
      'https://blossom.primal.net',
      'https://cdn.satellite.earth'
    ]
  );
}

/**
 * Save Blossom server list by publishing a kind 10063 event
 * @param {Array<{url: string}>} servers - Server configuration
 * @param {string} userPubkey - User's public key
 * @returns {Promise<Object>} The signed and published event
 */
export async function saveBlossomServers(servers, userPubkey) {
  if (!manager.active?.signer) {
    throw new Error('No signer available. Please login first.');
  }

  if (!servers || servers.length === 0) {
    throw new Error('At least one Blossom server is required');
  }

  // Build server tags
  const tags = servers.map((server) => ['server', server.url]);

  // Create the event (kind 10063 - replaceable)
  const event = {
    kind: 10063,
    pubkey: userPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: ''
  };

  try {
    // Sign the event with applesauce-accounts signer
    const signedEvent = await manager.active.signer.signEvent(event);

    // Publish using the outbox model
    const result = await publishEvent(signedEvent);

    if (!result.success) {
      throw new Error('Failed to publish to any relay');
    }

    return signedEvent;
  } catch (error) {
    console.error('Failed to save Blossom server list:', error);
    throw new Error('Failed to save Blossom server list: ' + error.message);
  }
}

/**
 * Validate a Blossom server URL
 * @param {string} url - Server URL to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateBlossomUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmed = url.trim();

  if (!trimmed.startsWith('https://')) {
    return { valid: false, error: 'URL must start with https://' };
  }

  try {
    new URL(trimmed);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Parse a Blossom server list event (kind 10063) into a structured format
 * @param {Object} event - The kind 10063 event
 * @returns {Array<{url: string}>}
 */
export function parseBlossomServerEvent(event) {
  if (!event || !event.tags) return [];

  return event.tags
    .filter((tag) => tag[0] === 'server')
    .map((tag) => ({
      url: tag[1]
    }));
}

/**
 * Get the active blossom server URL for uploading
 * Checks user's kind 10063 event first, falls back to default servers
 * @param {string} userPubkey - User's public key
 * @param {import('applesauce-core').EventStore} eventStore - The event store to check
 * @returns {string} The blossom server URL to use for uploads
 */
export function getActiveBlossomServer(userPubkey, eventStore) {
  // Try to get user's kind 10063 event from the store
  if (userPubkey && eventStore) {
    const blossomEvent = eventStore.getReplaceable(10063, userPubkey);
    if (blossomEvent) {
      const servers = parseBlossomServerEvent(blossomEvent);
      if (servers.length > 0) {
        return servers[0].url;
      }
    }
  }

  // Fall back to default servers
  const defaults = getDefaultBlossomServers();
  return defaults[0] || 'https://blossom.primal.net';
}
