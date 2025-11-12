<script>
	import { articleTimelineLoader } from '$lib/loaders';
	import { pool, eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { appConfig } from '$lib/config';
	import { TimelineModel, ProfileModel } from 'applesauce-core/models';
	import { profileLoader } from '$lib/loaders/profile.js';
	import ArticleCard from '$lib/components/article/ArticleCard.svelte';
	import { page } from '$app/stores';
	import { updateQueryParams } from '$lib/helpers/urlParams.js';

	// State management
	let articles = $state(/** @type {any[]} */ ([]));
	let articleProfiles = $state(/** @type {Map<string, any>} */ (new Map()));
	let isLoading = $state(true);
	let isLoadingMore = $state(false);
	let hasMoreArticles = $state(true);
	let oldestTimestamp = $state(/** @type {number | null} */ (null));
	let sortBy = $state('newest');
	let authorFilter = $state('');
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

	// Step 1: Create stateful loader once (automatically handles pagination)
	const articleLoader = articleTimelineLoader(BATCH_SIZE);

	// Step 2: Initial load
	articleLoader().subscribe({
		error: (/** @type {any} */ error) => {
			console.error('📰 Feed: Initial loader error:', error);
			isLoading = false;
		}
	});

	// Step 3: Model subscription - EventStore automatically handles deduplication
	const articleModelSub = eventStore.model(TimelineModel, { kinds: [30023] }).subscribe((timeline) => {
		const previousCount = articles.length;
		
		// TimelineModel returns deduplicated array - just use it directly
		articles = timeline || [];
		const currentCount = articles.length;
		
		// Update oldest timestamp for display purposes
		if (articles.length > 0) {
			const timestamps = articles.map(a => a.created_at);
			oldestTimestamp = Math.min(...timestamps);
		}
		
		// END DETECTION: Only check during pagination, not initial load
		if (isLoadingMore) {
			const newArticlesReceived = currentCount - previousCount;
			
			if (newArticlesReceived > 0) {
				console.log(`📰 Feed: Received ${newArticlesReceived} new articles`);
				isLoadingMore = false;
			} else {
				console.log('📰 Feed: No new articles received, reached the end');
				hasMoreArticles = false;
				isLoadingMore = false;
			}
		}
		
		console.log(`📰 Feed: Loaded ${articles.length} articles, oldest: ${oldestTimestamp}, hasMore: ${hasMoreArticles}`);
		isLoading = false;
	});

	/**
	 * Load more articles - the loader is stateful and automatically fetches the next chronological block
	 */
	function loadMoreArticles() {
		if (isLoadingMore || !hasMoreArticles) {
			console.log('📰 Feed: Skipping load more', { isLoadingMore, hasMoreArticles });
			return;
		}
		
		console.log('📰 Feed: Loading more articles (next block)');
		isLoadingMore = true;
		
		// Simply call the loader again - it automatically continues from where it left off
		articleLoader().subscribe({
			error: (/** @type {any} */ error) => {
				console.error('📰 Feed: Pagination error:', error);
				isLoadingMore = false;
				// Keep hasMoreArticles true on error so user can retry
			}
		});
		
		// Failsafe: Reset loading state after timeout if no articles arrive
		setTimeout(() => {
			if (isLoadingMore) {
				console.warn('📰 Feed: Pagination timeout - no response from relays');
				isLoadingMore = false;
				hasMoreArticles = false;
			}
		}, 10000); // 10 second timeout
	}

	// Load author profiles for articles - reactively update when articles change
	let profileLoaderSubs = /** @type {any[]} */ ([]);
	let profileModelSubs = /** @type {any[]} */ ([]);
	let profilesMap = new Map();

	$effect(() => {
		// Clean up previous subscriptions
		profileLoaderSubs.forEach((s) => s.unsubscribe());
		profileModelSubs.forEach((s) => s.unsubscribe());
		profileLoaderSubs = [];
		profileModelSubs = [];

		if (articles.length === 0) return;

		console.log(`📰 Feed: Loading profiles for ${articles.length} articles`);

		// Get unique author pubkeys
		const authorPubkeys = [...new Set(articles.map((a) => a.pubkey))];

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
					articleProfiles = new Map(profilesMap);
				}
			});
			profileModelSubs.push(modelSub);
		});
	});

	// Cleanup all subscriptions on component unmount
	$effect(() => {
		return () => {
			articleModelSub.unsubscribe();
			profileLoaderSubs.forEach((s) => s.unsubscribe());
			profileModelSubs.forEach((s) => s.unsubscribe());
			console.log('📰 Feed: Cleaned up all subscriptions');
		};
	});

	// Intersection Observer for infinite scroll
	$effect(() => {
		// Only set up observer if we have articles and potentially more to load
		if (articles.length === 0 || !hasMoreArticles) return;
		
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
					console.log('📰 Feed: Sentinel visible, loading more articles');
					loadMoreArticles();
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

	// Get all unique tags from articles
	const allTags = $derived.by(() => {
		const tags = new Set();
		articles.forEach((article) => {
			article.tags
				?.filter((/** @type {any} */ t) => t[0] === 't')
				.forEach((/** @type {any} */ t) => tags.add(t[1]));
		});
		return Array.from(tags).sort();
	});

	// Filter and sort articles
	const filteredArticles = $derived.by(() => {
		let filtered = articles;

		// Apply author filter
		if (authorFilter.trim()) {
			const query = authorFilter.toLowerCase();
			filtered = filtered.filter((article) => {
				const profile = articleProfiles.get(article.pubkey);
				const name = profile?.name?.toLowerCase() || '';
				const displayName = profile?.display_name?.toLowerCase() || '';
				const pubkey = article.pubkey.toLowerCase();
				return name.includes(query) || displayName.includes(query) || pubkey.includes(query);
			});
		}

		// Apply tag filter
		if (selectedTags.length > 0) {
			filtered = filtered.filter((article) => {
				const articleTags =
					article.tags?.filter((/** @type {any} */ t) => t[0] === 't').map((/** @type {any} */ t) => t[1].toLowerCase()) || [];
				return selectedTags.some((tag) => articleTags.includes(tag.toLowerCase()));
			});
		}

		// Sort articles
		const sorted = [...filtered].sort((a, b) => {
			if (sortBy === 'newest') {
				return b.created_at - a.created_at;
			} else if (sortBy === 'oldest') {
				return a.created_at - b.created_at;
			}
			return 0;
		});

		return sorted;
	});

	// Show all loaded articles (infinite scroll handles pagination)
	const displayedArticles = $derived(filteredArticles);

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
				<select id="sort" bind:value={sortBy} class="select select-bordered select-sm">
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
					class="input input-bordered input-sm flex-1"
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
							class="badge badge-lg cursor-pointer transition-colors {selectedTags.includes(tag)
								? 'badge-primary'
								: 'badge-outline hover:badge-primary'}"
							onclick={() => toggleTag(tag)}
						>
							#{tag}
						</button>
					{/each}
				</div>
				{#if selectedTags.length > 0}
					<button class="btn btn-ghost btn-xs mt-2" onclick={() => {
						selectedTags = [];
						updateQueryParams($page.url.searchParams, { tags: [] });
					}}>
						Clear filters
					</button>
				{/if}
			</div>
		{/if}

		<!-- Results count -->
		{#if filteredArticles.length > 0}
			<div class="mt-4 text-center text-sm text-base-content/70">
				Showing {displayedArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
				{#if hasMoreArticles}
					<span class="ml-2 text-primary">• Scroll for more</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Articles Grid -->
	<div class="container mx-auto px-4 py-8">
		{#if isLoading}
			<!-- Loading State -->
			<div class="flex justify-center py-12">
				<div class="text-center">
					<div class="loading loading-spinner loading-lg text-primary"></div>
					<p class="mt-4 text-base-content/70">Loading articles...</p>
				</div>
			</div>
		{:else if filteredArticles.length === 0}
			<!-- Empty State -->
			<div class="flex justify-center py-12">
				<div class="text-center">
					{#if articles.length === 0}
						<p class="text-xl text-base-content/70">No articles found</p>
						<p class="mt-2 text-base-content/50">Check back later for new content</p>
					{:else}
						<p class="text-xl text-base-content/70">No articles match your filters</p>
						<p class="mt-2 text-base-content/50">Try adjusting your search criteria</p>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Articles Grid -->
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each displayedArticles as article (article.id)}
					<ArticleCard {article} authorProfile={articleProfiles.get(article.pubkey)} />
				{/each}
			</div>

			<!-- Infinite Scroll Sentinel -->
			<div id="load-more-sentinel" class="mt-8 py-8">
				{#if isLoadingMore}
					<div class="flex justify-center">
						<div class="text-center">
							<div class="loading loading-spinner loading-lg text-primary"></div>
							<p class="mt-4 text-base-content/70">Loading more articles...</p>
						</div>
					</div>
				{:else if !hasMoreArticles}
					<div class="flex justify-center">
						<p class="text-base-content/50">No more articles to load</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
