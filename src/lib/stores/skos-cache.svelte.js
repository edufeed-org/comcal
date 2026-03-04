/**
 * Reactive SKOS vocabulary cache
 * Provides in-memory reactive cache so components (cards, views) can resolve
 * SKOS concept URIs to human-readable labels without each component fetching independently.
 *
 * The SKOSDropdown populates this cache when vocabularies load.
 * Components read from it reactively via getCachedConcepts().
 */

import { fetchVocabulary } from '$lib/helpers/educational/skosLoader.js';

/**
 * @typedef {import('$lib/helpers/educational/skosLoader.js').SKOSConcept} SKOSConcept
 */

/** @type {Record<string, SKOSConcept[]>} */
let cache = $state({});

/** @type {Set<string>} */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- internal dedup tracker, not reactive
const loading = new Set();

/**
 * Get cached concepts for a vocabulary key (reactive read)
 * @param {string} vocabKey
 * @returns {SKOSConcept[] | null}
 */
export function getCachedConcepts(vocabKey) {
  return cache[vocabKey] ?? null;
}

/**
 * Populate the reactive cache for a vocabulary key
 * Called by SKOSDropdown after fetchVocabulary() completes,
 * or by ensureVocabularyLoaded() for components that need labels without a dropdown.
 * @param {string} vocabKey
 * @param {SKOSConcept[]} concepts
 */
export function setCachedConcepts(vocabKey, concepts) {
  cache[vocabKey] = concepts;
}

/**
 * Ensure a vocabulary is loaded into the reactive cache.
 * If not cached and not currently loading, triggers a fetch.
 * @param {string} vocabKey
 */
export async function ensureVocabularyLoaded(vocabKey) {
  if (cache[vocabKey] || loading.has(vocabKey)) return;

  loading.add(vocabKey);
  try {
    const concepts = await fetchVocabulary(/** @type {any} */ (vocabKey));
    cache[vocabKey] = concepts;
  } catch (e) {
    console.warn(`Failed to load SKOS vocabulary "${vocabKey}":`, e);
  } finally {
    loading.delete(vocabKey);
  }
}
