/**
 * Relay Verification Helpers for E2E Tests
 *
 * WebSocket-based utilities for verifying that events have been
 * published to Nostr relays during E2E tests.
 */

import WebSocket from 'ws';

// Default relay URLs (matching docker-compose.e2e.yml) - using 17xxx range to avoid port conflicts
export const RELAY_URLS = {
  amb: 'ws://localhost:17001',
  calendar: 'ws://localhost:17002',
  strfry: 'ws://localhost:17003'
};

/**
 * Query a relay for events matching the given filter.
 * Waits for EOSE or timeout.
 *
 * @param {object} filter - Nostr filter object
 * @param {object} [options] - Options
 * @param {string} [options.relay] - Relay WebSocket URL (default: amb-relay)
 * @param {number} [options.timeout] - Timeout in ms (default: 5000)
 * @returns {Promise<object[]>} Array of matching events
 */
export async function queryEventsFromRelay(filter, options = {}) {
  const { relay = RELAY_URLS.amb, timeout = 5000 } = options;

  return new Promise((resolve, reject) => {
    const events = [];
    let ws;

    const timer = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      resolve(events);
    }, timeout);

    try {
      ws = new WebSocket(relay);

      ws.on('open', () => {
        const subId = `e2e-query-${Date.now()}`;
        ws.send(JSON.stringify(['REQ', subId, filter]));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg[0] === 'EVENT') {
            events.push(msg[2]);
          } else if (msg[0] === 'EOSE') {
            clearTimeout(timer);
            ws.close();
            resolve(events);
          }
        } catch (_parseError) {
          // Ignore parse errors, continue listening
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`WebSocket error querying ${relay}: ${err.message}`));
      });

      ws.on('close', () => {
        // If closed before EOSE, resolve with whatever we have
        clearTimeout(timer);
        resolve(events);
      });
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

/**
 * Wait for a specific event to appear on a relay.
 * Useful for verifying newly published events.
 *
 * @param {object} filter - Nostr filter object
 * @param {function} predicate - Function to test each event, returns true when found
 * @param {object} [options] - Options
 * @param {string} [options.relay] - Relay WebSocket URL
 * @param {number} [options.timeout] - Timeout in ms (default: 10000)
 * @param {number} [options.pollInterval] - Polling interval in ms (default: 1000)
 * @returns {Promise<object>} The matching event
 */
export async function waitForEventOnRelay(filter, predicate, options = {}) {
  const { relay = RELAY_URLS.amb, timeout = 10000, pollInterval = 1000 } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const events = await queryEventsFromRelay(filter, { relay, timeout: pollInterval });

    const found = events.find(predicate);
    if (found) {
      return found;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Timeout waiting for event matching filter: ${JSON.stringify(filter)}`);
}

/**
 * Verify that an AMB resource (kind 30142) exists on amb-relay.
 *
 * @param {object} criteria - Search criteria
 * @param {string} [criteria.author] - Author pubkey (hex)
 * @param {string} [criteria.title] - Expected title (name tag)
 * @param {string} [criteria.dTag] - Expected d-tag value
 * @param {number} [timeout] - Timeout in ms (default: 10000)
 * @returns {Promise<object>} The matching event
 */
export async function verifyAMBResourceOnRelay(criteria, timeout = 10000) {
  const filter = {
    kinds: [30142],
    limit: 50
  };

  if (criteria.author) {
    filter.authors = [criteria.author];
  }

  if (criteria.dTag) {
    filter['#d'] = [criteria.dTag];
  }

  const predicate = (event) => {
    // Check title if provided
    if (criteria.title) {
      const nameTag = event.tags?.find((t) => t[0] === 'name');
      if (!nameTag || nameTag[1] !== criteria.title) {
        return false;
      }
    }

    return true;
  };

  return waitForEventOnRelay(filter, predicate, {
    relay: RELAY_URLS.amb,
    timeout
  });
}

/**
 * Get the count of events matching a filter on a relay.
 *
 * @param {object} filter - Nostr filter object
 * @param {object} [options] - Options
 * @returns {Promise<number>} Number of matching events
 */
export async function countEventsOnRelay(filter, options = {}) {
  const events = await queryEventsFromRelay(filter, options);
  return events.length;
}
