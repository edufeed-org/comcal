/**
 * Contacts Store using Svelte 5 runes
 * Manages user's contact list (kind 3 follows) globally across the app
 */

import { eventStore, pool } from './nostr-infrastructure.svelte.js';
import { createContactListLoader } from '$lib/loaders/contact-list-loader.js';
import { ContactsModel } from '$lib/models/contacts-model.js';
import { getWriteRelays } from '$lib/services/relay-service.svelte.js';
import { profileLoader } from '$lib/loaders/profile.js';
import { runtimeConfig } from './config.svelte.js';

/**
 * @typedef {import('$lib/models/contacts-model.js').EnrichedContact} EnrichedContact
 */

/** @type {EnrichedContact[]} */
let contacts = $state([]);
let isLoading = $state(false);
let isLoaded = $state(false);
/** @type {import('rxjs').Subscription[]} */
let activeSubscriptions = [];

export const contactsStore = {
  get contacts() {
    return contacts;
  },
  get isLoading() {
    return isLoading;
  },
  get isLoaded() {
    return isLoaded;
  },

  /**
   * Load contacts for the authenticated user
   * @param {string} userPubkey - User's public key
   */
  async loadContacts(userPubkey) {
    if (!userPubkey || isLoading) return;

    isLoading = true;
    isLoaded = false;
    contacts = [];

    // Clean up any existing subscriptions
    this.clear();

    try {
      // Get user's write relays (outbox model)
      const relays = await getWriteRelays(userPubkey);

      // Step 1: Start background loader to fetch kind 3 event
      const loaderFactory = createContactListLoader(pool, relays, eventStore, userPubkey);
      const loaderSubscription = loaderFactory()().subscribe({
        error: (error) => {
          console.error('Error loading contact list:', error);
        }
      });
      activeSubscriptions.push(loaderSubscription);

      // Step 2: Subscribe to kind 3 to get pubkeys, then load their profiles
      const kind3Sub = eventStore
        .timeline({
          kinds: [3],
          authors: [userPubkey],
          limit: 1
        })
        .subscribe({
          next: (events) => {
            if (events.length > 0) {
              const latestEvent = events[events.length - 1];
              const pubkeys = latestEvent.tags
                .filter((/** @type {string[]} */ t) => t[0] === 'p')
                .map((/** @type {string[]} */ t) => t[1]);

              // Load profiles using configured indexer relays
              const indexerRelays = runtimeConfig.indexerRelays;
              if (indexerRelays.length > 0) {
                pubkeys.forEach((pubkey) => {
                  const profileSub = profileLoader({
                    kind: 0,
                    pubkey,
                    relays: indexerRelays
                  }).subscribe();
                  activeSubscriptions.push(profileSub);
                });
              }
            }
          }
        });
      activeSubscriptions.push(kind3Sub);

      // Step 3: Use model to get enriched contacts
      const modelSubscription = eventStore.model(ContactsModel, userPubkey).subscribe({
        next: (enrichedContacts) => {
          contacts = enrichedContacts;
          isLoading = false;
          isLoaded = true;
        },
        error: (error) => {
          console.error('Error loading contact profiles:', error);
          isLoading = false;
          isLoaded = true; // Mark as loaded even on error
        }
      });
      activeSubscriptions.push(modelSubscription);
    } catch (error) {
      console.error('Failed to initialize contact loading:', error);
      isLoading = false;
      isLoaded = true;
    }
  },

  /**
   * Search contacts by display name or name
   * @param {string} searchTerm - Search query
   * @param {number} [limit=10] - Maximum results to return
   * @returns {EnrichedContact[]} Filtered contacts
   */
  searchContacts(searchTerm, limit = 10) {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    const term = searchTerm.toLowerCase().trim();

    return contacts
      .filter((contact) => {
        const displayName = contact.display_name?.toLowerCase() || '';
        const name = contact.name?.toLowerCase() || '';
        return displayName.includes(term) || name.includes(term);
      })
      .slice(0, limit);
  },

  /**
   * Clear contacts and cleanup subscriptions
   */
  clear() {
    // Unsubscribe from all active subscriptions
    activeSubscriptions.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing:', error);
      }
    });
    activeSubscriptions = [];

    contacts = [];
    isLoading = false;
    isLoaded = false;
  }
};
