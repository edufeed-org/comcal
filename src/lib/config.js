/**
 * Application Configuration
 * Centralized configuration for various app settings
 */

export const appConfig = {
	calendar: {
		// Week start day: 0 = Sunday, 1 = Monday, 2 = Tuesday, etc.
		weekStartDay: 1, // Default to Monday

		// Default relays for calendar filtering
		defaultRelays: [
			'wss://relay-rpi.edufeed.org',
			'wss://relay.damus.io',
			'wss://nos.lol',
			'wss://relay.nostr.band',
			'wss://nostr.wine',
			'wss://relay.snort.social'
		],

		// Future configuration options can be added here:
		// timeFormat: '24h', // '12h' or '24h'
		// defaultView: 'month', // 'month', 'week', or 'day'
		// showWeekNumbers: false,
		// etc.
	},

	signup: {
		// Suggested users to follow during signup (npubs only - profile data will be fetched from relays)
		suggestedUsers: [
			'npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9', // jack
			'npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc', // Derek Ross
			'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m'  // William Casarin
		]
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
			minConfidenceScore: 7,
			
			// Require address components (street types, numbers, etc.)
			requireAddressComponents: true,
			
			// Keywords that suggest a proper address (localized for Germany/English)
			streetTypeKeywords: [
				'straße', 'strasse', 'str.', 'str',
				'weg', 'platz', 'allee', 'gasse',
				'street', 'avenue', 'road', 'ave', 'rd',
				'boulevard', 'lane', 'drive', 'way'
			],
			
			// Component types accepted from OpenCage results
			acceptedComponentTypes: [
				'road', 'house', 'building', 'retail',
				'commercial', 'industrial', 'residential',
				'address', 'postcode', 'street', 'neighbourhood'
			]
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
