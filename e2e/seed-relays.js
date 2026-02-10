import WebSocket from 'ws';
import { generateTestEvents, RELAY_URLS } from './test-data.js';

const DEBUG = process.env.DEBUG;

// Re-export for global-setup.js
export { RELAY_URLS };

// Kind to relay routing
// AMB resources go to amb-relay
// Calendar events go to calendar-relay
// Everything else goes to strfry
const KIND_ROUTING = {
  30142: 'amb',
  31922: 'calendar',
  31923: 'calendar',
  31924: 'calendar',
  31925: 'calendar'
};

/**
 * Get the relay key for an event kind
 * @param {number} kind
 * @returns {'amb' | 'calendar' | 'strfry'}
 */
function getRelayForKind(kind) {
  return KIND_ROUTING[kind] || 'strfry';
}

/**
 * Seed events to a specific relay
 * @param {string} url
 * @param {object[]} events
 * @returns {Promise<number>} Number of events seeded
 */
async function seedRelay(url, events) {
  if (events.length === 0) return 0;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let completed = 0;
    let timeoutId;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };

    ws.on('open', () => {
      for (const event of events) {
        pending.set(event.id, event);
        ws.send(JSON.stringify(['EVENT', event]));
      }

      // Set timeout after sending all events
      timeoutId = setTimeout(() => {
        cleanup();
        if (pending.size > 0) {
          reject(new Error(`Seeding timeout for ${url}: ${pending.size} events not acknowledged`));
        } else {
          resolve(completed);
        }
      }, 30000);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'OK') {
          const [, eventId, success, message] = msg;
          if (success) {
            pending.delete(eventId);
            completed++;
          } else if (DEBUG) {
            console.warn(`[Seeder] Event ${eventId} rejected: ${message}`);
          }

          if (pending.size === 0) {
            cleanup();
            resolve(completed);
          }
        }
      } catch {
        // Ignore parse errors
      }
    });

    ws.on('error', (err) => {
      cleanup();
      reject(new Error(`WebSocket error for ${url}: ${err.message}`));
    });

    ws.on('close', () => {
      if (pending.size > 0 && !timeoutId) {
        reject(new Error(`Connection closed for ${url} with ${pending.size} pending events`));
      }
    });
  });
}

/**
 * Seed all test events to the appropriate relays based on kind
 * @returns {Promise<void>}
 */
export async function seedAllRelays() {
  const events = generateTestEvents();

  // Group events by target relay
  const groups = { amb: [], calendar: [], strfry: [] };
  for (const event of events) {
    const target = getRelayForKind(event.kind);
    groups[target].push(event);
  }

  if (DEBUG) {
    console.log(
      `[Seeder] Routing: AMB=${groups.amb.length}, Calendar=${groups.calendar.length}, Strfry=${groups.strfry.length}`
    );
  }

  // Seed all relays in parallel
  const results = await Promise.all([
    seedRelay(RELAY_URLS.amb, groups.amb),
    seedRelay(RELAY_URLS.calendar, groups.calendar),
    seedRelay(RELAY_URLS.strfry, groups.strfry)
  ]);

  const total = results.reduce((sum, count) => sum + count, 0);
  if (DEBUG) {
    console.log(`[Seeder] Seeded ${total} events to ${Object.keys(RELAY_URLS).length} relays`);
  }
}
