/**
 * Community Relationship Model
 * Provides reactive access to kind 30382 relationship events for a user
 * Filters to only include 'follow' relationships (joined communities)
 */
import { map } from 'rxjs/operators';
import { getTagValue } from 'applesauce-core/helpers';

/**
 * Model for community relationship events (kind 30382)
 * Filters to only include 'follow' relationships
 * @param {string} pubkey - The user's pubkey to get relationships for
 * @returns {import('applesauce-core').Model<import('nostr-tools').Event[]>} Model that emits array of relationship events
 */
export function CommunityRelationshipModel(pubkey) {
	return (eventStore) =>
		eventStore.timeline({ kinds: [30382], authors: [pubkey] }).pipe(
			map((events) =>
				events.filter((event) => getTagValue(event, 'n') === 'follow')
			)
		);
}

/**
 * Model for community members (kind 30382 events filtered by community ID)
 * Returns a Set of member pubkeys for a specific community
 * @param {string} communityPubkey - The community's pubkey to get members for
 * @returns {import('applesauce-core').Model<Set<string>>} Model that emits Set of member pubkeys
 */
export function CommunityMembersModel(communityPubkey) {
	return (eventStore) =>
		eventStore.timeline({ kinds: [30382], '#d': [communityPubkey] }).pipe(
			map((events) => new Set(events.map((event) => event.pubkey)))
		);
}
