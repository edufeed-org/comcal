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

/**
 * Extract all URLs from a string
 * @param {string} str - The string to search for URLs
 * @returns {Array<{url: string, start: number, end: number}>} Array of URL objects with position info
 */
export function extractUrls(str) {
  if (!str || typeof str !== 'string') {
    return [];
  }

  // Match URLs anywhere in the string
  // Matches http://, https://, or www. followed by non-whitespace characters
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const urls = [];
  let match;

  while ((match = urlRegex.exec(str)) !== null) {
    urls.push({
      url: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return urls;
}

/**
 * Extract hashtags from text
 * @param {string} text - The text to parse for hashtags
 * @returns {string[]} Array of hashtags (without # symbol, lowercase)
 */
export function extractHashtags(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Match #word patterns (Unicode support for international hashtags)
  const hashtagRegex = /#(\w+)/g;
  const hashtags = [];
  let match;

  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }

  // Deduplicate and return
  return [...new Set(hashtags)];
}
