/**
 * Relay Resolution Timing Tests
 *
 * Tests the timing issue where discover page loaders resolve relays
 * at mount time, before user override relays are loaded from kind 30002.
 * This causes user-specific relays (e.g. ws://localhost:3334) to never be queried.
 *
 * Also tests normalizeURL behavior with ws:// protocol URLs.
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeURL } from 'applesauce-core/helpers';

describe('Relay resolution timing simulation', () => {
	// Simulate the app-relay-service cache and getAppRelaysForCategory behavior
	let userOverrideCache;
	const serverDefaults = {
		educational: ['wss://amb-relay.edufeed.org'],
		calendar: ['wss://calendar-relay.example.com'],
		longform: ['wss://longform-relay.example.com']
	};

	function getAppRelaysForCategory(category) {
		const userOverride = userOverrideCache.get(category) || [];
		if (userOverride.length > 0) {
			return userOverride;
		}
		return serverDefaults[category] || [];
	}

	function getEducationalRelays() {
		return getAppRelaysForCategory('educational');
	}

	beforeEach(() => {
		userOverrideCache = new Map();
	});

	it('should return only server defaults when cache is empty', () => {
		const relays = getEducationalRelays();
		expect(relays).toEqual(['wss://amb-relay.edufeed.org']);
		expect(relays).not.toContain('ws://localhost:3334');
	});

	it('should return user override after cache is populated', () => {
		// Simulate user override loading (async, arrives later)
		userOverrideCache.set('educational', [
			'wss://amb-relay.edufeed.org',
			'ws://localhost:3334'
		]);

		const relays = getEducationalRelays();
		expect(relays).toContain('wss://amb-relay.edufeed.org');
		expect(relays).toContain('ws://localhost:3334');
	});

	it('should demonstrate the timing bug: relays resolved before cache populated', () => {
		// Step 1: Loader resolves relays at mount time (cache empty)
		const initialRelays = getEducationalRelays();
		expect(initialRelays).toEqual(['wss://amb-relay.edufeed.org']);

		// Step 2: User override arrives asynchronously (later)
		userOverrideCache.set('educational', [
			'wss://amb-relay.edufeed.org',
			'ws://localhost:3334'
		]);

		// Step 3: The loader still has the initial relay list - it doesn't re-resolve
		// This documents the bug: initialRelays is stale
		expect(initialRelays).not.toContain('ws://localhost:3334');

		// Step 4: But getEducationalRelays() NOW returns the correct list
		const currentRelays = getEducationalRelays();
		expect(currentRelays).toContain('ws://localhost:3334');
	});

	it('should detect new relays that need supplemental loading', () => {
		// Initial relay set at mount time
		const initialRelays = new Set(getEducationalRelays());
		expect(initialRelays.size).toBe(1);

		// User override arrives
		userOverrideCache.set('educational', [
			'wss://amb-relay.edufeed.org',
			'ws://localhost:3334'
		]);

		// Detect new relays not in the initial set
		const currentRelays = getEducationalRelays();
		const newRelays = currentRelays.filter((r) => !initialRelays.has(r));

		expect(newRelays).toEqual(['ws://localhost:3334']);
		expect(newRelays.length).toBe(1);
	});

	it('should not create supplemental loaders when no new relays appear', () => {
		// User override has same relays as server defaults
		userOverrideCache.set('educational', ['wss://amb-relay.edufeed.org']);

		const initialRelays = new Set(getEducationalRelays());
		const currentRelays = getEducationalRelays();
		const newRelays = currentRelays.filter((r) => !initialRelays.has(r));

		expect(newRelays.length).toBe(0);
	});

	it('should handle user override completely replacing server defaults', () => {
		// User sets a custom relay that replaces the server default entirely
		userOverrideCache.set('educational', ['ws://localhost:3334']);

		const relays = getEducationalRelays();
		// User override replaces server defaults
		expect(relays).toEqual(['ws://localhost:3334']);
		expect(relays).not.toContain('wss://amb-relay.edufeed.org');
	});
});

describe('normalizeURL with ws:// protocol', () => {
	it('should handle ws:// URLs (not just wss://)', () => {
		const normalized = normalizeURL('ws://localhost:3334');
		expect(normalized).toBeDefined();
		expect(typeof normalized).toBe('string');
	});

	it('should add trailing slash to ws:// URLs', () => {
		const normalized = normalizeURL('ws://localhost:3334');
		expect(normalized).toBe('ws://localhost:3334/');
	});

	it('should preserve ws:// protocol (not upgrade to wss://)', () => {
		const normalized = normalizeURL('ws://localhost:3334');
		expect(normalized.startsWith('ws://')).toBe(true);
		expect(normalized.startsWith('wss://')).toBe(false);
	});

	it('should normalize ws:// URL with trailing slash consistently', () => {
		const url1 = normalizeURL('ws://localhost:3334');
		const url2 = normalizeURL('ws://localhost:3334/');
		expect(url1).toBe(url2);
	});

	it('should treat ws:// and wss:// URLs as different', () => {
		const ws = normalizeURL('ws://relay.example.com');
		const wss = normalizeURL('wss://relay.example.com');
		expect(ws).not.toBe(wss);
	});

	it('should normalize ws://localhost with port', () => {
		const normalized = normalizeURL('ws://localhost:3334');
		expect(normalized).toContain('localhost');
		expect(normalized).toContain('3334');
	});
});

describe('Supplemental relay loading pattern', () => {
	it('should track queried relays and detect new ones across multiple updates', () => {
		const queriedRelays = new Set(['wss://amb-relay.edufeed.org']);

		// First update: user adds localhost
		const update1 = ['wss://amb-relay.edufeed.org', 'ws://localhost:3334'];
		const newRelays1 = update1.filter((r) => !queriedRelays.has(r));
		expect(newRelays1).toEqual(['ws://localhost:3334']);

		// Track the new relay
		newRelays1.forEach((r) => queriedRelays.add(r));

		// Second update: same relays - no new ones
		const update2 = ['wss://amb-relay.edufeed.org', 'ws://localhost:3334'];
		const newRelays2 = update2.filter((r) => !queriedRelays.has(r));
		expect(newRelays2.length).toBe(0);

		// Third update: user adds another relay
		const update3 = [
			'wss://amb-relay.edufeed.org',
			'ws://localhost:3334',
			'wss://new-relay.example.com'
		];
		const newRelays3 = update3.filter((r) => !queriedRelays.has(r));
		expect(newRelays3).toEqual(['wss://new-relay.example.com']);
	});
});
