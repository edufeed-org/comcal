<script>
  import Comment from './Comment.svelte';
  import CommentThread from './CommentThread.svelte';
  import { countComments } from '$lib/helpers/commentThreading.js';
  import { ChatIcon } from '$lib/components/icons';
  import * as m from '$lib/paraglide/messages';

  /** Max visual nesting depth before showing "Continue thread" */
  const MAX_NESTING_DEPTH = 3;

  /** Thread line colors cycling through DaisyUI theme colors */
  const THREAD_COLORS = [
    'var(--color-primary)',
    'var(--color-secondary)',
    'var(--color-accent)',
    'var(--color-info)',
    'var(--color-success)',
    'var(--color-warning)'
  ];

  /**
   * @typedef {Object} CommentThreadProps
   * @property {any} comment - The comment with nested replies
   * @property {any} rootEvent - The root event being commented on
   * @property {any} activeUser - The currently active user
   * @property {number} [depth] - Current nesting depth
   * @property {number} [maxDepth] - Max depth before showing "Continue thread"
   * @property {boolean} [collapsedReplies] - When true, replies start collapsed
   * @property {Set<string>} [expandedIds] - IDs to force-expand (after back navigation)
   * @property {(commentId: string) => void} [onFocusThread] - Callback to focus on a subtree
   * @property {(event: any) => void} [onCommentPosted] - Callback when new comment is posted
   */

  /** @type {CommentThreadProps} */
  let {
    comment,
    rootEvent,
    activeUser,
    depth = 0,
    maxDepth = MAX_NESTING_DEPTH,
    collapsedReplies = false,
    expandedIds = new Set(),
    onFocusThread,
    onCommentPosted = (/** @type {any} */ _event) => {}
  } = $props();

  let expanded = $state(false);

  // Force-expand when this comment is in the expandedIds set (after back navigation)
  $effect(() => {
    if (expandedIds.has(comment.id)) {
      expanded = true;
    }
  });

  let hasReplies = $derived(comment.replies && comment.replies.length > 0);
  let replyCount = $derived(hasReplies ? countComments(comment.replies) : 0);
  let shouldCollapse = $derived(collapsedReplies && hasReplies && !expanded);
  let shouldShowContinueThread = $derived(hasReplies && depth >= maxDepth && onFocusThread);
</script>

<div class="comment-thread">
  <!-- Render the comment -->
  <Comment {comment} {rootEvent} {activeUser} {depth} {onCommentPosted} />

  <!-- Recursively render replies -->
  {#if hasReplies}
    {#if shouldShowContinueThread}
      <!-- Depth limit reached: show "Continue thread" button -->
      <button
        class="btn mt-1 gap-1 text-base-content/60 btn-ghost btn-sm"
        style="margin-left: 20px;"
        onclick={() => onFocusThread?.(comment.id)}
        data-testid="continue-thread-btn"
      >
        <ChatIcon class_="w-4 h-4" />
        {replyCount === 1
          ? m.comments_continue_thread_singular()
          : m.comments_continue_thread({ count: replyCount })}
      </button>
    {:else if shouldCollapse}
      <!-- Collapsed reply summary -->
      <button
        class="btn mt-1 gap-1 text-base-content/60 btn-ghost btn-sm"
        style="margin-left: 20px;"
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
          style="margin-left: 20px;"
          onclick={() => (expanded = false)}
          data-testid="collapse-replies-btn"
        >
          {m.comments_hide_replies()}
        </button>
      {/if}
      <div
        class="replies mt-2"
        style="border-left: 3px solid {THREAD_COLORS[
          depth % THREAD_COLORS.length
        ]}; margin-left: 8px; padding-left: 12px;"
      >
        {#each comment.replies as reply (reply.id)}
          <CommentThread
            comment={reply}
            {rootEvent}
            {activeUser}
            depth={depth + 1}
            {maxDepth}
            {collapsedReplies}
            {expandedIds}
            {onFocusThread}
            {onCommentPosted}
          />
        {/each}
      </div>
    {/if}
  {/if}
</div>
