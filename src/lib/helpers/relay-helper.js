/**
 * Relay Helper - Centralized relay retrieval with gated mode support
 *
 * All loaders should use this helper instead of directly accessing runtimeConfig.
 * This ensures gated mode is consistently applied across the application.
 *
 * When gated mode is active, fallback relays are excluded and only app-specific
 * relays are used for fetching content.
 */
import { runtimeConfig } from '$lib/stores/config.svelte.js';
import { appSettings } from '$lib/stores/app-settings.svelte.js';

/**
 * Check if gated mode is currently active
 * @returns {boolean}
 */
export function isGatedModeActive() {
	return appSettings.gatedMode;
}

/**
 * Get fallback relays - returns empty array if gated mode is active
 * @returns {string[]}
 */
export function getFallbackRelays() {
	if (isGatedModeActive()) {
		return [];
	}
	return runtimeConfig.fallbackRelays || [];
}

/**
 * Get calendar relays with optional fallback
 * @returns {string[]}
 */
export function getCalendarRelays() {
	const appRelays = runtimeConfig.appRelays?.calendar || [];
	return [...appRelays, ...getFallbackRelays()];
}

/**
 * Get communikey relays with optional fallback
 * @returns {string[]}
 */
export function getCommunikeyRelays() {
	const appRelays = runtimeConfig.appRelays?.communikey || [];
	return [...appRelays, ...getFallbackRelays()];
}

/**
 * Get educational (AMB) relays with optional fallback
 * @returns {string[]}
 */
export function getEducationalRelays() {
	const appRelays = runtimeConfig.appRelays?.educational || [];
	const combined = [...appRelays, ...getFallbackRelays()];
	return [...new Set(combined)]; // Deduplicate
}

/**
 * Get article/longform relays with optional fallback
 * @returns {string[]}
 */
export function getArticleRelays() {
	const appRelays = runtimeConfig.appRelays?.longform || [];
	// If no longform relays configured, use fallback relays only (but gated mode still applies)
	if (appRelays.length === 0) {
		return getFallbackRelays();
	}
	return [...appRelays, ...getFallbackRelays()];
}

/**
 * Get all lookup relays for EventStore
 * Combines all app relays + conditional fallback
 * @returns {string[]}
 */
export function getAllLookupRelays() {
	return [
		...(runtimeConfig.appRelays?.calendar || []),
		...(runtimeConfig.appRelays?.communikey || []),
		...(runtimeConfig.appRelays?.educational || []),
		...(runtimeConfig.appRelays?.longform || []),
		...getFallbackRelays()
	];
}
