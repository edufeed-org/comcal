<!--
  AMBResourceCard Component
  Displays AMB educational resource preview in card format for feed views
-->

<script>
	import { getProfilePicture, getDisplayName } from 'applesauce-core/helpers';
	import { formatCalendarDate } from '$lib/helpers/calendar.js';
	import { nip19 } from 'nostr-tools';
	import { goto } from '$app/navigation';
	import ImageWithFallback from '../shared/ImageWithFallback.svelte';
	import ReactionBar from '../reactions/ReactionBar.svelte';
	import EventTags from '../calendar/EventTags.svelte';
	import EventDebugPanel from '../shared/EventDebugPanel.svelte';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { getLabelsWithFallback } from '$lib/helpers/educational/ambTransform.js';
	import { runtimeConfig } from '$lib/stores/config.svelte.js';
	import * as m from '$lib/paraglide/messages.js';

	// Helper to determine if identifier is a nostr URI
	/**
	 * @param {string|null|undefined} identifier
	 */
	function isNostrUri(identifier) {
		return identifier?.startsWith('nostr:') || identifier?.startsWith('naddr1');
	}

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

	// Language-aware labels - reactive to locale changes!
	// Uses fallback: user's language → English → ID
	const localizedLearningResourceTypes = $derived(
		getLabelsWithFallback(resource.tags, 'learningResourceType', getLocale())
	);
	const localizedSubjects = $derived(
		getLabelsWithFallback(resource.tags, 'about', getLocale())
	);
	const localizedEducationalLevels = $derived(
		getLabelsWithFallback(resource.tags, 'educationalLevel', getLocale())
	);

	// Generate naddr for navigation to detail view with relay hints
	const resourceNaddr = $derived.by(() => {
		// Get relay hints from resource's seen relays or use AMB relays from config
		const relayHints = resource.event?.seen_on 
			? Array.from(resource.event.seen_on).slice(0, 3)
			: runtimeConfig.educational.ambRelays.slice(0, 3);
		
		return nip19.naddrEncode({
			kind: resource.kind,
			pubkey: resource.pubkey,
			identifier: resource.identifier,
			relays: relayHints.length > 0 ? relayHints : undefined
		});
	});

	// Content type detection - only show "Open Content" for valid external URLs or nostr URIs
	const hasExternalUrl = $derived(
		resource.identifier?.startsWith('http://') || resource.identifier?.startsWith('https://')
	);
	const shouldShowOpenContentButton = $derived(
		hasExternalUrl || isNostrUri(resource.identifier)
	);

	/**
	 * Navigate to resource detail view
	 */
	function navigateToDetail() {
		goto(`/${resourceNaddr}`);
	}

	/**
	 * Navigate to content - handles both nostr identifiers and external URLs
	 */
	function openContent() {
		if (!resource.identifier) return;
		
		if (isNostrUri(resource.identifier)) {
			// Handle nostr identifiers - strip 'nostr:' prefix if present
			const naddr = resource.identifier.replace(/^nostr:/, '');
			goto(`/${naddr}`);
		} else {
			// External URL - open in new tab
			window.open(resource.identifier, '_blank', 'noopener,noreferrer');
		}
	}

	/**
	 * Handle keyboard navigation
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			navigateToDetail();
		}
	}
</script>

<div
	class="amb-card bg-base-100 border border-base-300 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-secondary {compact
		? 'p-3'
		: 'p-4'}"
	class:focus:outline-none={true}
	class:focus:ring-2={true}
	class:focus:ring-secondary={true}
	class:focus:ring-opacity-50={true}
	role="button"
	tabindex="0"
	onclick={navigateToDetail}
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
		<!-- Resource Type Badge -->
		{#if localizedLearningResourceTypes.length > 0}
			<div class="badge badge-primary badge-sm">
				{localizedLearningResourceTypes[0].label}
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
					onclick={(e) => {
						e.stopPropagation();
					}}
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
				{#if localizedEducationalLevels.length > 0}
					<div class="badge badge-secondary badge-sm">
						{localizedEducationalLevels[0].label}
					</div>
				{/if}

				<!-- Free/Paid Indicator -->
				{#if resource.isFree}
					<div class="badge badge-success badge-sm">{m.amb_resource_free()}</div>
				{/if}

				<!-- Languages -->
				{#each resource.languages.slice(0, 2) as lang}
					<div class="badge badge-ghost badge-sm">{lang.toUpperCase()}</div>
				{/each}
			</div>
		{/if}

		<!-- Subjects/Topics -->
		{#if localizedSubjects.length > 0 && !compact}
			<div class="flex flex-wrap gap-1">
				{#each localizedSubjects.slice(0, 3) as subject}
					<span class="text-xs text-base-content/60 bg-base-200 px-2 py-1 rounded">
						{subject.label}
					</span>
				{/each}
				{#if localizedSubjects.length > 3}
					<span class="text-xs text-base-content/60 bg-base-200 px-2 py-1 rounded">
						+{localizedSubjects.length - 3} more
					</span>
				{/if}
			</div>
		{/if}

		<!-- Keywords (Tags) -->
		{#if resource.keywords.length > 0 && !compact}
			<div class="flex flex-wrap gap-1">
				<EventTags tags={resource.keywords.slice(0, 5)} size="sm" targetRoute="/discover" />
			</div>
		{/if}

		<!-- Action Button - Only show for external URLs or nostr URIs -->
		{#if shouldShowOpenContentButton}
			<div class="pt-2">
				<button
					class="btn btn-primary btn-sm"
					onclick={(e) => {
						e.stopPropagation();
						openContent();
					}}
				>
					{#if isNostrUri(resource.identifier)}
						<!-- Play/View icon for internal content -->
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
								d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					{m.amb_resource_view_content()}
				{:else}
						<!-- External link icon -->
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
					{m.amb_resource_open_content()}
				{/if}
				</button>
			</div>
		{/if}

		<!-- Reactions -->
		{#if !compact && resource.tags}
			<div class="pt-2" onclick={(e) => e.stopPropagation()}>
				<ReactionBar event={{ id: resource.id, kind: resource.kind, pubkey: resource.pubkey, tags: resource.tags }} />
			</div>
		{/if}

		<!-- Debug Panel -->
		{#if !compact}
			<div onclick={(e) => e.stopPropagation()}>
				<EventDebugPanel event={resource} />
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
