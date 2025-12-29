/**
 * Application Configuration
 * Centralized configuration for various app settings
 */

// Detect development mode (true when running `npm run dev`)
const isDev = import.meta.env.DEV;

// Relay configuration
const productionRelays = ['wss://relay-rpi.edufeed.org'];
const devRelays = ['ws://localhost:10547'];

// AMB (Educational Content) relay with NIP-50 full-text search support
const ambRelays = ['ws://localhost:3334'];

export const appConfig = {
	logo: 'https://blossom.edufeed.org/f22e1410f09a9130757704b6dcd4c34774d2926b9cfd6cf2e4c4675c64d4333b.webp',
	name: 'ComCal',
	gitRepo: 'https://github.com/edufeed-org/comcal',
	calendar: {
		// Week start day: 0 = Sunday, 1 = Monday, 2 = Tuesday, etc.
		weekStartDay: 1, // Default to Monday

		// Default relays for calendar filtering
		// In development: uses local relay for testing
		// In production: uses production relay
		defaultRelays: isDev ? productionRelays : productionRelays,

		// Fallback relays for event discovery when event not found
		// on default relays or when naddr contains no relay hints
		fallbackRelays: [
			'wss://relay.damus.io',
			'wss://nos.lol',
			'wss://nostr.wine',
		],

		// Date and time formatting (European format)
		locale: 'de-DE', // German locale for European date/time formatting
		timeFormat: '24h', // '12h' or '24h'

		// Future configuration options can be added here:
		// defaultView: 'month', // 'month', 'week', or 'day'
		// showWeekNumbers: false,
		// etc.
	},

	signup: {
		// Suggested users to follow during signup (npubs only - profile data will be fetched from relays)
		suggestedUsers: [
			'npub1f7jar3qnu269uyx5p0e4v24hqxjnxysxudvujza2ur5ehltvdeqsly2fx9', // joerg
			'npub1r30l8j4vmppvq8w23umcyvd3vct4zmfpfkn4c7h2h057rmlfcrmq9xt9ma', // me
			'npub1tgftg8kptdrxxg0g3sm3hckuglv3j0uu3way4vylc5qyt0f44m0s3gun6e'
		]
	},

	blossom: {
		// Blossom server for media uploads
		serverUrl: 'https://blossom.edufeed.org',
		maxFileSize: 5 * 1024 * 1024, // 5MB limit
	},

	geocoding: {
		// OpenCage API key for geocoding addresses
		// Free tier: 2,500 requests/day
		// Get your key at: https://opencagedata.com/api
		apiKey: '324cfa67aec44c27b0ec767881636065',

		// Cache geocoding results for 30 days
		cacheDurationDays: 30,

		// Address validation settings
		validation: {
			// Minimum length for a geocodable address
			minAddressLength: 10,

			// Minimum confidence score from OpenCage (0-10)
			// Higher values = more strict validation
			// Lowered to 5 to accept city-level geocoding
			minConfidenceScore: 5,

			// Require address components (street types, numbers, etc.)
			// Set to false to allow city names and organizations
			requireAddressComponents: false,

			// Component types accepted from OpenCage results
			// Expanded to include cities, towns, venues, and organizations
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
		registrationNumber: '', // Optional: e.g., HRB 12345
		vatId: '', // Optional: e.g., DE123456789
		responsibleForContent: '' // Optional: if different from representative
	},

	educational: {
		// AMB relay with NIP-50 full-text search and Typesense backend
		ambRelays: ambRelays,
		
		// Debounce delay for search input (ms)
		searchDebounceMs: 300,
		
		// SKOS vocabulary keys used for filtering
		vocabularies: {
			learningResourceType: 'hcrt',
			about: 'hochschulfaechersystematik', 
			audience: 'intendedEndUserRole'
		}
	},

	// Other app-wide configurations can be added here:
	// ui: {
	//   theme: 'auto',
	//   animations: true,
	// },
	// api: {
	//   timeout: 30000,
	// },
};
