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
	// NIP-65 relay list discovery relays
	relayListLookupRelays: [],
	// Profile indexer relays for bulk profile lookups
	indexerRelays: [],
	// Fallback relays for users without kind 10002
	fallbackRelays: [],
	// App-specific relays (content goes here IN ADDITION to user's outbox)
	appRelays: {
		calendar: [],     // kinds 31922-31925
		communikey: [],   // kinds 10222, 30222, 30382
		educational: [],  // kind 30142
		longform: []      // kind 30023
	},
	// Gated mode: when enabled, fetch only from app relays (exclude fallback relays)
	gatedMode: {
		default: false,   // Default state for new users
		force: false      // When true, users cannot disable gated mode
	},
	// Default Blossom servers for new users
	defaultBlossomServers: [],
	calendar: {
		weekStartDay: 1,
		locale: 'de-DE',
		timeFormat: '24h',
	},
	signup: {
		suggestedUsers: [
			'npub1f7jar3qnu269uyx5p0e4v24hqxjnxysxudvujza2ur5ehltvdeqsly2fx9',
			'npub1r30l8j4vmppvq8w23umcyvd3vct4zmfpfkn4c7h2h057rmlfcrmq9xt9ma',
			'npub1tgftg8kptdrxxg0g3sm3hckuglv3j0uu3way4vylc5qyt0f44m0s3gun6e'
		]
	},
	blossom: {
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
		responsibleForContent: '',
		funding: {
			image: '/BMBFSFJ.png',
			text: 'Förderkennzeichen: 01PZ24007'
		}
	},
	footer: {
		fundingText: 'gefördert vom BMBFSFJ (FKZ01PZ24007)'
	},
	educational: {
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
	},
	// Favicon configuration (allows whitelabel override)
	favicon: {
		ico: '/favicon.ico',
		svg: '/favicon.svg',
		png32: '/favicon-32x32.png',
		png16: '/favicon-16x16.png'
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
		relayListLookupRelays: runtimeConfig.relayListLookupRelays || defaultConfig.relayListLookupRelays,
		indexerRelays: runtimeConfig.indexerRelays || defaultConfig.indexerRelays,
		fallbackRelays: runtimeConfig.fallbackRelays || defaultConfig.fallbackRelays,
		appRelays: {
			calendar: runtimeConfig.calendarRelays || defaultConfig.appRelays.calendar,
			communikey: runtimeConfig.communikeyRelays || defaultConfig.appRelays.communikey,
			educational: runtimeConfig.ambRelays || defaultConfig.appRelays.educational,
			longform: runtimeConfig.longformContentRelays || defaultConfig.appRelays.longform,
		},
		gatedMode: {
			default: runtimeConfig.gatedMode?.default ?? defaultConfig.gatedMode.default,
			force: runtimeConfig.gatedMode?.force ?? defaultConfig.gatedMode.force,
		},
		defaultBlossomServers: runtimeConfig.defaultBlossomServers || defaultConfig.defaultBlossomServers,
		calendar: {
			...defaultConfig.calendar,
			...runtimeConfig.calendar,
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
		},
		funding: {
			...defaultConfig.imprint.funding,
			...runtimeConfig.imprint?.funding,
		}
	},
	footer: {
		...defaultConfig.footer,
		...runtimeConfig.footer,
	},
	educational: {
			...defaultConfig.educational,
			...runtimeConfig.educational,
			vocabularies: {
				...defaultConfig.educational.vocabularies,
				...runtimeConfig.educational?.vocabularies,
			}
		},
		ui: {
			...defaultConfig.ui,
			...runtimeConfig.ui
		},
		favicon: {
			...defaultConfig.favicon,
			...runtimeConfig.favicon
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
	get relayListLookupRelays() {
		return config.relayListLookupRelays;
	},
	get indexerRelays() {
		return config.indexerRelays;
	},
	get fallbackRelays() {
		return config.fallbackRelays;
	},
	get appRelays() {
		return config.appRelays;
	},
	get defaultBlossomServers() {
		return config.defaultBlossomServers;
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
	get footer() {
		return config.footer;
	},
	get educational() {
		return config.educational;
	},
	get ui() {
		return config.ui;
	},
	get gatedMode() {
		return config.gatedMode;
	},
	get favicon() {
		return config.favicon;
	}
};
