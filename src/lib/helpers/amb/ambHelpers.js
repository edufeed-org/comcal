/**
 * AMB Resource Helper Functions
 * 
 * Application-specific helpers for working with AMB (kind 30142) events in the UI.
 * These functions extract and format data from AMB events for display.
 */

import { getTagValue, getTagValues, getNestedTagValues } from './ambTransform.js';

/**
 * Extracts the resource name from an AMB event
 * @param {any} event - AMB event (kind 30142)
 * @returns {string} Resource name or "Untitled Resource"
 */
export function getAMBName(event) {
	return getTagValue(event.tags, 'name') || 'Untitled Resource';
}

/**
 * Extracts the resource description from an AMB event
 * @param {any} event - AMB event (kind 30142)
 * @returns {string} Resource description or empty string
 */
export function getAMBDescription(event) {
	return getTagValue(event.tags, 'description') || '';
}

/**
 * Extracts the resource image URL from an AMB event
 * @param {any} event - AMB event (kind 30142)
 * @returns {string|null} Image URL or null
 */
export function getAMBImage(event) {
	return getTagValue(event.tags, 'image');
}

/**
 * Extracts resource types from an AMB event
 * @param {any} event - AMB event (kind 30142)
 * @returns {string[]} Array of resource types
 */
export function getAMBTypes(event) {
	return getTagValues(event.tags, 'type');
}

/**
 * Extracts learning resource types with labels from an AMB event
 * @param {any} event - AMB event (kind 30142)
 * @returns {Array<{id: string, label: string}>} Array of learning resource types
 */
export function getAMBLearningResourceTypes(event) {
	const ids = getNestedTagValues(event.tags, 'learningResourceType:id');
	const labels = getNestedTagValues(event.tags, 'learningResourceType:prefLabel');
	
	return ids.map((id, index) => ({
		id,
		label: labels[index] || id
	}));
}

/**
 * Extracts subjects/topics from an AMB event
 * @param {any} event - AMB event (kind 30142)
 * @returns {Array<{id: string, label: string}>} Array of subjects
 */
export function getAMBSubjects(event) {
	const ids = getNestedTagValues(event.tags, 'about:id');
	const labels = getNestedTagValues(event.tags, 'about:prefLabel');
	
	return ids.map((id, index) => ({
		id,
		label: labels[index] || id
	}));
}

/**
 * Extracts educational levels from an AMB event
 * @param {any} event - AMB event (kind 30142)
 * @returns {Array<{id: string, label: string}>} Array of educational levels
 */
export function getAMBEducationalLevels(event) {
	const ids = getNestedTagValues(event.tags, 'educationalLevel:id');
	const labels = getNestedTagValues(event.tags, 'educationalLevel:prefLabel');
	
	return ids.map((id, index) => ({
		id,
		label: labels[index] || id
	}));
}

/**
 * Extracts license information from an AMB event
 * @param {any} event - AMB event (kind 30142)
 * @returns {{id: string, label: string}|null} License info or null
 */
export function getAMBLicense(event) {
	const licenseId = getTagValue(event.tags, 'license:id');
	if (!licenseId) return null;
	
	// Extract license name from URL (e.g., CC BY 4.0 from URL)
	const match = licenseId.match(/licenses\/([^/]+)\/([^/]+)/);
	const label = match ? `${match[1].toUpperCase()} ${match[2]}` : licenseId;
	
	return { id: licenseId, label };
}

/**
 * Checks if the resource is free to access
 * @param {any} event - AMB event (kind 30142)
 * @returns {boolean} True if resource is free
 */
export function isAMBFree(event) {
	const value = getTagValue(event.tags, 'isAccessibleForFree');
	return value === 'true';
}

/**
 * Extracts keywords from an AMB event (from 't' tags)
 * @param {any} event - AMB event (kind 30142)
 * @returns {string[]} Array of keywords
 */
export function getAMBKeywords(event) {
	return getTagValues(event.tags, 't');
}

/**
 * Extracts in-language codes from an AMB event
 * @param {any} event - AMB event (kind 30142)
 * @returns {string[]} Array of language codes (e.g., ['de', 'en'])
 */
export function getAMBLanguages(event) {
	return getTagValues(event.tags, 'inLanguage');
}

/**
 * Gets the published date for an AMB resource
 * Falls back to dateCreated or created_at
 * @param {any} event - AMB event (kind 30142)
 * @returns {number} Unix timestamp in seconds
 */
export function getAMBPublishedDate(event) {
	// Try datePublished first
	const datePublished = getTagValue(event.tags, 'datePublished');
	if (datePublished) {
		return new Date(datePublished).getTime() / 1000;
	}
	
	// Fallback to dateCreated
	const dateCreated = getTagValue(event.tags, 'dateCreated');
	if (dateCreated) {
		return new Date(dateCreated).getTime() / 1000;
	}
	
	// Final fallback to event created_at
	return event.created_at;
}

/**
 * Extracts creator names from an AMB event
 * @param {any} event - AMB event (kind 30142)
 * @returns {string[]} Array of creator names
 */
export function getAMBCreatorNames(event) {
	return getNestedTagValues(event.tags, 'creator:name');
}

/**
 * Extracts main entity of page URLs (links to the actual resource)
 * @param {any} event - AMB event (kind 30142)
 * @returns {string[]} Array of URLs where the resource can be accessed
 */
export function getAMBResourceURLs(event) {
	return getNestedTagValues(event.tags, 'mainEntityOfPage:id');
}

/**
 * Gets the primary resource URL (first mainEntityOfPage)
 * @param {any} event - AMB event (kind 30142)
 * @returns {string|null} Primary URL or null
 */
export function getAMBPrimaryURL(event) {
	const urls = getAMBResourceURLs(event);
	return urls.length > 0 ? urls[0] : null;
}

/**
 * Extracts the resource identifier (d-tag value)
 * @param {any} event - AMB event (kind 30142)
 * @returns {string|null} Resource identifier
 */
export function getAMBIdentifier(event) {
	return getTagValue(event.tags, 'd');
}

/**
 * Formats AMB resource for display
 * Combines all relevant metadata into a structured object
 * @param {any} event - AMB event (kind 30142)
 * @returns {Object} Formatted resource object
 */
export function formatAMBResource(event) {
	return {
		id: event.id,
		identifier: getAMBIdentifier(event),
		pubkey: event.pubkey,
		created_at: event.created_at,
		kind: event.kind,
		name: getAMBName(event),
		description: getAMBDescription(event),
		image: getAMBImage(event),
		types: getAMBTypes(event),
		learningResourceTypes: getAMBLearningResourceTypes(event),
		subjects: getAMBSubjects(event),
		educationalLevels: getAMBEducationalLevels(event),
		keywords: getAMBKeywords(event),
		languages: getAMBLanguages(event),
		license: getAMBLicense(event),
		isFree: isAMBFree(event),
		publishedDate: getAMBPublishedDate(event),
		creatorNames: getAMBCreatorNames(event),
		resourceURLs: getAMBResourceURLs(event),
		primaryURL: getAMBPrimaryURL(event),
		tags: event.tags // Keep original tags for reference
	};
}
