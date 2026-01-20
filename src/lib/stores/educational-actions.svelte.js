/**
 * Educational Actions Store
 * Actions for creating and managing educational resources (AMB) with Nostr integration
 */

import { EventFactory } from 'applesauce-factory';
import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
import { manager } from '$lib/stores/accounts.svelte';
import { runtimeConfig } from '$lib/stores/config.svelte.js';
import { flattenAMBToNostrTags } from '$lib/helpers/educational/ambTransform.js';
import { encodeEventToNaddr } from '$lib/helpers/nostrUtils.js';
import { publishEvent, buildATagWithHint, buildETagWithHint } from '$lib/services/publish-service.js';
import { getAppRelaysForCategory } from '$lib/services/app-relay-service.js';
import { getPrimaryWriteRelay } from '$lib/services/relay-service.svelte.js';

/**
 * @typedef {Object} Creator
 * @property {string} name - Creator name
 * @property {'Person'|'Organization'} type - Creator type
 * @property {string} [pubkey] - Nostr pubkey (hex)
 * @property {string} [affiliationName] - Affiliation/organization name
 * @property {string} [honorificPrefix] - Honorific prefix (Dr., Prof., etc.)
 */

/**
 * @typedef {Object} UploadedFile
 * @property {string} url - Blossom URL
 * @property {string} mimeType - MIME type
 * @property {number} size - File size in bytes
 * @property {string} name - Original filename
 * @property {string} sha256 - SHA-256 hash
 */

/**
 * @typedef {Object} EducationalFormData
 * @property {string} name - Resource title
 * @property {string} description - Resource description
 * @property {string} slug - URL-safe identifier (d-tag)
 * @property {string} learningResourceType - SKOS URI for resource type
 * @property {string} learningResourceTypeLabel - Human-readable label
 * @property {string[]} about - Array of SKOS URIs for subjects
 * @property {{id: string, label: string}[]} aboutLabels - Array of {id, label} objects
 * @property {string} inLanguage - ISO 639-1 language code
 * @property {string} license - License URI
 * @property {Creator[]} creators - Array of creators
 * @property {string[]} keywords - Array of keywords/tags
 * @property {UploadedFile[]} files - Array of uploaded files
 * @property {boolean} [isAccessibleForFree] - Whether the resource is freely accessible
 * @property {string} [educationalLevel] - Optional SKOS URI for educational level
 * @property {string} [educationalLevelLabel] - Human-readable label
 */

/**
 * @typedef {Object} EducationalActions
 * @property {(formData: EducationalFormData, communityPubkey: string, communityEvent?: Object) => Promise<{event: import('nostr-tools').NostrEvent, naddr: string}>} createResource
 * @property {(formData: EducationalFormData, existingEvent: import('nostr-tools').NostrEvent, communityEvent?: Object) => Promise<{event: import('nostr-tools').NostrEvent, naddr: string}>} updateResource
 * @property {(eventId: string) => Promise<void>} deleteResource
 * @property {(resourceEvent: import('nostr-tools').NostrEvent, communityPubkey: string, communityEvent?: Object) => Promise<void>} createTargetedPublication
 */

/** Kind number for AMB Educational Resource events */
const AMB_RESOURCE_KIND = 30142;

/** Kind number for Targeted Publication events (Communikey) */
const TARGETED_PUBLICATION_KIND = 30222;

/**
 * Converts form data to AMB-structured metadata object
 * @param {EducationalFormData} formData - Form data from the upload modal
 * @returns {Object} AMB metadata object ready for flattening
 */
function convertFormDataToAMB(formData) {
	/** @type {Record<string, any>} */
	const amb = {
		id: formData.slug,
		name: formData.name,
		description: formData.description,
		inLanguage: formData.inLanguage,
		license: { id: formData.license }
	};

	// Get the language code for prefLabel tags (per edufeed NIP spec)
	const lang = formData.inLanguage || 'en';

	// Learning resource type with language-tagged prefLabel
	// NIP spec: ["learningResourceType:prefLabel:lang", <label>]
	if (formData.learningResourceType) {
		/** @type {Record<string, any>} */
		const lrtObj = { id: formData.learningResourceType };
		lrtObj[`prefLabel:${lang}`] = formData.learningResourceTypeLabel || formData.learningResourceType;
		amb.learningResourceType = lrtObj;
	}

	// About/subjects with language-tagged prefLabel (can have multiple)
	// NIP spec: ["about:prefLabel:lang", <label>]
	if (formData.about && formData.about.length > 0) {
		amb.about = formData.about.map((uri, index) => {
			/** @type {Record<string, any>} */
			const aboutObj = { id: uri };
			aboutObj[`prefLabel:${lang}`] = formData.aboutLabels?.[index]?.label || uri;
			return aboutObj;
		});
	}

	// Educational level with language-tagged prefLabel
	// NIP spec: ["educationalLevel:prefLabel:lang", <label>]
	if (formData.educationalLevel) {
		/** @type {Record<string, any>} */
		const eduObj = { id: formData.educationalLevel };
		eduObj[`prefLabel:${lang}`] = formData.educationalLevelLabel || formData.educationalLevel;
		amb.educationalLevel = eduObj;
	}

	// Keywords
	if (formData.keywords && formData.keywords.length > 0) {
		amb.keywords = formData.keywords;
	}

	// Creators
	if (formData.creators && formData.creators.length > 0) {
		amb.creator = formData.creators.map(creator => {
			/** @type {Record<string, any>} */
			const creatorObj = {
				type: creator.type,
				name: creator.name
			};
			if (creator.honorificPrefix) {
				creatorObj.honorificPrefix = creator.honorificPrefix;
			}
			if (creator.affiliationName) {
				creatorObj.affiliation = { name: creator.affiliationName };
			}
			return creatorObj;
		});
	}

	// Files/encoding
	if (formData.files && formData.files.length > 0) {
		amb.encoding = formData.files.map(file => ({
			contentUrl: file.url,
			encodingFormat: file.mimeType,
			contentSize: file.size,
			sha256: file.sha256
		}));
	}

	// isAccessibleForFree (boolean)
	if (formData.isAccessibleForFree !== undefined) {
		amb.isAccessibleForFree = formData.isAccessibleForFree;
	}

	return amb;
}

/**
 * Create educational actions for managing AMB resources
 * @returns {EducationalActions} Educational actions object
 */
export function createEducationalActions() {
	return {
		/**
		 * Create a new educational resource (kind:30142)
		 * @param {EducationalFormData} formData - Form data from upload modal
		 * @param {string} communityPubkey - Target community public key
		 * @param {Object} [communityEvent] - Optional community definition event (kind 10222) for relay routing
		 * @returns {Promise<{event: import('nostr-tools').NostrEvent, naddr: string}>}
		 */
		async createResource(formData, communityPubkey, communityEvent = null) {
			// Get current account from manager
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to create resources.');
			}

			// Validate required fields
			if (!formData.name?.trim()) {
				throw new Error('Resource name is required');
			}
			if (!formData.description?.trim()) {
				throw new Error('Resource description is required');
			}
			if (!formData.slug?.trim()) {
				throw new Error('Resource identifier (slug) is required');
			}
			if (!formData.learningResourceType) {
				throw new Error('Learning resource type is required');
			}
			if (!formData.about || formData.about.length === 0) {
				throw new Error('At least one subject is required');
			}
			if (!formData.inLanguage) {
				throw new Error('Language is required');
			}
			if (!formData.license) {
				throw new Error('License is required');
			}

			try {
				// Convert form data to AMB structure
				const ambData = convertFormDataToAMB(formData);

				// Flatten AMB to Nostr tags
				const tags = flattenAMBToNostrTags(ambData);

				// Add h-tag for community targeting (Communikey spec)
				if (communityPubkey) {
					tags.push(['h', communityPubkey]);
				}

				// Add p-tags for creators with Nostr pubkeys and relay hints
				if (formData.creators) {
					for (const creator of formData.creators) {
						if (creator.pubkey) {
							const relayHint = await getPrimaryWriteRelay(creator.pubkey);
							tags.push(['p', creator.pubkey, relayHint, 'creator']);
						}
					}
				}

				// Create the event using EventFactory
				const eventFactory = new EventFactory();

				const eventTemplate = await eventFactory.build({
					kind: AMB_RESOURCE_KIND,
					content: formData.description,
					tags: tags
				});

				// Sign and publish using outbox + educational relays
				const resourceEvent = await currentAccount.signEvent(eventTemplate);
				await publishEvent(resourceEvent, [], { communityEvent });

				// Add to eventStore for immediate UI update
				eventStore.add(resourceEvent);

				// Generate naddr using educational relays for hint
				const naddr = encodeEventToNaddr(resourceEvent, getAppRelaysForCategory('educational'));

				console.log('📚 Educational resource created:', resourceEvent.id);
				console.log('📚 Resource naddr:', naddr);

				// Create targeted publication if community is specified
				if (communityPubkey) {
					await this.createTargetedPublication(resourceEvent, communityPubkey, communityEvent);
				}

				return { event: resourceEvent, naddr };

			} catch (error) {
				console.error('Error creating educational resource:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create educational resource: ${errorMessage}`);
			}
		},

		/**
		 * Update an existing educational resource
		 * @param {EducationalFormData} formData - Updated form data
		 * @param {import('nostr-tools').NostrEvent} existingEvent - Existing event to update
		 * @param {Object} [communityEvent] - Optional community definition event (kind 10222) for relay routing
		 * @returns {Promise<{event: import('nostr-tools').NostrEvent, naddr: string}>}
		 */
		async updateResource(formData, existingEvent, communityEvent = null) {
			// Get current account
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to update resources.');
			}

			// Extract the original d-tag
			const dTag = existingEvent.tags.find((/** @type {string[]} */ t) => t[0] === 'd')?.[1];
			if (!dTag) {
				throw new Error('Cannot update resource: missing d-tag. Resource may not be replaceable.');
			}

			// Extract the original h-tag (community targeting) if present
			const hTag = existingEvent.tags.find((/** @type {string[]} */ t) => t[0] === 'h')?.[1];

			// Verify the user owns this event
			if (existingEvent.pubkey !== currentAccount.pubkey) {
				throw new Error('Cannot update resource: you do not own this resource.');
			}

			try {
				// Use the original d-tag to ensure replacement
				formData.slug = dTag;

				// Convert form data to AMB structure
				const ambData = convertFormDataToAMB(formData);

				// Flatten AMB to Nostr tags
				const tags = flattenAMBToNostrTags(ambData);

				// Preserve h-tag if it was present
				if (hTag) {
					tags.push(['h', hTag]);
				}

				// Add p-tags for creators with Nostr pubkeys and relay hints
				if (formData.creators) {
					for (const creator of formData.creators) {
						if (creator.pubkey) {
							const relayHint = await getPrimaryWriteRelay(creator.pubkey);
							tags.push(['p', creator.pubkey, relayHint, 'creator']);
						}
					}
				}

				// Create the updated event
				const eventFactory = new EventFactory();

				const eventTemplate = await eventFactory.build({
					kind: AMB_RESOURCE_KIND,
					content: formData.description,
					tags: tags
				});

				// Sign and publish using outbox + educational relays
				const updatedEvent = await currentAccount.signEvent(eventTemplate);
				await publishEvent(updatedEvent, [], { communityEvent });

				// Add to eventStore
				eventStore.add(updatedEvent);

				// Generate naddr using educational relays for hint
				const naddr = encodeEventToNaddr(updatedEvent, getAppRelaysForCategory('educational'));

				console.log('📚 Educational resource updated:', updatedEvent.id);

				return { event: updatedEvent, naddr };

			} catch (error) {
				console.error('Error updating educational resource:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update educational resource: ${errorMessage}`);
			}
		},

		/**
		 * Delete an educational resource
		 * @param {string} eventId - Event ID to delete
		 * @returns {Promise<void>}
		 */
		async deleteResource(eventId) {
			// Get current account
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to delete resources.');
			}

			try {
				// Create a deletion event (kind 5 - NIP-09) with relay hint
				const eventFactory = new EventFactory();
				const eTagWithHint = await buildETagWithHint(eventId, currentAccount.pubkey);

				const eventTemplate = await eventFactory.build({
					kind: 5,
					content: '',
					tags: [eTagWithHint]
				});

				// Sign and publish the deletion event
				const deletionEvent = await currentAccount.signEvent(eventTemplate);
				await publishEvent(deletionEvent, []);

				console.log('📚 Educational resource deleted:', eventId);

			} catch (error) {
				console.error('Error deleting educational resource:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete educational resource: ${errorMessage}`);
			}
		},

		/**
		 * Create a targeted publication event to associate resource with community
		 * @param {import('nostr-tools').NostrEvent} resourceEvent - The educational resource event
		 * @param {string} communityPubkey - Target community public key
		 * @param {Object} [communityEvent] - Optional community definition event (kind 10222) for relay routing
		 * @returns {Promise<void>}
		 */
		async createTargetedPublication(resourceEvent, communityPubkey, communityEvent = null) {
			// Get current account
			const currentAccount = manager.active;
			if (!currentAccount) {
				throw new Error('No account selected. Please log in to create targeted publications.');
			}

			try {
				// Extract d-tag from resource event
				const dTag = resourceEvent.tags.find((/** @type {string[]} */ t) => t[0] === 'd')?.[1];
				if (!dTag) {
					throw new Error('Resource event missing d-tag');
				}

				// Build the coordinate for the 'a' tag
				const coordinate = `${resourceEvent.kind}:${resourceEvent.pubkey}:${dTag}`;

				// Build tags with relay hints for discoverability
				const aTagWithHint = await buildATagWithHint(coordinate);
				const eTagWithHint = await buildETagWithHint(resourceEvent.id, resourceEvent.pubkey);

				// Create targeting event using Communikey spec (kind 30222)
				const eventFactory = new EventFactory();

				const tags = [
					['d', `${communityPubkey}:${dTag}`], // Unique d-tag for this publication
					['h', communityPubkey], // Target community
					aTagWithHint, // Reference to the resource with relay hint
					eTagWithHint // Reference to specific event with relay hint
				];

				const eventTemplate = await eventFactory.build({
					kind: TARGETED_PUBLICATION_KIND,
					content: '',
					tags: tags
				});

				// Sign and publish (kind 30222 uses communikey relays)
				const targetingEvent = await currentAccount.signEvent(eventTemplate);
				await publishEvent(targetingEvent, [communityPubkey], { communityEvent });

				// Add to eventStore
				eventStore.add(targetingEvent);

				console.log('📚 Targeted publication created for community:', communityPubkey);

			} catch (error) {
				console.error('Error creating targeted publication:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create targeted publication: ${errorMessage}`);
			}
		}
	};
}

/**
 * Global educational actions store instance
 * @type {EducationalActions | null}
 */
let educationalActionsInstance = null;

/**
 * Get or create educational actions singleton
 * @returns {EducationalActions} Educational actions instance
 */
export function useEducationalActions() {
	if (!educationalActionsInstance) {
		educationalActionsInstance = createEducationalActions();
	}
	return educationalActionsInstance;
}
