/**
 * Comment threading utilities for NIP-22 comments
 * Organizes flat comment lists into hierarchical tree structures
 */

/**
 * Builds a hierarchical comment tree from a flat list of comments
 * 
 * @param {any[]} comments - Flat array of comment events (kind 1111)
 * @returns {any[]} Array of top-level comments with nested replies
 * 
 * @example
 * const commentTree = buildCommentTree(flatComments);
 * // Returns: [
 * //   { ...comment, replies: [{ ...reply, replies: [...] }] },
 * //   { ...comment, replies: [] }
 * // ]
 */
export function buildCommentTree(comments) {
	if (!comments || comments.length === 0) {
		return [];
	}

	// Create a map for quick lookup
	/** @type {Map<string, any>} */
	const commentMap = new Map();
	/** @type {any[]} */
	const topLevelComments = [];

	// First pass: Create map of all comments with empty replies arrays
	comments.forEach((comment) => {
		commentMap.set(comment.id, {
			...comment,
			replies: []
		});
	});

	// Second pass: Build tree structure
	comments.forEach((comment) => {
		const parentId = getParentCommentId(comment);

		if (!parentId) {
			// This is a top-level comment (parent is the root event)
			topLevelComments.push(commentMap.get(comment.id));
		} else {
			// This is a reply to another comment
			const parent = commentMap.get(parentId);
			if (parent) {
				parent.replies.push(commentMap.get(comment.id));
			} else {
				// Parent not found (orphaned comment), treat as top-level
				topLevelComments.push(commentMap.get(comment.id));
			}
		}
	});

	// Sort top-level comments by timestamp (newest first)
	topLevelComments.sort((a, b) => b.created_at - a.created_at);

	// Recursively sort all reply threads
	sortRepliesRecursively(topLevelComments);

	return topLevelComments;
}

/**
 * Gets the parent comment ID from a comment event
 * Returns null if the comment is a top-level comment (parent is root event)
 * 
 * @param {any} comment - The comment event
 * @returns {string|null} Parent comment ID or null
 */
function getParentCommentId(comment) {
	// According to NIP-22:
	// - Lowercase 'e' tag points to parent item
	// - Lowercase 'k' tag indicates parent kind
	// - If parent kind is 1111, it's a comment-on-comment
	// - Otherwise, it's a top-level comment on the root event

	const parentKindTag = comment.tags.find((/** @type {any[]} */ t) => t[0] === 'k');
	const parentKind = parentKindTag ? parseInt(parentKindTag[1]) : null;

	// If parent kind is 1111, this is a reply to a comment
	if (parentKind === 1111) {
		const parentETag = comment.tags.find((/** @type {any[]} */ t) => t[0] === 'e');
		return parentETag ? parentETag[1] : null;
	}

	// Otherwise, this is a top-level comment
	return null;
}

/**
 * Recursively sorts replies in all comment threads
 * 
 * @param {any[]} comments - Array of comments with replies
 */
function sortRepliesRecursively(comments) {
	comments.forEach((comment) => {
		if (comment.replies && comment.replies.length > 0) {
			// Sort replies (newest first)
			comment.replies.sort((/** @type {any} */ a, /** @type {any} */ b) => b.created_at - a.created_at);
			// Recursively sort nested replies
			sortRepliesRecursively(comment.replies);
		}
	});
}

/**
 * Counts total number of comments in a thread (including nested replies)
 * 
 * @param {any[]} commentTree - Tree of comments with replies
 * @returns {number} Total comment count
 */
export function countComments(commentTree) {
	let count = 0;

	/**
	 * @param {any[]} comments
	 */
	function countRecursive(comments) {
		comments.forEach((comment) => {
			count++;
			if (comment.replies && comment.replies.length > 0) {
				countRecursive(comment.replies);
			}
		});
	}

	countRecursive(commentTree);
	return count;
}

/**
 * Gets the depth level of a comment in the tree
 * 
 * @param {any[]} commentTree - Tree of comments
 * @param {string} commentId - ID of the comment to find
 * @param {number} currentDepth - Current recursion depth
 * @returns {number} Depth level (0 for top-level)
 */
export function getCommentDepth(commentTree, commentId, currentDepth = 0) {
	for (const comment of commentTree) {
		if (comment.id === commentId) {
			return currentDepth;
		}
		if (comment.replies && comment.replies.length > 0) {
			const depth = getCommentDepth(comment.replies, commentId, currentDepth + 1);
			if (depth !== -1) {
				return depth;
			}
		}
	}
	return -1;
}

/**
 * Flattens a comment tree back into a flat array
 * Useful for counting or searching
 * 
 * @param {any[]} commentTree - Tree of comments
 * @returns {any[]} Flat array of all comments
 */
export function flattenCommentTree(commentTree) {
	/** @type {any[]} */
	const flat = [];

	/**
	 * @param {any[]} comments
	 */
	function flattenRecursive(comments) {
		comments.forEach((comment) => {
			flat.push(comment);
			if (comment.replies && comment.replies.length > 0) {
				flattenRecursive(comment.replies);
			}
		});
	}

	flattenRecursive(commentTree);
	return flat;
}
