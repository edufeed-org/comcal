/**
 * Application Configuration
 * Centralized configuration for various app settings
 */

export const appConfig = {
	calendar: {
		// Week start day: 0 = Sunday, 1 = Monday, 2 = Tuesday, etc.
		weekStartDay: 1, // Default to Monday

		// Future configuration options can be added here:
		// timeFormat: '24h', // '12h' or '24h'
		// defaultView: 'month', // 'month', 'week', or 'day'
		// showWeekNumbers: false,
		// etc.
	},

	signup: {
		// Suggested users to follow during signup
		suggestedUsers: [
			{
				npub: 'npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9',
				name: 'jack',
				about: 'Co-founder of Twitter, Bitcoin advocate',
				picture: 'https://pbs.twimg.com/profile_images/1115644092329758721/AFjOr-K8_400x400.jpg'
			},
			{
				npub: 'npub1dergggklka99wwrs92yz8wdjs952h2ux2ha2ed598ngwu9w7a6fsh9xzpc',
				name: 'Derek Ross',
				about: 'Nostr advocate and educator',
				picture: 'https://image.nostr.build/28da676a19841dcfa7dcf7124be6816842d90b13a5dcd592d5b9ac3ae7acc7d0.jpg'
			},
			{
				npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m',
				name: 'William Casarin',
				about: 'Damus developer, Nostr protocol contributor',
				picture: 'https://cdn.jb55.com/img/red-me.jpg'
			}
		]
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
