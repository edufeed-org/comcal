/**
 * NIP-50 Search Query Builder for Educational Content
 * 
 * Builds search query strings compatible with the AMB Typesense relay.
 * Supports free-text search and field-specific filtering using dot notation.
 */

/**
 * @typedef {Object} SearchFilters
 * @property {string} [searchText] - Free-text search query
 * @property {Array<{id: string, prefLabel: Object<string, string>}>} [learningResourceType] - Selected resource types
 * @property {Array<{id: string, prefLabel: Object<string, string>}>} [about] - Selected subjects/topics
 * @property {Array<{id: string, prefLabel: Object<string, string>}>} [audience] - Selected target audiences
 */

/**
 * Escape special characters in search values for NIP-50 queries
 * @param {string} value - The value to escape
 * @returns {string} Escaped value
 */
function escapeSearchValue(value) {
	// Only escape double quotes - colons in URLs should NOT be escaped
	// The field:value separator uses the first colon, remaining colons are part of the value
	return value.replace(/"/g, '\\"');
}

/**
 * Build a NIP-50 search query string from filters
 * 
 * @param {SearchFilters} filters - The search filters
 * @returns {string} The NIP-50 compatible search query string
 * 
 * @example
 * // Free-text only
 * buildSearchQuery({ searchText: 'mathematik' })
 * // Returns: "mathematik"
 * 
 * @example
 * // With filters
 * buildSearchQuery({
 *   searchText: 'bildung',
 *   learningResourceType: [{ id: 'https://w3id.org/kim/hcrt/video' }],
 *   about: [{ id: 'http://w3id.org/kim/hochschulfaechersystematik/n079' }]
 * })
 * // Returns: "bildung learningResourceType.id:https://w3id.org/kim/hcrt/video about.id:http://w3id.org/kim/hochschulfaechersystematik/n079"
 */
export function buildSearchQuery(filters) {
	const parts = [];
	
	// Add free-text search
	if (filters.searchText?.trim()) {
		parts.push(filters.searchText.trim());
	}
	
	// Add learningResourceType filters
	if (filters.learningResourceType && filters.learningResourceType.length > 0) {
		filters.learningResourceType.forEach((concept) => {
			if (concept.id) {
				parts.push(`learningResourceType.id:${escapeSearchValue(concept.id)}`);
			}
		});
	}
	
	// Add about (subject) filters
	if (filters.about && filters.about.length > 0) {
		filters.about.forEach((concept) => {
			if (concept.id) {
				parts.push(`about.id:${escapeSearchValue(concept.id)}`);
			}
		});
	}
	
	// Add audience filters
	if (filters.audience && filters.audience.length > 0) {
		filters.audience.forEach((concept) => {
			if (concept.id) {
				parts.push(`audience.id:${escapeSearchValue(concept.id)}`);
			}
		});
	}
	
	return parts.join(' ');
}

/**
 * Check if any search filters are active
 * @param {SearchFilters} filters - The search filters
 * @returns {boolean} True if any filter is active
 */
export function hasActiveFilters(filters) {
	return !!(
		filters.searchText?.trim() ||
		(filters.learningResourceType && filters.learningResourceType.length > 0) ||
		(filters.about && filters.about.length > 0) ||
		(filters.audience && filters.audience.length > 0)
	);
}

/**
 * Create an empty filters object
 * @returns {SearchFilters} Empty filters
 */
export function createEmptyFilters() {
	return {
		searchText: '',
		learningResourceType: [],
		about: [],
		audience: []
	};
}
