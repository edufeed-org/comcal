/**
 * Runtime Configuration Store
 * This store holds the application configuration loaded from the API endpoint.
 * It provides a reactive way to access config throughout the application.
 */

import { appConfig } from '$lib/config.js';

/**
 * Runtime configuration state
 * Initialized with defaults from appConfig, then updated with runtime values
 */
let config = $state(appConfig);

/**
 * Track if config has been initialized to prevent re-initialization
 */
let initialized = false;

/**
 * Initialize or update the configuration
 * Called from the root layout after loading config from API
 * @param {any} runtimeConfig - Configuration from API endpoint
 */
export function initializeConfig(runtimeConfig) {
	if (initialized) return; // Skip if already initialized
	if (!runtimeConfig) {
		console.warn('Runtime config not available, using defaults');
		return;
	}

	initialized = true; // Mark as initialized BEFORE modifying state

	// Deep merge runtime config with defaults
	config = {
		...appConfig,
		name: runtimeConfig.appName || appConfig.name,
		logo: runtimeConfig.appLogo || appConfig.logo,
		gitRepo: runtimeConfig.gitRepo || appConfig.gitRepo,
		calendar: {
			...appConfig.calendar,
			...runtimeConfig.calendar,
			// Keep the defaultRelays and fallbackRelays from runtime
			defaultRelays: runtimeConfig.relays || appConfig.calendar.defaultRelays,
			fallbackRelays: runtimeConfig.fallbackRelays || appConfig.calendar.fallbackRelays,
		},
		signup: {
			...appConfig.signup,
			...runtimeConfig.signup,
		},
		blossom: {
			...appConfig.blossom,
			...runtimeConfig.blossom,
		},
		geocoding: {
			...appConfig.geocoding,
			...runtimeConfig.geocoding,
			validation: {
				...appConfig.geocoding.validation,
				...runtimeConfig.geocoding?.validation,
			}
		},
		imprint: {
			...appConfig.imprint,
			...runtimeConfig.imprint,
			address: {
				...appConfig.imprint.address,
				...runtimeConfig.imprint?.address,
			},
			contact: {
				...appConfig.imprint.contact,
				...runtimeConfig.imprint?.contact,
			}
		},
		educational: {
			...appConfig.educational,
			...runtimeConfig.educational,
			// Use ambRelays from runtime config
			ambRelays: runtimeConfig.ambRelays || appConfig.educational.ambRelays,
			vocabularies: {
				...appConfig.educational.vocabularies,
				...runtimeConfig.educational?.vocabularies,
			}
		},
		ui: {
			...appConfig.ui,
			...runtimeConfig.ui
		}
	};

	console.log('Config initialized with runtime values');
}

/**
 * Reactive config getter
 * Use this to access config in components: const cfg = getConfig();
 */
export function getConfig() {
	return config;
}

/**
 * Export individual config sections for convenience
 */
export const runtimeConfig = {
	get value() {
		return config;
	},
	get appName() {
		return config.name;
	},
	get appLogo() {
		return config.logo;
	},
	get gitRepo() {
		return config.gitRepo;
	},
	get calendar() {
		return config.calendar;
	},
	get signup() {
		return config.signup;
	},
	get blossom() {
		return config.blossom;
	},
	get geocoding() {
		return config.geocoding;
	},
	get imprint() {
		return config.imprint;
	},
	get educational() {
		return config.educational;
	},
	get ui() {
		return config.ui;
	}
};
