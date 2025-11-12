<!--
  AMBResourceView Component
  Full page viewer for AMB educational resources (kind 30142)
  Follows Nostr-first approach with comments/reactions as primary interaction
-->

<script>
	import { getProfilePicture, getDisplayName } from 'applesauce-core/helpers';
	import { formatCalendarDate } from '$lib/helpers/calendar.js';
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import { nip19 } from 'nostr-tools';
	import ImageWithFallback from '../shared/ImageWithFallback.svelte';
	import ReactionBar from '../reactions/ReactionBar.svelte';
	import CommentList from '../comments/CommentList.svelte';
	import EventTags from '../calendar/EventTags.svelte';
	import CommunityShare from '../shared/CommunityShare.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {any} event - Raw Nostr event (kind 30142)
	 * @property {any} resource - Formatted resource object (from formatAMBResource)
	 */

	/** @type {Props} */
	let { event, resource } = $props();

	// Get active user (reactive to login/logout)
	const getActiveUser = useActiveUser();
	const activeUser = $derived(getActiveUser());

	// Share UI state
	let showShareUI = $state(false);

	// Parse related resources from 'a' tags
	const relatedResources = $derived.by(() => {
		return (
			event.tags
				?.filter((/** @type {any} */ t) => t[0] === 'a')
				.map((/** @type {any} */ t) => {
					try {
						const [kind, pubkey, identifier] = t[1].split(':');
						return {
							naddr: nip19.naddrEncode({
								kind: parseInt(kind),
								pubkey,
								identifier
							}),
							raw: t[1],
							label: identifier || t[1]
						};
					} catch {
						return null;
					}
				})
				.filter(Boolean) || []
		);
	});

	// Parse creators from event tags (p-tags)
	const creators = $derived.by(() => {
		const creatorPubkeys =
			event.tags?.filter((/** @type {any} */ t) => t[0] === 'p').map((/** @type {any} */ t) => t[1]) || [];

		return creatorPubkeys.map((/** @type {string} */ pubkey) => ({
			pubkey,
			hasProfile: true
		}));
	});

	// Check if we have educational metadata to display
	const hasEducationalMetadata = $derived(
		resource.learningResourceTypes.length > 0 ||
			resource.educationalLevels.length > 0 ||
			resource.subjects.length > 0
	);

	// Published date
	const publishedAt = $derived(
		resource.publishedDate ? new Date(resource.publishedDate * 1000) : null
	);
</script>

<svelte:head>
	<title>{resource.name} - Communikey</title>
	<meta name="description" content={resource.description || 'Educational resource on Communikey'} />
</svelte:head>

<article class="amb-resource-view max-w-4xl mx-auto">
	<!-- HEADER SECTION -->
	<header class="mb-6">
		<!-- Title -->
		<h1 class="text-4xl md:text-5xl font-bold text-base-content mb-4">
			{resource.name}
		</h1>

		<!-- Learning Resource Type Badge (prominent) -->
		{#if resource.learningResourceTypes.length > 0}
			<div class="mb-4 flex flex-wrap gap-2">
				{#each resource.learningResourceTypes.slice(0, 2) as type}
					<span class="badge badge-primary badge-lg">{type.label}</span>
				{/each}
			</div>
		{/if}

		<!-- Description -->
		{#if resource.description}
			<p class="text-xl text-base-content/80 mb-6">
				{resource.description}
			</p>
		{/if}

		<!-- Metadata bar -->
		<div class="flex flex-col md:flex-row md:items-center gap-4 py-4 border-y border-base-300">
			<!-- Creator Info -->
			<div class="flex items-center gap-3 flex-1">
				{#if creators.length > 0}
					{@const firstCreator = creators[0]}
					{@const getCreatorProfile = useUserProfile(firstCreator.pubkey)}
					{@const creatorProfile = getCreatorProfile()}
					<div class="avatar">
						<div class="w-12 h-12 rounded-full">
							<img
								src={getProfilePicture(creatorProfile) ||
									`https://robohash.org/${firstCreator.pubkey}`}
								alt="Creator"
							/>
						</div>
					</div>
					<div>
						<div class="font-semibold text-base-content">
							{getDisplayName(creatorProfile, firstCreator.pubkey.slice(0, 8) + '...')}
						</div>
						{#if creators.length > 1}
							<div class="text-sm text-base-content/60">
								+{creators.length - 1} more creator{creators.length > 2 ? 's' : ''}
							</div>
						{/if}
					</div>
				{:else if resource.creatorNames.length > 0}
					<!-- Fallback to name-only creators -->
					<div class="avatar placeholder">
						<div class="w-12 h-12 rounded-full bg-neutral text-neutral-content">
							<span class="text-lg">{resource.creatorNames[0][0]}</span>
						</div>
					</div>
					<div>
						<div class="font-semibold text-base-content">{resource.creatorNames[0]}</div>
						{#if resource.creatorNames.length > 1}
							<div class="text-sm text-base-content/60">
								+{resource.creatorNames.length - 1} more
							</div>
						{/if}
					</div>
				{/if}

				<!-- Published date -->
				{#if publishedAt}
					<div class="ml-auto text-sm text-base-content/60">
						Published {formatCalendarDate(publishedAt, 'short')}
					</div>
				{/if}
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

	<!-- FEATURED IMAGE -->
	{#if resource.image}
		<div class="mb-8">
			<div class="w-full aspect-[16/9] overflow-hidden rounded-lg">
				<ImageWithFallback
					src={resource.image}
					alt={resource.name}
					fallbackType="article"
					class="w-full h-full object-cover"
				/>
			</div>
		</div>
	{/if}


	<!-- EXTERNAL RESOURCE ACCESS (Secondary CTA) -->
	{#if resource.primaryURL}
		<div class="mb-8 p-6 bg-secondary/10 border-2 border-secondary rounded-lg">
			<h2 class="text-xl font-bold text-base-content mb-3">Access External Resource</h2>
			<p class="text-sm text-base-content/70 mb-4">
				This educational resource is hosted externally. Click below to access the full content.
			</p>
			<a
				href={resource.primaryURL}
				target="_blank"
				rel="noopener noreferrer"
				class="btn btn-secondary btn-lg"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-5 h-5 mr-2"
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
				Open Resource
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-4 h-4 ml-2"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 5l7 7-7 7"
					/>
				</svg>
			</a>
			<div class="mt-3 text-xs text-base-content/60 break-all">
				{resource.primaryURL}
			</div>
		</div>
	{/if}

	<!-- EDUCATIONAL METADATA -->
	{#if hasEducationalMetadata}
		<div class="mb-8">
			<h2 class="text-2xl font-bold text-base-content mb-4">Educational Details</h2>

			<div class="grid md:grid-cols-2 gap-6">
				<!-- Educational Levels -->
				{#if resource.educationalLevels.length > 0}
					<div class="bg-base-200 p-4 rounded-lg">
						<h3 class="font-semibold text-sm text-base-content/70 mb-2">Educational Level</h3>
						<div class="flex flex-wrap gap-2">
							{#each resource.educationalLevels as level}
								<span class="badge badge-secondary">{level.label}</span>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Subjects -->
				{#if resource.subjects.length > 0}
					<div class="bg-base-200 p-4 rounded-lg">
						<h3 class="font-semibold text-sm text-base-content/70 mb-2">Subjects</h3>
						<div class="flex flex-wrap gap-2">
							{#each resource.subjects as subject}
								<span class="badge badge-outline">{subject.label}</span>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Languages -->
				{#if resource.languages.length > 0}
					<div class="bg-base-200 p-4 rounded-lg">
						<h3 class="font-semibold text-sm text-base-content/70 mb-2">Available Languages</h3>
						<div class="flex flex-wrap gap-2">
							{#each resource.languages as lang}
								<span class="badge badge-ghost">{lang.toUpperCase()}</span>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Free/Paid -->
				<div class="bg-base-200 p-4 rounded-lg">
					<h3 class="font-semibold text-sm text-base-content/70 mb-2">Access</h3>
					<span
						class="badge {resource.isFree ? 'badge-success' : 'badge-warning'} badge-lg"
					>
						{resource.isFree ? 'Free' : 'Paid / Registration Required'}
					</span>
				</div>
			</div>
		</div>
	{/if}

	<!-- LICENSE INFORMATION -->
	{#if resource.license}
		<div class="mb-8 p-6 bg-info/10 border border-info rounded-lg">
			<h2 class="text-xl font-bold text-base-content mb-3">License</h2>
			<div class="flex items-center gap-4">
				<span class="badge badge-info badge-lg">{resource.license.label}</span>
				<a
					href={resource.license.id}
					target="_blank"
					rel="noopener noreferrer"
					class="text-sm link link-primary"
				>
					View license details →
				</a>
			</div>
		</div>
	{/if}

	<!-- KEYWORDS/TAGS -->
	{#if resource.keywords.length > 0}
		<div class="mb-8">
			<h3 class="text-lg font-semibold text-base-content mb-3">Topics & Keywords</h3>
			<EventTags tags={resource.keywords} size="md" targetRoute="/feed" />
		</div>
	{/if}

	<!-- ALL CREATORS LIST -->
	{#if creators.length > 1 || resource.creatorNames.length > 1}
		<div class="mb-8">
			<h3 class="text-lg font-semibold text-base-content mb-3">All Contributors</h3>
			<div class="grid md:grid-cols-2 gap-3">
				{#each creators as creator}
					{@const getCreatorProfile = useUserProfile(creator.pubkey)}
					{@const creatorProfile = getCreatorProfile()}
					<div class="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
						<div class="avatar">
							<div class="w-10 h-10 rounded-full">
								<img
									src={getProfilePicture(creatorProfile) ||
										`https://robohash.org/${creator.pubkey}`}
									alt="Creator"
								/>
							</div>
						</div>
						<div class="flex-1">
							<div class="font-medium text-base-content">
								{getDisplayName(creatorProfile, creator.pubkey.slice(0, 8) + '...')}
							</div>
						</div>
					</div>
				{/each}

				{#each resource.creatorNames as name}
					<div class="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
						<div class="avatar placeholder">
							<div class="w-10 h-10 rounded-full bg-neutral text-neutral-content">
								<span class="text-lg">{name[0]}</span>
							</div>
						</div>
						<div class="font-medium text-base-content">{name}</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- RELATED RESOURCES -->
	{#if relatedResources.length > 0}
		<div class="mb-8">
			<h3 class="text-lg font-semibold text-base-content mb-3">Related Resources</h3>
			<div class="space-y-2">
				{#each relatedResources as related}
					<a
						href="/{related.naddr}"
						class="block p-3 bg-base-200 hover:bg-base-300 rounded-lg transition-colors"
					>
						<div class="flex items-center gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="w-5 h-5 text-primary shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 7l5 5m0 0l-5 5m5-5H6"
								/>
							</svg>
							<span class="font-medium text-base-content">{related.label}</span>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}


	<!-- REACTIONS (Nostr-first: Primary interaction) -->
	<div class="mb-8 py-4 border-y border-base-300">
		<ReactionBar event={event} />
	</div>

	<!-- COMMENTS SECTION (Nostr-first: Primary interaction) -->
	<div class="mt-8">
		<h2 class="text-2xl font-bold text-base-content mb-4">Discussion</h2>
		<CommentList rootEvent={event} activeUser={activeUser} />
	</div>
</article>
