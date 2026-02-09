<!--
  ArticleView Component
  Full article display for detail pages
-->

<script>
  import { getProfilePicture, getDisplayName } from 'applesauce-core/helpers';
  import { getArticleTitle, getArticleImage } from 'applesauce-common/helpers';
  import { formatCalendarDate } from '$lib/helpers/calendar.js';
  import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
  import { useActiveUser } from '$lib/stores/accounts.svelte';
  import ImageWithFallback from '../shared/ImageWithFallback.svelte';
  import MarkdownRenderer from '../shared/MarkdownRenderer.svelte';
  import ReactionBar from '../reactions/ReactionBar.svelte';
  import CommentList from '../comments/CommentList.svelte';
  import EventTags from '../calendar/EventTags.svelte';
  import CommunityShare from '../shared/CommunityShare.svelte';

  /**
   * @typedef {Object} Props
   * @property {any} event - Article event (kind 30023)
   */

  /** @type {Props} */
  let { event } = $props();

  // Get active user (reactive to login/logout)
  const getActiveUser = useActiveUser();
  const activeUser = $derived(getActiveUser());

  // Load author profile - pass getter for reactive tracking if event prop changes
  const getAuthorProfile = useUserProfile(() => event.pubkey);
  const authorProfile = $derived(getAuthorProfile());

  // Extract article metadata
  const title = $derived(getArticleTitle(event) || 'Untitled Article');
  const image = $derived(getArticleImage(event));

  // Get summary
  const summary = $derived.by(() => {
    const summaryTag = event.tags?.find((/** @type {any} */ t) => t[0] === 'summary');
    return summaryTag?.[1] || '';
  });

  // Get published date
  const publishedAt = $derived.by(() => {
    const publishedTag = event.tags?.find((/** @type {any} */ t) => t[0] === 'published_at');
    if (publishedTag?.[1]) {
      return new Date(parseInt(publishedTag[1]) * 1000);
    }
    return new Date(event.created_at * 1000);
  });

  // Get hashtags
  const hashtags = $derived.by(() => {
    return (
      event.tags
        ?.filter((/** @type {any} */ t) => t[0] === 't')
        .map((/** @type {any} */ t) => t[1]) || []
    );
  });

  // Get author info
  const authorName = $derived(
    getDisplayName(authorProfile ?? undefined, event.pubkey.slice(0, 8) + '...')
  );
  const authorAvatar = $derived(
    getProfilePicture(authorProfile ?? undefined) || `https://robohash.org/${event.pubkey}`
  );

  // Share UI state
  let showShareUI = $state(false);
</script>

<article class="article-view mx-auto max-w-4xl">
  <!-- Article Header -->
  <header class="mb-8">
    <!-- Title -->
    <h1 class="mb-4 text-4xl font-bold text-base-content md:text-5xl">
      {title}
    </h1>

    <!-- Summary -->
    {#if summary}
      <p class="mb-6 text-xl text-base-content/70">
        {summary}
      </p>
    {/if}

    <!-- Author Info & Metadata -->
    <div class="flex flex-col gap-4 border-y border-base-300 py-4 md:flex-row md:items-center">
      <!-- Author -->
      <div class="flex flex-1 items-center gap-3">
        <div class="avatar">
          <div class="h-12 w-12 rounded-full">
            <img src={authorAvatar} alt={authorName} />
          </div>
        </div>
        <div>
          <div class="font-semibold text-base-content">{authorName}</div>
          <div class="text-sm text-base-content/60">
            Published {formatCalendarDate(publishedAt, 'short')}
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        {#if activeUser}
          <button class="btn btn-sm btn-secondary" onclick={() => (showShareUI = !showShareUI)}>
            {showShareUI ? 'Hide Share' : 'Share'}
          </button>
        {/if}
      </div>
    </div>

    <!-- Share UI -->
    {#if showShareUI && activeUser}
      <div class="mt-4 rounded-lg bg-base-200 p-4">
        <CommunityShare {event} {activeUser} shareButtonText="Share with Communities" />
      </div>
    {/if}
  </header>

  <!-- Featured Image -->
  {#if image}
    <div class="mb-8">
      <div class="aspect-[16/9] w-full overflow-hidden rounded-lg">
        <ImageWithFallback
          src={image}
          alt={title}
          fallbackType="article"
          class="h-full w-full object-cover"
        />
      </div>
    </div>
  {/if}

  <!-- Article Content -->
  <div class="prose prose-lg mb-8 max-w-none">
    <MarkdownRenderer content={event.content} />
  </div>

  <!-- Tags -->
  {#if hashtags.length > 0}
    <div class="mb-8 flex flex-wrap gap-2">
      <span class="text-sm font-medium text-base-content/70">Topics:</span>
      <EventTags tags={hashtags} size="md" targetRoute="/discover" />
    </div>
  {/if}

  <!-- Reactions -->
  <div class="mb-8 border-y border-base-300 py-4">
    <ReactionBar {event} />
  </div>

  <!-- Comments -->
  <div class="mt-8">
    <h2 class="mb-4 text-2xl font-bold text-base-content">Comments</h2>
    <CommentList rootEvent={event} {activeUser} />
  </div>
</article>
