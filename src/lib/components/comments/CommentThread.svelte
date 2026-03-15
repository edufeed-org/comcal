<script>
  import Comment from './Comment.svelte';
  import CommentThread from './CommentThread.svelte';
  import { countComments } from '$lib/helpers/commentThreading.js';
  import { ChatIcon } from '$lib/components/icons';
  import * as m from '$lib/paraglide/messages';

  /**
   * @typedef {Object} CommentThreadProps
   * @property {any} comment - The comment with nested replies
   * @property {any} rootEvent - The root event being commented on
   * @property {any} activeUser - The currently active user
   * @property {number} [depth] - Current nesting depth
   * @property {boolean} [collapsedReplies] - When true, replies start collapsed
   * @property {(event: any) => void} [onCommentPosted] - Callback when new comment is posted
   */

  /** @type {CommentThreadProps} */
  let {
    comment,
    rootEvent,
    activeUser,
    depth = 0,
    collapsedReplies = false,
    onCommentPosted = (/** @type {any} */ _event) => {}
  } = $props();

  let expanded = $state(false);

  let hasReplies = $derived(comment.replies && comment.replies.length > 0);
  let replyCount = $derived(hasReplies ? countComments(comment.replies) : 0);
  let shouldCollapse = $derived(collapsedReplies && hasReplies && !expanded);
</script>

<div class="comment-thread">
  <!-- Render the comment -->
  <Comment {comment} {rootEvent} {activeUser} {depth} {onCommentPosted} />

  <!-- Recursively render replies -->
  {#if hasReplies}
    {#if shouldCollapse}
      <!-- Collapsed reply summary -->
      <button
        class="btn mt-1 gap-1 text-base-content/60 btn-ghost btn-sm"
        style="margin-left: {Math.min(depth + 1, 5) * 16}px;"
        onclick={() => (expanded = true)}
        data-testid="expand-replies-btn"
      >
        <ChatIcon class_="w-4 h-4" />
        {replyCount === 1
          ? m.comments_view_reply()
          : m.comments_view_replies({ count: replyCount })}
      </button>
    {:else}
      {#if collapsedReplies && expanded}
        <!-- Hide replies link -->
        <button
          class="btn mt-1 text-base-content/50 btn-ghost btn-xs"
          style="margin-left: {Math.min(depth + 1, 5) * 16}px;"
          onclick={() => (expanded = false)}
          data-testid="collapse-replies-btn"
        >
          {m.comments_hide_replies()}
        </button>
      {/if}
      <div class="replies mt-2">
        {#each comment.replies as reply (reply.id)}
          <CommentThread
            comment={reply}
            {rootEvent}
            {activeUser}
            depth={depth + 1}
            {collapsedReplies}
            {onCommentPosted}
          />
        {/each}
      </div>
    {/if}
  {/if}
</div>
