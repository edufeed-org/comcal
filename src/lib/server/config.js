/**
 * Server-side Configuration
 * This file reads environment variables that should NEVER be exposed to the browser.
 * Use this for secrets like API keys, database credentials, etc.
 */

import { env } from '$env/dynamic/private';

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
 * @param {'light' | 'dark' | 'stil' | 'stil-dark' | 'rpi' | 'rpi-dark'} defaultValue
 * @returns {'light' | 'dark' | 'stil' | 'stil-dark' | 'rpi' | 'rpi-dark'}
 */
function parseTheme(value, defaultValue) {
  if (!value) return defaultValue;
  const normalized = value.toLowerCase();
  if (
    normalized === 'light' ||
    normalized === 'dark' ||
    normalized === 'stil' ||
    normalized === 'stil-dark' ||
    normalized === 'rpi' ||
    normalized === 'rpi-dark'
  ) {
    return normalized;
  }
  return defaultValue;
}

/**
 * Server-only configuration
 * These values should NEVER be sent to the client
 */
export const serverConfig = {
  geocoding: {
    apiKey: env.GEOCODING_API_KEY || '',
    cacheDurationDays: parseInt(env.GEOCODING_CACHE_DURATION_DAYS, 30),
    validation: {
      minAddressLength: parseInt(env.GEOCODING_MIN_ADDRESS_LENGTH, 10),
      minConfidenceScore: parseInt(env.GEOCODING_MIN_CONFIDENCE_SCORE, 5),
      requireAddressComponents: parseBool(env.GEOCODING_REQUIRE_ADDRESS_COMPONENTS, false)
    }
  }

  // Add other server-only config here as needed
  // e.g., database credentials, internal API keys, etc.
};

/**
 * Public configuration (safe to send to client)
 * These values will be exposed via the /api/config endpoint
 */
export const publicConfig = {
  ui: {
    defaultLightTheme: parseTheme(env.THEME_DEFAULT_LIGHT, 'light'),
    defaultDarkTheme: parseTheme(env.THEME_DEFAULT_DARK, 'dark')
  }
};
