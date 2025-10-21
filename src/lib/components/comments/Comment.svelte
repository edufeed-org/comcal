<script>
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
	import { getDisplayName, getProfilePicture } from 'applesauce-core/helpers';
	import CommentInput from './CommentInput.svelte';
	import { ChatIcon } from '$lib/components/icons';
	import MarkdownRenderer from '$lib/components/shared/MarkdownRenderer.svelte';

	/**
	 * @typedef {Object} CommentProps
	 * @property {any} comment - The comment event
	 * @property {any} rootEvent - The root event being commented on
	 * @property {any} activeUser - The currently active user
	 * @property {number} [depth] - Nesting depth (0 for top-level)
	 * @property {(event: any) => void} [onCommentPosted] - Callback when reply is posted
	 */

	/** @type {CommentProps} */
	let {
		comment,
		rootEvent,
		activeUser,
		depth = 0,
		onCommentPosted = (/** @type {any} */ _event) => {}
	} = $props();

	let showReplyForm = $state(false);

	// Get author profile
	const getUserProfile = useUserProfile(comment.pubkey);
	let authorProfile = $derived(getUserProfile());

	/**
	 * Format timestamp
	 */
	function formatTimestamp(/** @type {number} */ timestamp) {
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		if (diff < 60000) return 'just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
		return date.toLocaleDateString();
	}

	/**
	 * Handle reply button click
	 */
	function handleReplyClick() {
		showReplyForm = !showReplyForm;
	}

	/**
	 * Handle reply posted
	 */
	function handleReplyPosted(/** @type {any} */ event) {
		showReplyForm = false;
		onCommentPosted(event);
	}

	/**
	 * Handle cancel reply
	 */
	function handleCancelReply() {
		showReplyForm = false;
	}

	// Calculate indentation (16px per level, max 5 levels)
	const maxDepth = 5;
	const effectiveDepth = Math.min(depth, maxDepth);
	const indentClass = effectiveDepth > 0 ? `ml-${effectiveDepth * 4}` : '';
</script>

<div class="comment-wrapper {indentClass}">
	<!-- Reddit-style thread line for nested comments -->
	{#if depth > 0}
		<div class="absolute left-0 top-0 bottom-0 w-0.5 bg-base-300"></div>
	{/if}

	<div class="relative rounded-lg bg-base-100 p-4 {depth > 0 ? 'ml-4' : ''}">
		<!-- Comment Header -->
		<div class="mb-3 flex items-start gap-3">
			<!-- Avatar -->
			<a href="/p/{comment.pubkey}" class="avatar flex-shrink-0">
				<div class="w-10 rounded-full">
					{#if getProfilePicture(authorProfile)}
						<img src={getProfilePicture(authorProfile)} alt={getDisplayName(authorProfile)} />
					{:else}
						<div
							class="flex h-full w-full items-center justify-center bg-primary text-sm font-semibold text-primary-content"
						>
							{getDisplayName(authorProfile)?.charAt(0).toUpperCase() || '?'}
						</div>
					{/if}
				</div>
			</a>

			<!-- Author & Timestamp -->
			<div class="flex-1">
				<div class="flex items-baseline gap-2">
					<a href="/p/{comment.pubkey}" class="font-semibold hover:underline">
						{getDisplayName(authorProfile) ||
							`${comment.pubkey.slice(0, 8)}...${comment.pubkey.slice(-4)}`}
					</a>
					<span class="text-xs text-base-content/50">
						{formatTimestamp(comment.created_at)}
					</span>
				</div>

				<!-- Comment Content -->
				<MarkdownRenderer 
					content={comment.content} 
					class="mt-2 prose-sm max-w-none text-base-content/80" 
				/>

				<!-- Actions -->
				<div class="mt-2 flex items-center gap-4">
					{#if activeUser}
						<button
							class="btn btn-ghost btn-xs gap-1"
							onclick={handleReplyClick}
							class:btn-active={showReplyForm}
						>
							<ChatIcon class_="w-4 h-4" />
							Reply
						</button>
					{/if}
					{#if comment.replies && comment.replies.length > 0}
						<span class="text-xs text-base-content/50">
							{comment.replies.length}
							{comment.replies.length === 1 ? 'reply' : 'replies'}
						</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Reply Form -->
		{#if showReplyForm && activeUser}
			<div class="mt-4 border-t border-base-300 pt-4">
				<CommentInput
					{rootEvent}
					parentItem={comment}
					{activeUser}
					placeholder="Write a reply..."
					onCommentPosted={handleReplyPosted}
					onCancel={handleCancelReply}
					autoFocus={true}
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	.comment-wrapper {
		position: relative;
	}
</style>
