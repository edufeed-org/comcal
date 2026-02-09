import { nip19 } from 'nostr-tools';
import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  try {
    // Decode npub to get pubkey
    const decoded = nip19.decode(params.npub);

    if (decoded.type !== 'npub') {
      throw error(400, 'Invalid npub format');
    }

    const pubkey = decoded.data;

    return {
      pubkey,
      npub: params.npub
    };
  } catch (err) {
    console.error('Error decoding npub:', err);
    throw error(400, 'Invalid npub parameter');
  }
}
