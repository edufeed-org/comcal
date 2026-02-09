/**
 * Root Layout Data Loader
 * Loads runtime configuration from the API endpoint on app initialization
 */

/**
 * Load function runs on both server and client
 * @param {Object} params
 * @param {Function} params.fetch - SvelteKit fetch function
 */
export async function load({ fetch }) {
  try {
    const response = await fetch('/api/config');

    if (!response.ok) {
      console.error('Failed to load config:', response.status);
      return { config: null };
    }

    const config = await response.json();
    return { config };
  } catch (error) {
    console.error('Error loading config:', error);
    return { config: null };
  }
}
