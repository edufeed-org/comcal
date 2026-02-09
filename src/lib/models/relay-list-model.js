import { map } from 'rxjs/operators';

/**
 * Relay List Model - transforms kind 10002 events into relay configurations (NIP-65)
 * @param {string} pubkey - User's pubkey
 * @returns {Function} Model function that takes eventStore
 */
export function RelayListModel(pubkey) {
  return (eventStore) =>
    eventStore.replaceable(10002, pubkey).pipe(
      map((event) => {
        if (!event) return null;

        /** @type {string[]} */
        const writeRelays = [];
        /** @type {string[]} */
        const readRelays = [];

        event.tags
          .filter((t) => t[0] === 'r')
          .forEach((tag) => {
            const relay = tag[1];
            const marker = tag[2];

            // No marker means both read and write
            if (!marker || marker === 'write') {
              writeRelays.push(relay);
            }
            if (!marker || marker === 'read') {
              readRelays.push(relay);
            }
          });

        return {
          pubkey,
          writeRelays,
          readRelays,
          rawEvent: event
        };
      })
    );
}
