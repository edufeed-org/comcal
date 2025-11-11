<script>
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
	import { getDisplayName, getProfilePicture } from 'applesauce-core/helpers';
	import CommentInput from './CommentInput.svelte';
	import { ChatIcon, TrashIcon } from '$lib/components/icons';
	import MarkdownRenderer from '$lib/components/shared/MarkdownRenderer.svelte';
	import { hexToNpub } from '$lib/helpers/nostrUtils';
	import { formatCalendarDate } from '$lib/helpers/calendar.js';
	import ReactionBar from '$lib/components/reactions/ReactionBar.svelte';
	import { deleteComment } from '$lib/helpers/comments.js';
	import { showToast } from '$lib/helpers/toast.js';
	import { appConfig } from '$lib/config.js';
	import * as m from '$lib/paraglide/messages';

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
	let isDeleting = $state(false);

	// Get author profile
	const getUserProfile = useUserProfile(comment.pubkey);
	let authorProfile = $derived(getUserProfile());

	// Check if user can delete this comment (must be the author)
	let canDelete = $derived(
		activeUser && comment.pubkey === activeUser.pubkey
	);

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
		return formatCalendarDate(date, 'short');
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

	/**
	 * Handle delete comment
	 */
	async function handleDelete() {
		if (isDeleting || !canDelete) return;

		// Confirm deletion
		if (!confirm(m.comments_delete_confirm())) {
			return;
		}

		isDeleting = true;
		try {
			await deleteComment(comment, {
				relays: appConfig.calendar.defaultRelays
			});
			showToast(m.comments_delete_success(), 'success');
		} catch (error) {
			console.error('Failed to delete comment:', error);
			showToast(m.comments_delete_error(), 'error');
		} finally {
			isDeleting = false;
		}
	}

	// Calculate indentation using padding (16px per level, max 5 levels)
	const maxDepth = 5;
	const effectiveDepth = Math.min(depth, maxDepth);
	const indent = effectiveDepth * 16; // 16px per level
</script>

<div 
	class="comment-wrapper"
	style="
		padding-left: {indent}px;
		border-left: {depth > 0 ? '2px solid hsl(var(--bc) / 0.15)' : 'none'};
	"
>
	<div class="relative rounded-lg bg-base-100 p-4">
		<!-- Comment Header -->
		<div class="mb-3 flex items-start gap-3">
			<!-- Avatar -->
			<a href="/p/{hexToNpub(comment.pubkey) || comment.pubkey}" class="avatar flex-shrink-0">
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
					<a href="/p/{hexToNpub(comment.pubkey) || comment.pubkey}" class="font-semibold hover:underline">
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

				<!-- Reactions -->
				<div class="mt-3">
					<ReactionBar event={comment} />
				</div>

				<!-- Actions -->
				<div class="mt-2 flex items-center gap-4">
					{#if activeUser}
						<button
							class="btn btn-ghost btn-xs gap-1"
							onclick={handleReplyClick}
							class:btn-active={showReplyForm}
						>
							<ChatIcon class_="w-4 h-4" />
							{m.comments_reply_button()}
						</button>
					{/if}
					{#if canDelete}
						<button
							class="btn btn-ghost btn-xs gap-1 text-error hover:bg-error/10"
							onclick={handleDelete}
							disabled={isDeleting}
						>
							<TrashIcon class="w-4 h-4" />
							{m.comments_delete_button()}
						</button>
					{/if}
					{#if comment.replies && comment.replies.length > 0}
						<span class="text-xs text-base-content/50">
							{comment.replies.length}
							{comment.replies.length === 1 ? m.comments_reply_count_singular() : m.comments_reply_count_plural()}
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
					placeholder={m.comments_reply_placeholder()}
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
