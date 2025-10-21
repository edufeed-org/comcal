<script>
	import { createCommentLoader } from '$lib/loaders/comments.js';
	import { CommentsModel } from 'applesauce-core/models';
	import { buildCommentTree, countComments } from '$lib/helpers/commentThreading.js';
	import CommentThread from './CommentThread.svelte';
	import CommentInput from './CommentInput.svelte';

	/**
	 * @typedef {Object} CommentListProps
	 * @property {any} rootEvent - The root event being commented on
	 * @property {any} activeUser - The currently active user (null if not logged in)
	 */

	/** @type {CommentListProps} */
	let { rootEvent, activeUser } = $props();

	let flatComments = $state(/** @type {any[]} */ ([]));
	let isLoading = $state(true);
	let commentTree = $derived(buildCommentTree(flatComments));
	let totalCount = $derived(countComments(commentTree));
	// Map to track loaded comments and prevent duplicates
	let loadedComments = new Map();

	// Generate event address for comments
	let eventAddress = $derived.by(() => {
		if (!rootEvent) return null;
		if (rootEvent.kind >= 30000 && rootEvent.kind < 40000) {
			// Addressable event
			const dTag = rootEvent.tags?.find((/** @type {string[]} */ t) => t[0] === 'd')?.[1] || '';
			return `${rootEvent.kind}:${rootEvent.pubkey}:${dTag}`;
		}
		// For regular events, we can still use the kind:pubkey:id format
		return `${rootEvent.kind}:${rootEvent.pubkey}:${rootEvent.id}`;
	});

	// Load comments using the comment loader
	$effect(() => {
		if (!rootEvent || !eventAddress) return;

		isLoading = true;
		// Reset the map when rootEvent or eventAddress changes
		loadedComments.clear();

		// Use the comment loader to fetch from relays
		const commentLoader = createCommentLoader(eventAddress);
		const subscription = commentLoader().subscribe({
			next: (/** @type {any} */ comment) => {
				console.log('Loaded comment from relay:', comment);
				// Add to map to deduplicate
				if (!loadedComments.has(comment.id)) {
					loadedComments.set(comment.id, comment);
					// Update flatComments array
					flatComments = Array.from(loadedComments.values());
				}
			},
			error: (/** @type {any} */ err) => {
				console.error('Error in comment loader:', err);
				isLoading = false;
			},
			complete: () => {
				console.log('Comment loading complete');
				isLoading = false;
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	});

	/**
	 * Handle new comment posted
	 * Immediately add to UI for instant feedback
	 */
	function handleCommentPosted(/** @type {any} */ event) {
		console.log('New comment posted, adding to UI immediately:', event);
		
		// Add to map to deduplicate (in case relay echoes it back)
		if (!loadedComments.has(event.id)) {
			loadedComments.set(event.id, event);
			// Update flatComments array to trigger reactive update
			flatComments = Array.from(loadedComments.values());
		}
	}
</script>

<div class="comment-list">
	<div class="card bg-base-200 shadow-lg">
		<div class="card-body">
			<div class="flex items-center justify-between">
				<h2 class="card-title text-2xl">Comments</h2>
				{#if totalCount > 0}
					<span class="badge badge-lg">{totalCount}</span>
				{/if}
			</div>

			<!-- Comment Input Form (top-level) -->
			{#if activeUser}
				<div class="mt-4">
					<CommentInput
						{rootEvent}
						parentItem={null}
						{activeUser}
						placeholder="Write a comment..."
						onCommentPosted={handleCommentPosted}
					/>
				</div>
			{:else}
				<div class="mt-4 rounded-lg bg-base-300 p-4 text-center">
					<p class="text-base-content/70">Sign in to post a comment</p>
				</div>
			{/if}

			<!-- Comments List -->
			<div class="mt-6 space-y-4">
				{#if isLoading}
					<div class="flex items-center justify-center py-8">
						<span class="loading loading-lg loading-spinner"></span>
					</div>
				{:else if commentTree.length === 0}
					<div class="py-8 text-center text-base-content/60">
						No comments yet. Be the first to comment!
					</div>
				{:else}
					{#each commentTree as comment (comment.id)}
						<CommentThread
							{comment}
							{rootEvent}
							{activeUser}
							depth={0}
							onCommentPosted={handleCommentPosted}
						/>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>
