/**
 * Contacts Model
 * Transforms kind 3 contact list events into enriched contact objects with profile data
 */

import { map, switchMap, combineLatest, of } from 'rxjs';
import { ProfileModel } from 'applesauce-core/models';

/**
 * @typedef {Object} EnrichedContact
 * @property {string} pubkey - Contact's public key
 * @property {string|null} name - Profile name
 * @property {string|null} display_name - Display name
 * @property {string|null} picture - Profile picture URL
 * @property {string|null} nip05 - NIP-05 identifier
 * @property {string|null} about - Profile about/bio
 */

/**
 * Model for user's contact list with enriched profile data
 * @param {string} userPubkey - User's public key
 * @returns {(eventStore: any) => import('rxjs').Observable<EnrichedContact[]>} Model function that takes eventStore
 */
export function ContactsModel(userPubkey) {
  return (/** @type {any} */ eventStore) => {
    // Get kind 3 event for user
    const contactListEvent$ = eventStore.timeline({
      kinds: [3],
      authors: [userPubkey],
      limit: 1
    });

    return contactListEvent$.pipe(
      map((events) => {
        // Extract all 'p' tags (followed pubkeys) from the most recent event
        if (events.length === 0) return [];

        const latestEvent = events[events.length - 1];
        const followedPubkeys = latestEvent.tags
          .filter((/** @type {string[]} */ t) => t[0] === 'p')
          .map((/** @type {string[]} */ t) => t[1]);

        return followedPubkeys;
      }),
      switchMap((pubkeys) => {
        if (pubkeys.length === 0) {
          return of(/** @type {EnrichedContact[]} */ ([]));
        }

        // Create profile model subscriptions for each contact
        const profileObservables = pubkeys.map((pubkey) => {
          return eventStore.model(ProfileModel, pubkey).pipe(
            map(
              (profile) =>
                /** @type {EnrichedContact} */ ({
                  pubkey,
                  name: profile?.name || null,
                  display_name: profile?.display_name || null,
                  picture: profile?.picture || null,
                  nip05: profile?.nip05 || null,
                  about: profile?.about || null
                })
            )
          );
        });

        // Combine all profile observables
        return combineLatest(profileObservables);
      })
    );
  };
}
