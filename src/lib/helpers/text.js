/**
 * Text helper utilities
 */

/**
 * Check if a string is a URL
 * @param {string} str - The string to check
 * @returns {boolean} True if the string appears to be a URL
 */
export function isUrl(str) {
	if (!str || typeof str !== 'string') {
		return false;
	}
	
	// Check for http://, https://, or www. at the start
	return /^(https?:\/\/|www\.)/i.test(str.trim());
}

/**
 * Ensure a URL has a protocol
 * @param {string} url - The URL to normalize
 * @returns {string} URL with protocol
 */
export function normalizeUrl(url) {
	if (!url || typeof url !== 'string') {
		return '';
	}
	
	const trimmed = url.trim();
	
	// If it starts with www. but no protocol, add https://
	if (/^www\./i.test(trimmed)) {
		return `https://${trimmed}`;
	}
	
	return trimmed;
}
