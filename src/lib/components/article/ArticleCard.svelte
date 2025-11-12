<!--
  ArticleCard Component
  Displays article preview in card format for feed views
-->

<script>
	import { getArticleTitle, getArticleImage, getProfilePicture, getDisplayName } from 'applesauce-core/helpers';
	import { formatCalendarDate } from '$lib/helpers/calendar.js';
	import { goto } from '$app/navigation';
	import ImageWithFallback from '../shared/ImageWithFallback.svelte';
	import ReactionBar from '../reactions/ReactionBar.svelte';
	import EventTags from '../calendar/EventTags.svelte';
	import { nip19 } from 'nostr-tools';

	/**
	 * @typedef {Object} Props
	 * @property {any} article - Article event (kind 30023)
	 * @property {any} [authorProfile] - Author's profile
	 * @property {boolean} [compact=false] - Compact display mode
	 */

	/** @type {Props} */
	let { article, authorProfile = null, compact = false } = $props();

	// Extract article metadata using applesauce helpers
	const title = $derived(getArticleTitle(article) || 'Untitled Article');
	const image = $derived(getArticleImage(article));
	
	// Get summary from tags or truncate content
	const summary = $derived.by(() => {
		const summaryTag = article.tags?.find((/** @type {any} */ t) => t[0] === 'summary');
		if (summaryTag?.[1]) return summaryTag[1];
		
		// Fallback to truncated content
		if (article.content) {
			const plainText = article.content.replace(/[#*`\[\]]/g, '').trim();
			return plainText.length > 200 ? plainText.slice(0, 200) + '...' : plainText;
		}
		return '';
	});

	// Get published date
	const publishedAt = $derived.by(() => {
		const publishedTag = article.tags?.find((/** @type {any} */ t) => t[0] === 'published_at');
		if (publishedTag?.[1]) {
			return new Date(parseInt(publishedTag[1]) * 1000);
		}
		return new Date(article.created_at * 1000);
	});

	// Get hashtags
	const hashtags = $derived.by(() => {
		return article.tags?.filter((/** @type {any} */ t) => t[0] === 't').map((/** @type {any} */ t) => t[1]) || [];
	});

	// Get author info
	const authorName = $derived(getDisplayName(authorProfile, article.pubkey.slice(0, 8) + '...'));
	const authorAvatar = $derived(
		getProfilePicture(authorProfile) || `https://robohash.org/${article.pubkey}`
	);

	// Generate naddr for the article
	const articleNaddr = $derived.by(() => {
		try {
			const dTag = article.tags?.find((/** @type {any} */ t) => t[0] === 'd');
			if (!dTag?.[1]) return null;
			
			return nip19.naddrEncode({
				kind: article.kind,
				pubkey: article.pubkey,
				identifier: dTag[1]
			});
		} catch (error) {
			console.error('Error encoding naddr:', error);
			return null;
		}
	});

	/**
	 * Handle card click
	 * @param {MouseEvent} e
	 */
	function handleClick(e) {
		if (articleNaddr && e.target instanceof HTMLElement && !e.target.closest('button, a')) {
			goto(`/${articleNaddr}`);
		}
	}

	/**
	 * Handle keyboard navigation
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if ((e.key === 'Enter' || e.key === ' ') && articleNaddr) {
			e.preventDefault();
			goto(`/${articleNaddr}`);
		}
	}
</script>

<div
	class="article-card bg-base-100 border border-base-300 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 {compact
		? 'p-3'
		: 'p-4'}"
	role="button"
	tabindex="0"
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	<!-- Author Header -->
	<div class="flex items-center gap-3 mb-3">
		<div class="avatar">
			<div class="w-10 h-10 rounded-full">
				<img src={authorAvatar} alt={authorName} />
			</div>
		</div>
		<div class="flex-1 min-w-0">
			<div class="font-medium text-base-content truncate">{authorName}</div>
			<div class="text-sm text-base-content/60">
				{formatCalendarDate(publishedAt, 'short')}
			</div>
		</div>
	</div>

	<!-- Article Image -->
	{#if image && !compact}
		<div class="mb-3">
			<div class="w-full aspect-[2/1] overflow-hidden rounded-lg">
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
	<div class="space-y-2">
		<!-- Title -->
		<h2 class="text-xl font-bold text-base-content line-clamp-2 {compact ? 'text-lg' : ''}">
			{title}
		</h2>

		<!-- Summary -->
		{#if summary && !compact}
			<p class="text-base-content/70 text-sm line-clamp-3">
				{summary}
			</p>
		{/if}

		<!-- Tags -->
		{#if hashtags.length > 0 && !compact}
			<div class="flex flex-wrap gap-1">
				<EventTags tags={hashtags} size="sm" targetRoute="/feed" />
			</div>
		{/if}

		<!-- Read More Button -->
		{#if articleNaddr}
			<div class="pt-2">
				<a href="/{articleNaddr}" class="btn btn-primary btn-sm" onclick={(e) => e.stopPropagation()}>
					Read Article
				</a>
			</div>
		{/if}

		<!-- Reactions -->
		{#if !compact}
			<div class="pt-2">
				<ReactionBar event={article} />
			</div>
		{/if}
	</div>
</div>

<style>
	.article-card {
		display: flex;
		flex-direction: column;
	}
</style>
