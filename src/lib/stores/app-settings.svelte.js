/**
 * App Settings Store
 * Manages application-wide settings with localStorage persistence
 */

import { browser } from '$app/environment';
import { runtimeConfig } from '$lib/stores/config.svelte.js';

const STORAGE_KEY = 'app-settings';

/**
 * Default settings
 * @typedef {Object} AppSettings
 * @property {boolean} debugMode
 * @property {'default' | 'stil'} themeFamily
 * @property {'light' | 'dark' | 'system'} colorMode
 * @property {boolean} gatedMode
 */

/**
 * Map theme name to themeFamily and colorMode
 * @param {'light' | 'dark' | 'stil' | 'stil-dark'} theme
 * @returns {{themeFamily: 'default' | 'stil', colorMode: 'light' | 'dark'}}
 */
function parseThemeToSettings(theme) {
	switch (theme) {
		case 'stil':
			return { themeFamily: 'stil', colorMode: 'light' };
		case 'stil-dark':
			return { themeFamily: 'stil', colorMode: 'dark' };
		case 'dark':
			return { themeFamily: 'default', colorMode: 'dark' };
		case 'light':
		default:
			return { themeFamily: 'default', colorMode: 'light' };
	}
}

/**
 * Get default settings (uses runtime config)
 * @returns {AppSettings}
 */
function getDefaultSettings() {
	// Get system theme preference
	const prefersDark = browser && window.matchMedia('(prefers-color-scheme: dark)').matches;
	
	// Use runtime config for default theme, falling back to hardcoded defaults
	const defaultTheme = /** @type {'light' | 'dark' | 'stil' | 'stil-dark'} */ (
		prefersDark 
			? (runtimeConfig.ui?.defaultDarkTheme || 'dark')
			: (runtimeConfig.ui?.defaultLightTheme || 'light')
	);
	
	const { themeFamily } = parseThemeToSettings(defaultTheme);
	
	return {
		debugMode: false,
		themeFamily,
		colorMode: 'system', // Always default to system, but with correct theme family
		gatedMode: runtimeConfig.gatedMode?.default ?? false
	};
}

/**
 * Migrate old theme format to new themeFamily + colorMode format
 * @param {any} stored - Stored settings object
 * @returns {AppSettings}
 */
function migrateSettings(stored) {
	const defaults = getDefaultSettings();
	
	// If new format already exists, use it
	if (stored.themeFamily !== undefined && stored.colorMode !== undefined) {
		return {
			debugMode: stored.debugMode ?? defaults.debugMode,
			themeFamily: stored.themeFamily ?? defaults.themeFamily,
			colorMode: stored.colorMode ?? defaults.colorMode,
			gatedMode: stored.gatedMode ?? defaults.gatedMode
		};
	}
	
	// Migrate old 'theme' format to new format
	const oldTheme = stored.theme;
	let themeFamily = defaults.themeFamily;
	let colorMode = defaults.colorMode;
	
	if (oldTheme === 'system') {
		themeFamily = 'default';
		colorMode = 'system';
	} else if (oldTheme === 'light') {
		themeFamily = 'default';
		colorMode = 'light';
	} else if (oldTheme === 'dark') {
		themeFamily = 'default';
		colorMode = 'dark';
	} else if (oldTheme === 'stil') {
		themeFamily = 'stil';
		colorMode = 'light';
	} else if (oldTheme === 'stil-dark') {
		themeFamily = 'stil';
		colorMode = 'dark';
	}
	
	return {
		debugMode: stored.debugMode ?? defaults.debugMode,
		themeFamily,
		colorMode,
		gatedMode: stored.gatedMode ?? defaults.gatedMode
	};
}

/**
 * Load settings from localStorage
 * @returns {AppSettings}
 */
function loadSettings() {
	const defaults = getDefaultSettings();
	if (!browser) return defaults;
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return migrateSettings(parsed);
		}
	} catch (e) {
		console.error('Failed to load app settings:', e);
	}
	return defaults;
}

/**
 * Save settings to localStorage
 * @param {AppSettings} settings
 */
function saveSettings(settings) {
	if (!browser) return;
	
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch (e) {
		console.error('Failed to save app settings:', e);
	}
}

// Reactive settings state
let settings = $state(loadSettings());

// System theme preference detection
/** @type {'light' | 'dark'} */
let systemTheme = $state('light');

if (browser) {
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	systemTheme = /** @type {'light' | 'dark'} */ (mediaQuery.matches ? 'dark' : 'light');
	
	// Listen for system theme changes
	mediaQuery.addEventListener('change', (e) => {
		systemTheme = /** @type {'light' | 'dark'} */ (e.matches ? 'dark' : 'light');
	});
}

/**
 * Track if app settings have been initialized to prevent re-initialization
 */
let initialized = false;

/**
 * Initialize app settings with runtime config
 * Called from the layout after runtime config is loaded
 * Only updates settings if no localStorage value exists
 */
export function initializeAppSettings() {
	if (!browser || initialized) return;
	initialized = true; // Mark as initialized BEFORE modifying state
	
	// Check if user has saved preferences
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		// User has preferences, don't override them
		return;
	}
	
	// No saved preferences - apply runtime config defaults
	const defaults = getDefaultSettings();
	settings = defaults;
	
	console.log('App settings initialized with runtime config defaults:', defaults);
}

/**
 * Compute effective theme reactively
 * Combines themeFamily + colorMode to produce the actual theme name
 * @type {'light' | 'dark' | 'stil' | 'stil-dark'}
 */
let effectiveTheme = $derived(
	(settings.colorMode === 'dark' || (settings.colorMode === 'system' && systemTheme === 'dark'))
		? (settings.themeFamily === 'stil' ? 'stil-dark' : 'dark')
		: (settings.themeFamily === 'stil' ? 'stil' : 'light')
);

/**
 * App settings store with reactive getters and setters
 */
export const appSettings = {
	/**
	 * Get debug mode status
	 */
	get debugMode() {
		return settings.debugMode;
	},
	
	/**
	 * Set debug mode status
	 * @param {boolean} value
	 */
	set debugMode(value) {
		settings.debugMode = value;
		saveSettings(settings);
	},
	
	/**
	 * Toggle debug mode
	 */
	toggleDebugMode() {
		this.debugMode = !this.debugMode;
	},
	
	/**
	 * Get theme family preference
	 * @returns {'default' | 'stil'}
	 */
	get themeFamily() {
		return settings.themeFamily;
	},
	
	/**
	 * Set theme family preference
	 * @param {'default' | 'stil'} value
	 */
	set themeFamily(value) {
		settings.themeFamily = /** @type {'default' | 'stil'} */ (value);
		saveSettings(settings);
	},
	
	/**
	 * Get color mode preference
	 * @returns {'light' | 'dark' | 'system'}
	 */
	get colorMode() {
		return settings.colorMode;
	},
	
	/**
	 * Set color mode preference
	 * @param {'light' | 'dark' | 'system'} value
	 */
	set colorMode(value) {
		settings.colorMode = /** @type {'light' | 'dark' | 'system'} */ (value);
		saveSettings(settings);
	},
	
	/**
	 * Get effective theme (resolves family + mode to actual theme)
	 * @returns {'light' | 'dark' | 'stil' | 'stil-dark'}
	 */
	get effectiveTheme() {
		return effectiveTheme;
	},

	/**
	 * Get gated mode status
	 * Returns forced value if GATED_MODE_FORCE is true, otherwise user preference
	 * @returns {boolean}
	 */
	get gatedMode() {
		// If force is enabled, always return true regardless of user preference
		if (runtimeConfig.gatedMode?.force) {
			return true;
		}
		return settings.gatedMode;
	},

	/**
	 * Set gated mode status
	 * No-op if GATED_MODE_FORCE is true
	 * @param {boolean} value
	 */
	set gatedMode(value) {
		// Don't allow changes if force mode is enabled
		if (runtimeConfig.gatedMode?.force) {
			return;
		}
		settings.gatedMode = value;
		saveSettings(settings);
	},

	/**
	 * Check if gated mode can be toggled by user
	 * @returns {boolean}
	 */
	get canToggleGatedMode() {
		return !runtimeConfig.gatedMode?.force;
	},

	/**
	 * Toggle gated mode
	 * Reloads page to ensure all subscriptions use the new relay configuration
	 */
	toggleGatedMode() {
		this.gatedMode = !this.gatedMode;
		// Reload page to kill active subscriptions and refetch with new relay set
		if (browser) {
			window.location.reload();
		}
	}
};
