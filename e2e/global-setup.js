import { startRelay } from './mock-relay.js';
import { generateTestEvents } from './test-data.js';

const RELAY_PORT = 9737;
const HANGING_RELAY_PORT = 9738;
const DEBUG = process.env.DEBUG;

export default async function globalSetup() {
  const events = generateTestEvents();
  if (DEBUG) console.log(`[E2E Setup] Generated ${events.length} test events`);

  const relay = await startRelay(RELAY_PORT, events);
  if (DEBUG) console.log(`[E2E Setup] Mock relay running on ws://localhost:${RELAY_PORT}`);

  // Second relay that sends events but never EOSE for kind 30142 (AMB)
  const hangingRelay = await startRelay(HANGING_RELAY_PORT, events, {
    hangEoseForKinds: [30142]
  });
  if (DEBUG)
    console.log(`[E2E Setup] Hanging relay running on ws://localhost:${HANGING_RELAY_PORT}`);

  globalThis.__MOCK_RELAY__ = relay;
  globalThis.__HANGING_RELAY__ = hangingRelay;
}
