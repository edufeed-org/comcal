/**
 * Runtime Configuration Store
 * This store holds the application configuration loaded from the API endpoint.
 * It provides a reactive way to access config throughout the application.
 * 
 * Configuration source of truth: .env file → /api/config endpoint → this store
 */

/**
 * Default configuration structure
 * These are minimal defaults used before the API config loads
 */
const defaultConfig = {
	name: 'ComCal',
	logo: 'https://blossom.edufeed.org/f22e1410f09a9130757704b6dcd4c34774d2926b9cfd6cf2e4c4675c64d4333b.webp',
	gitRepo: 'https://github.com/edufeed-org/comcal',
	calendar: {
		weekStartDay: 1,
		locale: 'de-DE',
		timeFormat: '24h',
		defaultRelays: [],
		fallbackRelays: [
			'wss://relay.damus.io',
			'wss://nos.lol',
			'wss://nostr.wine',
		],
	},
	signup: {
		suggestedUsers: [
			'npub1f7jar3qnu269uyx5p0e4v24hqxjnxysxudvujza2ur5ehltvdeqsly2fx9',
			'npub1r30l8j4vmppvq8w23umcyvd3vct4zmfpfkn4c7h2h057rmlfcrmq9xt9ma',
			'npub1tgftg8kptdrxxg0g3sm3hckuglv3j0uu3way4vylc5qyt0f44m0s3gun6e'
		]
	},
	blossom: {
		serverUrl: 'https://blossom.edufeed.org',
		uploadEndpoint: 'https://blossom.edufeed.org/upload',
		maxFileSize: 5 * 1024 * 1024, // 5MB
	},
	geocoding: {
		cacheDurationDays: 30,
		validation: {
			minAddressLength: 10,
			minConfidenceScore: 5,
			requireAddressComponents: false,
			acceptedComponentTypes: [
				'road', 'house', 'building', 'retail',
				'commercial', 'industrial', 'residential',
				'address', 'postcode', 'street', 'neighbourhood',
				'city', 'town', 'village', 'municipality',
				'county', 'state', 'country',
				'amenity', 'venue', 'place', 'locality', 'university'
			]
		}
	},
	imprint: {
		enabled: true,
		organization: 'ComCal GbR',
		address: {
			street: '',
			postalCode: '',
			city: '',
			country: ''
		},
		contact: {
			email: 'mail@comcal.net',
			phone: ''
		},
		representative: '',
		registrationNumber: '',
		vatId: '',
		responsibleForContent: ''
	},
	educational: {
		ambRelays: ['ws://localhost:3334'],
		searchDebounceMs: 300,
		vocabularies: {
			learningResourceType: 'hcrt',
			about: 'hochschulfaechersystematik',
			audience: 'intendedEndUserRole'
		}
	},
	ui: {
		defaultLightTheme: 'light',
		defaultDarkTheme: 'dark'
	}
};

/**
 * Runtime configuration state
 * Initialized with defaults, then updated with runtime values from API
 */
let config = $state(defaultConfig);

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
		...defaultConfig,
		name: runtimeConfig.appName || defaultConfig.name,
		logo: runtimeConfig.appLogo || defaultConfig.logo,
		gitRepo: runtimeConfig.gitRepo || defaultConfig.gitRepo,
		calendar: {
			...defaultConfig.calendar,
			...runtimeConfig.calendar,
			// Keep the defaultRelays and fallbackRelays from runtime
			defaultRelays: runtimeConfig.relays || defaultConfig.calendar.defaultRelays,
			fallbackRelays: runtimeConfig.fallbackRelays || defaultConfig.calendar.fallbackRelays,
		},
		signup: {
			...defaultConfig.signup,
			...runtimeConfig.signup,
		},
		blossom: {
			...defaultConfig.blossom,
			...runtimeConfig.blossom,
		},
		geocoding: {
			...defaultConfig.geocoding,
			...runtimeConfig.geocoding,
			validation: {
				...defaultConfig.geocoding.validation,
				...runtimeConfig.geocoding?.validation,
			}
		},
		imprint: {
			...defaultConfig.imprint,
			...runtimeConfig.imprint,
			address: {
				...defaultConfig.imprint.address,
				...runtimeConfig.imprint?.address,
			},
			contact: {
				...defaultConfig.imprint.contact,
				...runtimeConfig.imprint?.contact,
			}
		},
		educational: {
			...defaultConfig.educational,
			...runtimeConfig.educational,
			// Use ambRelays from runtime config
			ambRelays: runtimeConfig.ambRelays || defaultConfig.educational.ambRelays,
			vocabularies: {
				...defaultConfig.educational.vocabularies,
				...runtimeConfig.educational?.vocabularies,
			}
		},
		ui: {
			...defaultConfig.ui,
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
