<script>
  import Comment from './Comment.svelte';
  import CommentThread from './CommentThread.svelte';

  /**
   * @typedef {Object} CommentThreadProps
   * @property {any} comment - The comment with nested replies
   * @property {any} rootEvent - The root event being commented on
   * @property {any} activeUser - The currently active user
   * @property {number} [depth] - Current nesting depth
   * @property {(event: any) => void} [onCommentPosted] - Callback when new comment is posted
   */

  /** @type {CommentThreadProps} */
  let {
    comment,
    rootEvent,
    activeUser,
    depth = 0,
    onCommentPosted = (/** @type {any} */ _event) => {}
  } = $props();
</script>

<div class="comment-thread">
  <!-- Render the comment -->
  <Comment {comment} {rootEvent} {activeUser} {depth} {onCommentPosted} />

  <!-- Recursively render replies -->
  {#if comment.replies && comment.replies.length > 0}
    <div class="replies mt-2">
      {#each comment.replies as reply (reply.id)}
        <CommentThread
          comment={reply}
          {rootEvent}
          {activeUser}
          depth={depth + 1}
          {onCommentPosted}
        />
      {/each}
    </div>
  {/if}
</div>
