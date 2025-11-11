<!--
  ArticleView Component
  Full article display for detail pages
-->

<script>
	import {
		getArticleTitle,
		getArticleImage,
		getProfilePicture,
		getDisplayName
	} from 'applesauce-core/helpers';
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

	// Load author profile
	const getAuthorProfile = useUserProfile(event.pubkey);
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
		return event.tags?.filter((/** @type {any} */ t) => t[0] === 't').map((/** @type {any} */ t) => t[1]) || [];
	});

	// Get author info
	const authorName = $derived(getDisplayName(authorProfile ?? undefined, event.pubkey.slice(0, 8) + '...'));
	const authorAvatar = $derived(
		getProfilePicture(authorProfile ?? undefined) || `https://robohash.org/${event.pubkey}`
	);

	// Share UI state
	let showShareUI = $state(false);
</script>

<article class="article-view max-w-4xl mx-auto">
	<!-- Article Header -->
	<header class="mb-8">
		<!-- Title -->
		<h1 class="text-4xl md:text-5xl font-bold text-base-content mb-4">
			{title}
		</h1>

		<!-- Summary -->
		{#if summary}
			<p class="text-xl text-base-content/70 mb-6">
				{summary}
			</p>
		{/if}

		<!-- Author Info & Metadata -->
		<div class="flex flex-col md:flex-row md:items-center gap-4 py-4 border-y border-base-300">
			<!-- Author -->
			<div class="flex items-center gap-3 flex-1">
				<div class="avatar">
					<div class="w-12 h-12 rounded-full">
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
					<button
						class="btn btn-secondary btn-sm"
						onclick={() => (showShareUI = !showShareUI)}
					>
						{showShareUI ? 'Hide Share' : 'Share'}
					</button>
				{/if}
			</div>
		</div>

		<!-- Share UI -->
		{#if showShareUI && activeUser}
			<div class="mt-4 p-4 bg-base-200 rounded-lg">
				<CommunityShare 
					event={event} 
					activeUser={activeUser}
					shareButtonText="Share with Communities"
				/>
			</div>
		{/if}
	</header>

	<!-- Featured Image -->
	{#if image}
		<div class="mb-8">
			<div class="w-full aspect-[16/9] overflow-hidden rounded-lg">
				<ImageWithFallback
					src={image}
					alt={title}
					fallbackType="article"
					class="w-full h-full object-cover"
				/>
			</div>
		</div>
	{/if}

	<!-- Article Content -->
	<div class="prose prose-lg max-w-none mb-8">
		<MarkdownRenderer content={event.content} />
	</div>

	<!-- Tags -->
	{#if hashtags.length > 0}
		<div class="mb-8 flex flex-wrap gap-2">
			<span class="text-sm font-medium text-base-content/70">Topics:</span>
			<EventTags tags={hashtags} size="md" />
		</div>
	{/if}

	<!-- Reactions -->
	<div class="mb-8 py-4 border-y border-base-300">
		<ReactionBar event={event} />
	</div>

	<!-- Comments -->
	<div class="mt-8">
		<h2 class="text-2xl font-bold text-base-content mb-4">Comments</h2>
		<CommentList rootEvent={event} activeUser={activeUser} />
	</div>
</article>
