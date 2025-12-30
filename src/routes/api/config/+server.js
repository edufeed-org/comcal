/**
 * Public Configuration API Endpoint
 * This endpoint serves runtime configuration to the client.
 * Only non-sensitive configuration should be exposed here.
 */

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Parse comma-separated string into array
 * @param {string | undefined} value
 * @param {string[]} defaultValue
 * @returns {string[]}
 */
function parseArray(value, defaultValue = []) {
	if (!value) return defaultValue;
	return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Parse integer with default
 * @param {string | undefined} value
 * @param {number} defaultValue
 * @returns {number}
 */
function parseInt(value, defaultValue) {
	if (!value) return defaultValue;
	const parsed = Number.parseInt(value);
	return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse boolean with default
 * @param {string | undefined} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function parseBool(value, defaultValue) {
	if (value === undefined || value === null || value === '') return defaultValue;
	return value === 'true' || value === '1';
}

/**
 * Parse theme value
 * @param {string | undefined} value
 * @param {'light' | 'dark' | 'stil' | 'stil-dark'} defaultValue
 * @returns {'light' | 'dark' | 'stil' | 'stil-dark'}
 */
function parseTheme(value, defaultValue) {
	if (!value) return defaultValue;
	const normalized = value.toLowerCase();
	if (normalized === 'light' || normalized === 'dark' || normalized === 'stil' || normalized === 'stil-dark') {
		return normalized;
	}
	return defaultValue;
}

/**
 * GET /api/config
 * Returns public configuration that can be safely exposed to the browser
 */
export function GET() {
	const config = {
		// App branding
		appName: env.APP_NAME || 'ComCal',
		appLogo: env.APP_LOGO || 'https://blossom.edufeed.org/f22e1410f09a9130757704b6dcd4c34774d2926b9cfd6cf2e4c4675c64d4333b.webp',
		gitRepo: env.APP_GIT_REPO || 'https://github.com/edufeed-org/comcal',

		// Relays
		relays: parseArray(env.RELAYS),
		fallbackRelays: parseArray(env.FALLBACK_RELAYS, [
			'wss://relay.damus.io',
			'wss://nos.lol',
			'wss://nostr.wine',
		]),
		ambRelays: parseArray(env.AMB_RELAYS, ['ws://localhost:3334']),

		// Calendar
		calendar: {
			weekStartDay: parseInt(env.CALENDAR_WEEK_START_DAY, 1),
			locale: env.CALENDAR_LOCALE || 'de-DE',
			timeFormat: env.CALENDAR_TIME_FORMAT || '24h',
		},

		// Signup
		signup: {
			suggestedUsers: parseArray(env.SIGNUP_SUGGESTED_USERS, [
				'npub1f7jar3qnu269uyx5p0e4v24hqxjnxysxudvujza2ur5ehltvdeqsly2fx9',
				'npub1r30l8j4vmppvq8w23umcyvd3vct4zmfpfkn4c7h2h057rmlfcrmq9xt9ma',
				'npub1tgftg8kptdrxxg0g3sm3hckuglv3j0uu3way4vylc5qyt0f44m0s3gun6e'
			])
		},

		// Blossom (media uploads)
		blossom: {
			uploadEndpoint: env.BLOSSOM_UPLOAD_ENDPOINT || 'https://blossom.edufeed.org/upload',
			maxFileSize: parseInt(env.BLOSSOM_MAX_FILE_SIZE, 5 * 1024 * 1024), // 5MB default
		},

		// Geocoding (public settings only - API key stays on server)
		geocoding: {
			// Note: API key is NOT exposed here - it stays server-side
			cacheDurationDays: parseInt(env.GEOCODING_CACHE_DURATION_DAYS, 30),
			validation: {
				minAddressLength: parseInt(env.GEOCODING_MIN_ADDRESS_LENGTH, 10),
				minConfidenceScore: parseInt(env.GEOCODING_MIN_CONFIDENCE_SCORE, 5),
				requireAddressComponents: parseBool(env.GEOCODING_REQUIRE_ADDRESS_COMPONENTS, false),
				acceptedComponentTypes: parseArray(env.GEOCODING_ACCEPTED_COMPONENT_TYPES, [
					'road', 'house', 'building', 'retail',
					'commercial', 'industrial', 'residential',
					'address', 'postcode', 'street', 'neighbourhood',
					'city', 'town', 'village', 'municipality',
					'county', 'state', 'country',
					'amenity', 'venue', 'place', 'locality', 'university'
				])
			}
		},

	// Imprint
	imprint: {
		enabled: parseBool(env.IMPRINT_ENABLED, true),
		organization: env.IMPRINT_ORGANIZATION || 'ComCal GbR',
		address: {
			street: env.IMPRINT_ADDRESS_STREET || '',
			postalCode: env.IMPRINT_ADDRESS_POSTAL_CODE || '',
			city: env.IMPRINT_ADDRESS_CITY || '',
			country: env.IMPRINT_ADDRESS_COUNTRY || ''
		},
		contact: {
			email: env.IMPRINT_CONTACT_EMAIL || 'mail@comcal.net',
			phone: env.IMPRINT_CONTACT_PHONE || ''
		},
		representative: env.IMPRINT_REPRESENTATIVE || '',
		registrationNumber: env.IMPRINT_REGISTRATION_NUMBER || '',
		vatId: env.IMPRINT_VAT_ID || '',
		responsibleForContent: env.IMPRINT_RESPONSIBLE_FOR_CONTENT || '',
		funding: {
			image: env.IMPRINT_FUNDING_IMAGE || '/BMBFSFJ.png',
			text: env.IMPRINT_FUNDING_TEXT || 'Förderkennzeichen: 01PZ24007'
		}
	},

	// Footer
	footer: {
		fundingText: env.FOOTER_FUNDING_TEXT || 'gefördert vom BMBFSFJ (FKZ01PZ24007)'
	},

		// Educational content
		educational: {
			searchDebounceMs: parseInt(env.EDUCATIONAL_SEARCH_DEBOUNCE_MS, 300),
			vocabularies: {
				learningResourceType: env.EDUCATIONAL_VOCAB_LEARNING_RESOURCE_TYPE || 'hcrt',
				about: env.EDUCATIONAL_VOCAB_ABOUT || 'hochschulfaechersystematik',
				audience: env.EDUCATIONAL_VOCAB_AUDIENCE || 'intendedEndUserRole'
			}
		},

		// UI settings
		ui: {
			defaultLightTheme: parseTheme(env.THEME_DEFAULT_LIGHT, 'light'),
			defaultDarkTheme: parseTheme(env.THEME_DEFAULT_DARK, 'dark')
		}
	};

	return json(config);
}
