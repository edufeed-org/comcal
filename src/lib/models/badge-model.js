import { map, distinctUntilChanged } from 'rxjs/operators';

/**
 * Badge Model - transforms kind 30009 events into badge objects
 * Note: EventStore automatically handles NIP-09 deletion (kind 5) events
 *
 * @param {string} authorPubkey - Optional: filter by specific author
 * @returns {Function} Model function that takes eventStore
 */
export function BadgeModel(authorPubkey) {
	return (eventStore) => {
		const filter = {
			kinds: [30009],
			...(authorPubkey && { authors: [authorPubkey] })
		};

		// Use map instead of scan - timeline already handles deduplication and removals
		return eventStore.timeline(filter).pipe(
			map((events) => {
				return events.map((event) => {
					const dTag = event.tags.find((t) => t[0] === 'd')?.[1] || '';
					return {
						id: event.id,
						pubkey: event.pubkey,
						created_at: event.created_at,
						identifier: dTag,
						name: event.tags.find((t) => t[0] === 'name')?.[1] || '',
						description: event.tags.find((t) => t[0] === 'description')?.[1] || '',
						image: event.tags.find((t) => t[0] === 'image')?.[1] || '',
						imageDimensions: event.tags.find((t) => t[0] === 'image')?.[2] || '',
						thumb: event.tags.find((t) => t[0] === 'thumb')?.[1] || '',
						thumbDimensions: event.tags.find((t) => t[0] === 'thumb')?.[2] || '',
						address: `30009:${event.pubkey}:${dTag}`,
						rawEvent: event
					};
				});
			}),
			distinctUntilChanged(
				(prev, curr) =>
					prev?.length === curr?.length && prev?.every((b, i) => b.id === curr[i]?.id)
			)
		);
	};
}

/**
 * User Awards Model - transforms kind 8 events into award objects
 * Used to check what badges a user has been awarded
 *
 * @param {string} userPubkey - Filter awards for specific recipient
 * @returns {Function} Model function that takes eventStore
 */
export function UserAwardsModel(userPubkey) {
	return (eventStore) => {
		const filter = {
			kinds: [8],
			'#p': [userPubkey]
		};

		// Use map instead of scan - timeline already handles deduplication and removals
		return eventStore.timeline(filter).pipe(
			map((events) => {
				return events.map((event) => ({
					id: event.id,
					issuerPubkey: event.pubkey,
					created_at: event.created_at,
					badgeAddress: event.tags.find((t) => t[0] === 'a')?.[1] || '',
					recipients: event.tags.filter((t) => t[0] === 'p').map((t) => t[1]),
					rawEvent: event
				}));
			}),
			distinctUntilChanged(
				(prev, curr) =>
					prev?.length === curr?.length && prev?.every((a, i) => a.id === curr[i]?.id)
			)
		);
	};
}

/**
 * Badge Awards Model - transforms kind 8 events for a specific badge
 * Used to see all users who have been awarded a specific badge
 *
 * @param {string} badgeAddress - Badge address in format "30009:pubkey:identifier"
 * @returns {Function} Model function that takes eventStore
 */
export function BadgeAwardsModel(badgeAddress) {
	return (eventStore) => {
		const filter = {
			kinds: [8],
			'#a': [badgeAddress]
		};

		return eventStore.timeline(filter).pipe(
			map((events) => {
				return events.map((event) => ({
					id: event.id,
					issuerPubkey: event.pubkey,
					created_at: event.created_at,
					badgeAddress: event.tags.find((t) => t[0] === 'a')?.[1] || '',
					recipients: event.tags.filter((t) => t[0] === 'p').map((t) => t[1]),
					rawEvent: event
				}));
			}),
			distinctUntilChanged(
				(prev, curr) =>
					prev?.length === curr?.length && prev?.every((a, i) => a.id === curr[i]?.id)
			)
		);
	};
}
