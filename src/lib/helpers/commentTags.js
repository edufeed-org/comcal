/**
 * NIP-22 Comment Tag Generation
 * Generates proper tags for comments following NIP-22 specification
 */

/**
 * Generates NIP-22 compliant tags for a comment
 * 
 * According to NIP-22:
 * - Uppercase tags (A, K, P) always point to the ROOT event
 * - Lowercase tags (a, e, k, p) point to the PARENT (immediate parent)
 * - For top-level comments: parent = root
 * - For replies to comments: parent = the comment being replied to
 * 
 * @param {any} rootEvent - The original event being commented on
 * @param {any} parentItem - The immediate parent (null for top-level, comment for replies)
 * @param {string} defaultRelay - Default relay URL to use in tags
 * @returns {string[][]} Array of NIP-22 compliant tags
 * 
 * @example
 * // Top-level comment on a calendar event
 * const tags = generateCommentTags(calendarEvent, null, 'wss://relay.damus.io');
 * 
 * // Reply to a comment
 * const tags = generateCommentTags(calendarEvent, parentComment, 'wss://relay.damus.io');
 */
export function generateCommentTags(rootEvent, parentItem, defaultRelay) {
	const tags = [];

	// Root scope tags (uppercase) - always point to the original event
	if (rootEvent.kind >= 30000 && rootEvent.kind < 40000) {
		// Addressable event - use 'A' tag
		const dTag = rootEvent.tags?.find((/** @type {string[]} */ t) => t[0] === 'd')?.[1] || '';
		const address = `${rootEvent.kind}:${rootEvent.pubkey}:${dTag}`;
		tags.push(['A', address, defaultRelay]);
	} else {
		// Regular event - use 'E' tag
		tags.push(['E', rootEvent.id, defaultRelay, rootEvent.pubkey]);
	}

	// Root kind
	tags.push(['K', rootEvent.kind.toString()]);

	// Root author
	tags.push(['P', rootEvent.pubkey, defaultRelay]);

	// Parent scope tags (lowercase) - point to immediate parent
	if (!parentItem || parentItem.kind !== 1111) {
		// Top-level comment: parent is the root event itself
		if (rootEvent.kind >= 30000 && rootEvent.kind < 40000) {
			// Addressable event
			const dTag = rootEvent.tags?.find((/** @type {string[]} */ t) => t[0] === 'd')?.[1] || '';
			const address = `${rootEvent.kind}:${rootEvent.pubkey}:${dTag}`;
			tags.push(['a', address, defaultRelay]);
		}
		// Always include 'e' tag for the event ID
		tags.push(['e', rootEvent.id, defaultRelay]);
		tags.push(['k', rootEvent.kind.toString()]);
		tags.push(['p', rootEvent.pubkey, defaultRelay]);
	} else {
		// Reply to a comment: parent is the comment
		tags.push(['e', parentItem.id, defaultRelay, parentItem.pubkey]);
		tags.push(['k', '1111']); // Parent is a comment
		tags.push(['p', parentItem.pubkey, defaultRelay]);
	}

	return tags;
}

/**
 * Validates if a comment event has proper NIP-22 tags
 * 
 * @param {any} commentEvent - The comment event to validate
 * @returns {{isValid: boolean, errors: string[]}} Validation result with isValid boolean and errors array
 */
export function validateCommentTags(commentEvent) {
	const errors = [];

	if (commentEvent.kind !== 1111) {
		errors.push('Comment must be kind 1111');
	}

	const tags = commentEvent.tags || [];

	// Check for required root tags (uppercase)
	const hasRootScope = tags.some((/** @type {string[]} */ t) => t[0] === 'A' || t[0] === 'E');
	if (!hasRootScope) {
		errors.push('Missing root scope tag (A or E)');
	}

	const hasRootKind = tags.some((/** @type {string[]} */ t) => t[0] === 'K');
	if (!hasRootKind) {
		errors.push('Missing root kind tag (K)');
	}

	const hasRootAuthor = tags.some((/** @type {string[]} */ t) => t[0] === 'P');
	if (!hasRootAuthor) {
		errors.push('Missing root author tag (P)');
	}

	// Check for required parent tags (lowercase)
	const hasParentEvent = tags.some((/** @type {string[]} */ t) => t[0] === 'e');
	if (!hasParentEvent) {
		errors.push('Missing parent event tag (e)');
	}

	const hasParentKind = tags.some((/** @type {string[]} */ t) => t[0] === 'k');
	if (!hasParentKind) {
		errors.push('Missing parent kind tag (k)');
	}

	const hasParentAuthor = tags.some((/** @type {string[]} */ t) => t[0] === 'p');
	if (!hasParentAuthor) {
		errors.push('Missing parent author tag (p)');
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}

/**
 * Extracts the root event reference from a comment
 * 
 * @param {any} commentEvent - The comment event
 * @returns {any} Root event reference with type, id/address, and kind
 */
export function getRootEventReference(commentEvent) {
	const tags = commentEvent.tags || [];

	// Check for addressable event (A tag)
	const aTag = tags.find((/** @type {string[]} */ t) => t[0] === 'A');
	if (aTag) {
		return {
			type: 'addressable',
			address: aTag[1],
			relay: aTag[2],
			kind: parseInt(tags.find((/** @type {string[]} */ t) => t[0] === 'K')?.[1] || '0')
		};
	}

	// Check for regular event (E tag)
	const eTag = tags.find((/** @type {string[]} */ t) => t[0] === 'E');
	if (eTag) {
		return {
			type: 'regular',
			id: eTag[1],
			relay: eTag[2],
			pubkey: eTag[3],
			kind: parseInt(tags.find((/** @type {string[]} */ t) => t[0] === 'K')?.[1] || '0')
		};
	}

	return null;
}

/**
 * Checks if a comment is a top-level comment or a reply
 * 
 * @param {any} commentEvent - The comment event
 * @returns {boolean} True if top-level, false if reply to comment
 */
export function isTopLevelComment(commentEvent) {
	const tags = commentEvent.tags || [];
	const parentKindTag = tags.find((/** @type {string[]} */ t) => t[0] === 'k');
	const parentKind = parentKindTag ? parseInt(parentKindTag[1]) : null;

	// If parent kind is 1111, it's a reply to a comment
	return parentKind !== 1111;
}
