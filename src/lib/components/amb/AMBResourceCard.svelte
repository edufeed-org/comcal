<!--
  AMBResourceCard Component
  Displays AMB educational resource preview in card format for feed views
-->

<script>
	import { getProfilePicture, getDisplayName } from 'applesauce-core/helpers';
	import { formatCalendarDate } from '$lib/helpers/calendar.js';
	import ImageWithFallback from '../shared/ImageWithFallback.svelte';
	import ReactionBar from '../reactions/ReactionBar.svelte';
	import EventTags from '../calendar/EventTags.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {any} resource - Formatted AMB resource object
	 * @property {any} [authorProfile] - Author's profile
	 * @property {boolean} [compact=false] - Compact display mode
	 */

	/** @type {Props} */
	let { resource, authorProfile = null, compact = false } = $props();

	// Get author info
	const authorName = $derived(
		getDisplayName(authorProfile, resource.pubkey.slice(0, 8) + '...')
	);
	const authorAvatar = $derived(
		getProfilePicture(authorProfile) || `https://robohash.org/${resource.pubkey}`
	);

	// Get published date
	const publishedAt = $derived(new Date(resource.publishedDate * 1000));

	/**
	 * Open resource in new tab
	 */
	function openResource() {
		if (resource.primaryURL) {
			window.open(resource.primaryURL, '_blank', 'noopener,noreferrer');
		}
	}

	/**
	 * Handle keyboard navigation
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if ((e.key === 'Enter' || e.key === ' ') && resource.primaryURL) {
			e.preventDefault();
			openResource();
		}
	}
</script>

<div
	class="amb-card bg-base-100 border border-base-300 rounded-lg shadow-sm hover:shadow-md transition-shadow {compact
		? 'p-3'
		: 'p-4'} {resource.primaryURL ? 'cursor-pointer hover:border-secondary' : ''}"
	class:focus:outline-none={resource.primaryURL}
	class:focus:ring-2={resource.primaryURL}
	class:focus:ring-secondary={resource.primaryURL}
	class:focus:ring-opacity-50={resource.primaryURL}
	role={resource.primaryURL ? 'button' : 'article'}
	tabindex={resource.primaryURL ? 0 : -1}
	onclick={resource.primaryURL ? openResource : undefined}
	onkeydown={resource.primaryURL ? handleKeydown : undefined}
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
		<!-- Resource Type Badge -->
		{#if resource.learningResourceTypes.length > 0}
			<div class="badge badge-primary badge-sm">
				{resource.learningResourceTypes[0].label}
			</div>
		{/if}
	</div>

	<!-- Resource Image -->
	{#if resource.image && !compact}
		<div class="mb-3">
			<div class="w-full aspect-[2/1] overflow-hidden rounded-lg">
				<ImageWithFallback
					src={resource.image}
					alt={resource.name}
					fallbackType="article"
					class="w-full h-full object-cover"
				/>
			</div>
		</div>
	{/if}

	<!-- Resource Content -->
	<div class="space-y-2">
		<!-- Title with License Badge -->
		<div class="flex items-start gap-2">
			<h2 class="flex-1 text-xl font-bold text-base-content line-clamp-2 {compact ? 'text-lg' : ''}">
				{resource.name}
			</h2>
			{#if resource.license}
				<a
					href={resource.license.id}
					target="_blank"
					rel="noopener noreferrer"
					class="badge badge-outline badge-sm shrink-0"
					title={resource.license.label}
					onclick={(e) => e.stopPropagation()}
				>
					{resource.license.label}
				</a>
			{/if}
		</div>

		<!-- Description -->
		{#if resource.description && !compact}
			<p class="text-base-content/70 text-sm line-clamp-3">
				{resource.description}
			</p>
		{/if}

		<!-- Metadata Badges -->
		{#if !compact}
			<div class="flex flex-wrap gap-2">
				<!-- Educational Level -->
				{#if resource.educationalLevels.length > 0}
					<div class="badge badge-secondary badge-sm">
						{resource.educationalLevels[0].label}
					</div>
				{/if}

				<!-- Free/Paid Indicator -->
				{#if resource.isFree}
					<div class="badge badge-success badge-sm">Free</div>
				{/if}

				<!-- Languages -->
				{#each resource.languages.slice(0, 2) as lang}
					<div class="badge badge-ghost badge-sm">{lang.toUpperCase()}</div>
				{/each}
			</div>
		{/if}

		<!-- Subjects/Topics -->
		{#if resource.subjects.length > 0 && !compact}
			<div class="flex flex-wrap gap-1">
				{#each resource.subjects.slice(0, 3) as subject}
					<span class="text-xs text-base-content/60 bg-base-200 px-2 py-1 rounded">
						{subject.label}
					</span>
				{/each}
				{#if resource.subjects.length > 3}
					<span class="text-xs text-base-content/60 bg-base-200 px-2 py-1 rounded">
						+{resource.subjects.length - 3} more
					</span>
				{/if}
			</div>
		{/if}

		<!-- Keywords (Tags) -->
		{#if resource.keywords.length > 0 && !compact}
			<div class="flex flex-wrap gap-1">
				<EventTags tags={resource.keywords.slice(0, 5)} size="sm" targetRoute="/feed" />
			</div>
		{/if}

		<!-- Action Button -->
		{#if resource.primaryURL}
			<div class="pt-2">
				<button
					class="btn btn-secondary btn-sm"
					onclick={(e) => {
						e.stopPropagation();
						openResource();
					}}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
						/>
					</svg>
					Access Resource
				</button>
			</div>
		{/if}

		<!-- Reactions -->
		{#if !compact && resource.tags}
			<div class="pt-2">
				<ReactionBar event={{ id: resource.id, kind: resource.kind, pubkey: resource.pubkey, tags: resource.tags }} />
			</div>
		{/if}
	</div>
</div>

<style>
	.amb-card {
		display: flex;
		flex-direction: column;
	}
</style>
