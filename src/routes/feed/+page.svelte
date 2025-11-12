<script>
	import { articleTimelineLoader, ambTimelineLoader } from '$lib/loaders';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { appConfig } from '$lib/config';
	import { TimelineModel, ProfileModel } from 'applesauce-core/models';
	import { AMBResourceModel } from '$lib/models';
	import { profileLoader } from '$lib/loaders/profile.js';
	import { getArticlePublished } from 'applesauce-core/helpers';
	import { getAMBPublishedDate } from '$lib/helpers/amb';
	import ArticleCard from '$lib/components/article/ArticleCard.svelte';
	import AMBResourceCard from '$lib/components/amb/AMBResourceCard.svelte';
	import { page } from '$app/stores';
	import { updateQueryParams } from '$lib/helpers/urlParams.js';

	// State management
	let articles = $state(/** @type {any[]} */ ([]));
	let ambResources = $state(/** @type {any[]} */ ([]));
	let authorProfiles = $state(/** @type {Map<string, any>} */ (new Map()));
	let isLoading = $state(true);
	let isLoadingMore = $state(false);
	let hasMoreArticles = $state(true);
	let hasMoreAMB = $state(true);
	let sortBy = $state('newest');
	let authorFilter = $state('');
	let contentType = $state('both'); // 'articles', 'amb', 'both'
	// Initialize from URL params (one-time read using getAll for repeated keys)
	let selectedTags = $state(/** @type {string[]} */ ($page.url.searchParams.getAll('tags')));

	// Watch for URL changes and sync to state (URL → State only, never reverse)
	// This ensures tag clicks from article cards update the filter UI
	$effect(() => {
		const urlTags = $page.url.searchParams.getAll('tags');
		const sortedUrlTags = [...urlTags].sort();
		const sortedSelectedTags = [...selectedTags].sort();

		// Only update if different to prevent unnecessary updates
		if (JSON.stringify(sortedUrlTags) !== JSON.stringify(sortedSelectedTags)) {
			selectedTags = urlTags;
		}
	});

	// Batch size for loading
	const BATCH_SIZE = 20;

	console.log('📰 Feed: Setting up article loading');

	// Step 1: Create stateful loaders once (automatically handle pagination)
	const articleLoader = articleTimelineLoader(BATCH_SIZE);
	const ambLoader = ambTimelineLoader(BATCH_SIZE);

	// Step 2: Initial load for both types
	articleLoader().subscribe({
		error: (/** @type {any} */ error) => {
			console.error('📰 Feed: Article loader error:', error);
			isLoading = false;
		}
	});

	ambLoader().subscribe({
		error: (/** @type {any} */ error) => {
			console.error('📰 Feed: AMB loader error:', error);
			isLoading = false;
		}
	});

	// Step 3: Model subscriptions - EventStore automatically handles deduplication
	const articleModelSub = eventStore
		.model(TimelineModel, { kinds: [30023] })
		.subscribe((timeline) => {
			const previousCount = articles.length;
			articles = timeline || [];
			const currentCount = articles.length;

			// END DETECTION: Only check during pagination, not initial load
			if (isLoadingMore) {
				const newArticlesReceived = currentCount - previousCount;
				if (newArticlesReceived === 0) {
					hasMoreArticles = false;
				}
			}

			console.log(`📰 Feed: Loaded ${articles.length} articles, hasMore: ${hasMoreArticles}`);
			isLoading = false;
		});

	const ambModelSub = eventStore
		.model(AMBResourceModel, [])
		.subscribe((resources) => {
			const previousCount = ambResources.length;
			ambResources = resources || [];
			const currentCount = ambResources.length;

			// END DETECTION: Only check during pagination, not initial load
			if (isLoadingMore) {
				const newResourcesReceived = currentCount - previousCount;
				if (newResourcesReceived === 0) {
					hasMoreAMB = false;
				}
			}

			console.log(`📰 Feed: Loaded ${ambResources.length} AMB resources, hasMore: ${hasMoreAMB}`);
			isLoading = false;
		});

	/**
	 * Load more content - calls both loaders to fetch next batches
	 */
	function loadMoreContent() {
		const hasMore = 
			(contentType === 'articles' && hasMoreArticles) ||
			(contentType === 'amb' && hasMoreAMB) ||
			(contentType === 'both' && (hasMoreArticles || hasMoreAMB));

		if (isLoadingMore || !hasMore) {
			console.log('📰 Feed: Skipping load more', { isLoadingMore, hasMore });
			return;
		}

		console.log('📰 Feed: Loading more content');
		isLoadingMore = true;

		// Load more based on content type filter
		if (contentType === 'articles' || contentType === 'both') {
			if (hasMoreArticles) {
				articleLoader().subscribe({
					error: (/** @type {any} */ error) => {
						console.error('📰 Feed: Article pagination error:', error);
					}
				});
			}
		}

		if (contentType === 'amb' || contentType === 'both') {
			if (hasMoreAMB) {
				ambLoader().subscribe({
					error: (/** @type {any} */ error) => {
						console.error('📰 Feed: AMB pagination error:', error);
					}
				});
			}
		}

		// Failsafe: Reset loading state after timeout
		setTimeout(() => {
			if (isLoadingMore) {
				console.warn('📰 Feed: Pagination timeout - no response from relays');
				isLoadingMore = false;
			}
		}, 10000);
	}

	// Load author profiles - reactively update when articles or resources change
	let profileLoaderSubs = /** @type {any[]} */ ([]);
	let profileModelSubs = /** @type {any[]} */ ([]);
	let profilesMap = new Map();

	$effect(() => {
		// Clean up previous subscriptions
		profileLoaderSubs.forEach((s) => s.unsubscribe());
		profileModelSubs.forEach((s) => s.unsubscribe());
		profileLoaderSubs = [];
		profileModelSubs = [];

		// Get unique author pubkeys from both articles and AMB resources
		const articlePubkeys = articles.map((a) => a.pubkey);
		const ambPubkeys = ambResources.map((r) => r.pubkey);
		const authorPubkeys = [...new Set([...articlePubkeys, ...ambPubkeys])];

		if (authorPubkeys.length === 0) return;

		console.log(`📰 Feed: Loading profiles for ${authorPubkeys.length} authors`);

		authorPubkeys.forEach((pubkey) => {
			// Step 1: Loader - fetch profile from relays
			const loaderSub = profileLoader({
				kind: 0,
				pubkey,
				relays: appConfig.calendar.defaultRelays
			}).subscribe({
				error: (error) => {
					console.error(`📰 Feed: Profile loader error for ${pubkey.slice(0, 8)}:`, error);
				}
			});
			profileLoaderSubs.push(loaderSub);

			// Step 2: Model - subscribe to EventStore for reactive updates
			const modelSub = eventStore.model(ProfileModel, { pubkey }).subscribe((profile) => {
				if (profile) {
					profilesMap.set(pubkey, profile);
					authorProfiles = new Map(profilesMap);
				}
			});
			profileModelSubs.push(modelSub);
		});
	});

	// Cleanup all subscriptions on component unmount
	$effect(() => {
		return () => {
			articleModelSub.unsubscribe();
			ambModelSub.unsubscribe();
			profileLoaderSubs.forEach((s) => s.unsubscribe());
			profileModelSubs.forEach((s) => s.unsubscribe());
			console.log('📰 Feed: Cleaned up all subscriptions');
		};
	});

	// Intersection Observer for infinite scroll
	$effect(() => {
		// Only set up observer if we have content and potentially more to load
		const hasContent = articles.length > 0 || ambResources.length > 0;
		const hasMore = hasMoreArticles || hasMoreAMB;
		if (!hasContent || !hasMore) return;

		const sentinel = document.getElementById('load-more-sentinel');
		if (!sentinel) {
			console.log('📰 Feed: Sentinel element not found');
			return;
		}

		console.log('📰 Feed: Setting up Intersection Observer');

		const observer = new IntersectionObserver(
			(entries) => {
				// Check if sentinel is visible
				if (entries[0].isIntersecting) {
					console.log('📰 Feed: Sentinel visible, loading more content');
					loadMoreContent();
				}
			},
			{
				root: null, // viewport
				rootMargin: '200px', // Trigger 200px before reaching sentinel
				threshold: 0.1
			}
		);

		observer.observe(sentinel);

		return () => {
			console.log('📰 Feed: Cleaning up Intersection Observer');
			observer.disconnect();
		};
	});

	// Get all unique tags from both articles and AMB resources
	const allTags = $derived.by(() => {
		const tags = new Set();
		
		// Tags from articles
		articles.forEach((article) => {
			article.tags
				?.filter((/** @type {any} */ t) => t[0] === 't')
				.forEach((/** @type {any} */ t) => tags.add(t[1]));
		});
		
		// Tags from AMB resources (keywords)
		ambResources.forEach((resource) => {
			resource.keywords?.forEach((/** @type {string} */ keyword) => tags.add(keyword));
		});
		
		return Array.from(tags).sort();
	});

	// Combine, filter, and sort both content types
	const combinedContent = $derived.by(() => {
		// Start with selected content type
		/** @type {Array<{type: string, data: any}>} */
		let items = [];
		
		if (contentType === 'articles' || contentType === 'both') {
			items = [...articles.map(a => ({ type: 'article', data: a }))];
		}
		
		if (contentType === 'amb' || contentType === 'both') {
			items = [...items, ...ambResources.map(r => ({ type: 'amb', data: r }))];
		}

		// Apply author filter
		if (authorFilter.trim()) {
			const query = authorFilter.toLowerCase();
			items = items.filter((item) => {
				const pubkey = item.data.pubkey;
				const profile = authorProfiles.get(pubkey);
				const name = profile?.name?.toLowerCase() || '';
				const displayName = profile?.display_name?.toLowerCase() || '';
				const pubkeyLower = pubkey.toLowerCase();
				
				// Also search in resource names for AMB
				if (item.type === 'amb') {
					const resourceName = item.data.name?.toLowerCase() || '';
					const creatorNames = item.data.creatorNames?.map((/** @type {string} */ n) => n.toLowerCase()) || [];
					return name.includes(query) || displayName.includes(query) || 
								 pubkeyLower.includes(query) || resourceName.includes(query) ||
								 creatorNames.some((/** @type {string} */ n) => n.includes(query));
				}
				
				return name.includes(query) || displayName.includes(query) || pubkeyLower.includes(query);
			});
		}

		// Apply tag filter
		if (selectedTags.length > 0) {
			items = items.filter((item) => {
				if (item.type === 'article') {
					const articleTags =
						item.data.tags
							?.filter((/** @type {any} */ t) => t[0] === 't')
							.map((/** @type {any} */ t) => t[1].toLowerCase()) || [];
					return selectedTags.some((tag) => articleTags.includes(tag.toLowerCase()));
				} else {
					// AMB resource
					const keywords = item.data.keywords?.map((/** @type {string} */ k) => k.toLowerCase()) || [];
					return selectedTags.some((tag) => keywords.includes(tag.toLowerCase()));
				}
			});
		}

		// Sort by published date
		const sorted = [...items].sort((a, b) => {
			const aDate = a.type === 'article' 
				? getArticlePublished(a.data)
				: a.data.publishedDate;
			const bDate = b.type === 'article'
				? getArticlePublished(b.data)
				: b.data.publishedDate;
			
			if (sortBy === 'newest') {
				return bDate - aDate;
			} else if (sortBy === 'oldest') {
				return aDate - bDate;
			}
			return 0;
		});

		return sorted;
	});

	// Show all loaded content (infinite scroll handles pagination)
	const displayedContent = $derived(combinedContent);

	/**
	 * Toggle tag selection
	 * @param {string} tag
	 */
	function toggleTag(tag) {
		const newTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];

		// Update local state
		selectedTags = newTags;

		// Update URL using helper (handles repeated keys automatically)
		updateQueryParams($page.url.searchParams, { tags: newTags });
	}
</script>

<svelte:head>
	<title>Long-form Articles - Communikey</title>
	<meta name="description" content="Discover in-depth articles from the Nostr ecosystem" />
</svelte:head>

<div class="min-h-screen bg-base-100">
	<!-- Hero Section -->
	<div class="bg-gradient-to-br from-primary/10 to-secondary/10 py-12">
		<div class="container mx-auto px-4">
			<h1 class="mb-4 text-center text-4xl font-bold text-base-content md:text-5xl">
				Long-form Articles
			</h1>
			<p class="text-center text-lg text-base-content/70">
				Discover in-depth content from the Nostr ecosystem
			</p>
		</div>
	</div>

	<!-- Filters -->
	<div class="container mx-auto px-4 py-6">
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<!-- Sort -->
			<div class="flex items-center gap-2">
				<label for="sort" class="text-sm font-medium text-base-content">Sort by:</label>
				<select id="sort" bind:value={sortBy} class="select-bordered select select-sm">
					<option value="newest">Newest First</option>
					<option value="oldest">Oldest First</option>
				</select>
			</div>

			<!-- Author Filter -->
			<div class="flex flex-1 items-center gap-2 md:max-w-md">
				<label for="author" class="text-sm font-medium text-base-content">Author:</label>
				<input
					id="author"
					type="text"
					placeholder="Filter by author name or pubkey..."
					bind:value={authorFilter}
					class="input-bordered input input-sm flex-1"
				/>
			</div>
		</div>

		<!-- Tag Filter -->
		{#if allTags.length > 0}
			<div class="mt-4">
				<div class="mb-2 text-sm font-medium text-base-content">Filter by topic:</div>
				<div class="flex flex-wrap gap-2">
					{#each allTags as tag}
						<button
							class="badge cursor-pointer badge-lg transition-colors {selectedTags.includes(tag)
								? 'badge-primary'
								: 'badge-outline hover:badge-primary'}"
							onclick={() => toggleTag(tag)}
						>
							#{tag}
						</button>
					{/each}
				</div>
				{#if selectedTags.length > 0}
					<button
						class="btn mt-2 btn-ghost btn-xs"
						onclick={() => {
							selectedTags = [];
							updateQueryParams($page.url.searchParams, { tags: [] });
						}}
					>
						Clear filters
					</button>
				{/if}
			</div>
		{/if}

		<!-- Content Type Filter -->
		<div class="mt-4">
			<div class="flex items-center gap-4">
				<span class="text-sm font-medium text-base-content">Show:</span>
				<div class="btn-group">
					<button
						class="btn btn-sm {contentType === 'articles' ? 'btn-primary' : 'btn-outline'}"
						onclick={() => (contentType = 'articles')}
					>
						Articles Only
					</button>
					<button
						class="btn btn-sm {contentType === 'both' ? 'btn-primary' : 'btn-outline'}"
						onclick={() => (contentType = 'both')}
					>
						Both
					</button>
					<button
						class="btn btn-sm {contentType === 'amb' ? 'btn-primary' : 'btn-outline'}"
						onclick={() => (contentType = 'amb')}
					>
						Educational Resources
					</button>
				</div>
			</div>
		</div>

		<!-- Results count -->
		{#if displayedContent.length > 0}
			<div class="mt-4 text-center text-sm text-base-content/70">
				Showing {displayedContent.length} item{displayedContent.length !== 1 ? 's' : ''}
				{#if hasMoreArticles || hasMoreAMB}
					<span class="ml-2 text-primary">• Scroll for more</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Content Grid -->
	<div class="container mx-auto px-4 py-8">
		{#if isLoading}
			<!-- Loading State -->
			<div class="flex justify-center py-12">
				<div class="text-center">
					<div class="loading loading-lg loading-spinner text-primary"></div>
					<p class="mt-4 text-base-content/70">Loading content...</p>
				</div>
			</div>
		{:else if displayedContent.length === 0}
			<!-- Empty State -->
			<div class="flex justify-center py-12">
				<div class="text-center">
					{#if articles.length === 0 && ambResources.length === 0}
						<p class="text-xl text-base-content/70">No content found</p>
						<p class="mt-2 text-base-content/50">Check back later for new content</p>
					{:else}
						<p class="text-xl text-base-content/70">No content matches your filters</p>
						<p class="mt-2 text-base-content/50">Try adjusting your search criteria</p>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Content Grid -->
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each displayedContent as item (item.data.id)}
					{#if item.type === 'article'}
						<ArticleCard article={item.data} authorProfile={authorProfiles.get(item.data.pubkey)} />
					{:else}
						<AMBResourceCard resource={item.data} authorProfile={authorProfiles.get(item.data.pubkey)} />
					{/if}
				{/each}
			</div>

			<!-- Infinite Scroll Sentinel -->
			<div id="load-more-sentinel" class="mt-8 py-8">
				{#if isLoadingMore}
					<div class="flex justify-center">
						<div class="text-center">
							<div class="loading loading-lg loading-spinner text-primary"></div>
							<p class="mt-4 text-base-content/70">Loading more content...</p>
						</div>
					</div>
				{:else if !hasMoreArticles && !hasMoreAMB}
					<div class="flex justify-center">
						<p class="text-base-content/50">No more content to load</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
