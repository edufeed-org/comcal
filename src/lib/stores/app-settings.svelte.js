/**
 * App Settings Store
 * Manages application-wide settings with localStorage persistence
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'app-settings';

/**
 * Default settings
 */
const defaultSettings = {
	debugMode: false
};

/**
 * Load settings from localStorage
 * @returns {typeof defaultSettings}
 */
function loadSettings() {
	if (!browser) return { ...defaultSettings };
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return { ...defaultSettings, ...JSON.parse(stored) };
		}
	} catch (e) {
		console.error('Failed to load app settings:', e);
	}
	return { ...defaultSettings };
}

/**
 * Save settings to localStorage
 * @param {typeof defaultSettings} settings
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
	}
};
