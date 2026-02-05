import { stopRelay } from './mock-relay.js';

export default async function globalTeardown() {
	if (globalThis.__MOCK_RELAY__) {
		await stopRelay(globalThis.__MOCK_RELAY__);
		console.log('[E2E Teardown] Mock relay stopped');
	}
	if (globalThis.__HANGING_RELAY__) {
		await stopRelay(globalThis.__HANGING_RELAY__);
		console.log('[E2E Teardown] Hanging relay stopped');
	}
}
