/**
 * Content type configuration for community features
 * Maps event kinds to UI metadata and implementation status
 */

/**
 * @typedef {Object} ContentTypeConfig
 * @property {number} kind - Nostr event kind number
 * @property {string} name - Display name
 * @property {string} icon - SVG icon path
 * @property {boolean} supported - Whether we have a component implementation
 * @property {string|null} component - Component name/path (if supported)
 * @property {string} description - Description for tooltips
 */

/** @type {Record<number, ContentTypeConfig>} */
export const CONTENT_TYPE_CONFIG = {
	9: {
		kind: 9,
		name: 'Chat',
		icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
		supported: true,
		component: 'Chat',
		description: 'Real-time community chat'
	},
	31923: {
		kind: 31923,
		name: 'Calendar',
		icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
		supported: true,
		component: 'CalendarView',
		description: 'Community events and calendar'
	},
	1: {
		kind: 1,
		name: 'Posts',
		icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
		supported: false,
		component: null,
		description: 'Short text posts'
	},
	30023: {
		kind: 30023,
		name: 'Articles',
		icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
		supported: false,
		component: null,
		description: 'Long-form articles'
	},
	11: {
		kind: 11,
		name: 'Forum',
		icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
		supported: false,
		component: null,
		description: 'Forum discussions'
	}
};

/**
 * Get content types for a community, including always-available types
 * @param {Object} communikeyEvent - The community's kind:10222 event
 * @returns {Array<{kind: number, name: string, icon: string, supported: boolean, enabled: boolean, description: string, exclusive?: boolean, fee?: Object, roles?: string[]}>}
 */
export function getCommunityAvailableContentTypes(communikeyEvent) {
	// Always include Chat and Calendar as they're core features
	const alwaysAvailable = [9, 31923];
	const result = [];
	const processedKinds = new Set();

	// Parse community's defined content types
	const definedContentTypes = getCommunityContentTypes(communikeyEvent);

	// Process defined content types from the community
	for (const contentType of definedContentTypes) {
		for (const kind of contentType.kinds) {
			if (processedKinds.has(kind)) continue;
			processedKinds.add(kind);

			const config = CONTENT_TYPE_CONFIG[kind];
			if (config) {
				result.push({
					kind,
					name: config.name,
					icon: config.icon,
					supported: config.supported,
					enabled: config.supported,
					description: config.description,
					exclusive: contentType.exclusive,
					fee: contentType.fee,
					roles: contentType.roles
				});
			} else {
				// Unknown content type - show as disabled
				result.push({
					kind,
					name: contentType.name || `Kind ${kind}`,
					icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', // Info icon
					supported: false,
					enabled: false,
					description: `Content type (kind ${kind}) is not yet supported`,
					exclusive: contentType.exclusive,
					fee: contentType.fee,
					roles: contentType.roles
				});
			}
		}
	}

	// Add always-available types if not already present
	for (const kind of alwaysAvailable) {
		if (!processedKinds.has(kind)) {
			const config = CONTENT_TYPE_CONFIG[kind];
			result.push({
				kind,
				name: config.name,
				icon: config.icon,
				supported: config.supported,
				enabled: config.supported,
				description: config.description
			});
		}
	}

	// Sort: enabled first, then by kind number
	return result.sort((a, b) => {
		if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
		return a.kind - b.kind;
	});
}

/**
 * Parse community content type definitions from a Nostr event's tags.
 * (Copied from helpers.js for use in this module)
 * @param {any} event
 * @returns {Array<{name: string, kinds: number[], exclusive: boolean, roles: string[], fee?: {amount: string, unit: string}}>}
 */
function getCommunityContentTypes(event) {
	/** @type {Array<{name: string, kinds: number[], exclusive: boolean, roles: string[], fee?: {amount: string, unit: string}}>} */
	const contentTypes = [];
	/** @type {{name: string, kinds: number[], exclusive: boolean, roles: string[], fee?: {amount: string, unit: string}}|null} */
	let currentContentType = null;

	if (!event || !Array.isArray(event.tags)) return contentTypes;

	for (const tag of event.tags) {
		if (!Array.isArray(tag) || tag.length === 0) continue;
		const key = tag[0];

		if (key === 'content') {
			if (currentContentType) contentTypes.push(currentContentType);
			currentContentType = {
				name: tag[1],
				kinds: [],
				exclusive: false,
				roles: []
			};
		} else if (key === 'k' && currentContentType) {
			const kind = parseInt(tag[1], 10);
			if (!Number.isNaN(kind)) currentContentType.kinds.push(kind);
		} else if (key === 'fee' && currentContentType) {
			currentContentType.fee = { amount: tag[1], unit: tag[2] || 'sat' };
		} else if (key === 'exclusive' && currentContentType) {
			currentContentType.exclusive = tag[1] === 'true';
		} else if (key === 'role' && currentContentType) {
			currentContentType.roles = tag.slice(1);
		}
	}

	if (currentContentType) contentTypes.push(currentContentType);
	return contentTypes;
}
