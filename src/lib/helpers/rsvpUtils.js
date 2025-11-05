/**
 * RSVP Utilities
 * Shared helper functions for processing and transforming RSVP data
 */
import { getTagValue } from 'applesauce-core/helpers';

/**
 * Transform raw RSVP events into grouped data structure
 * Handles deduplication (most recent RSVP per user), grouping by status, and user RSVP detection
 * 
 * @param {any[]} rsvps - Array of raw RSVP events from eventStore
 * @param {string | null} [userPubkey=null] - Current user's pubkey to detect their RSVP
 * @returns {{
 *   accepted: any[],
 *   tentative: any[],
 *   declined: any[],
 *   totalCount: number,
 *   userRsvp: { status: string, event: any } | null
 * }}
 */
export function transformRsvps(rsvps, userPubkey = null) {
	const accepted = [];
	const tentative = [];
	const declined = [];
	let userRsvp = null;

	// Deduplicate RSVPs - keep only the most recent per user
	const rsvpMap = new Map();
	for (const rsvp of rsvps) {
		const existing = rsvpMap.get(rsvp.pubkey);
		if (!existing || rsvp.created_at > existing.created_at) {
			rsvpMap.set(rsvp.pubkey, rsvp);
		}
	}

	// Group deduplicated RSVPs by status
	for (const rsvp of rsvpMap.values()) {
		const status = getTagValue(rsvp, 'status') || 'accepted';

		// Check if this is the user's RSVP
		if (userPubkey && rsvp.pubkey === userPubkey) {
			userRsvp = { status, event: rsvp };
		}

		// Group by status
		if (status === 'accepted') {
			accepted.push(rsvp);
		} else if (status === 'tentative') {
			tentative.push(rsvp);
		} else if (status === 'declined') {
			declined.push(rsvp);
		}
	}

	return {
		accepted,
		tentative,
		declined,
		totalCount: accepted.length + tentative.length + declined.length,
		userRsvp
	};
}
