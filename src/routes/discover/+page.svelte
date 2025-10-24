<script>
	import { useAllCommunities } from '$lib/stores/all-communities.svelte.js';
	import { useJoinedCommunitiesList } from '$lib/stores/joined-communities-list.svelte.js';
	import { extractHashtags } from '$lib/helpers/text.js';
	import { getTagValue, getProfileContent } from 'applesauce-core/helpers';
	import { profileLoader } from '$lib/loaders/profile.js';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { ProfileModel } from 'applesauce-core/models';
	import { appConfig } from '$lib/config.js';
	import CommunikeyCard from '$lib/components/CommunikeyCard.svelte';
	import CommunitySearchInput from '$lib/components/discover/CommunitySearchInput.svelte';
	import CommunityTagSelector from '$lib/components/discover/CommunityTagSelector.svelte';

	const getAllCommunities = useAllCommunities();
	const getJoinedCommunities = useJoinedCommunitiesList();
	
	const allCommunities = $derived(getAllCommunities());
	const joinedCommunities = $derived(getJoinedCommunities());

	let searchQuery = $state('');
	let selectedTags = $state(/** @type {string[]} */ ([]));
	let showAll = $state(false);

	// Reactive community profiles using ProfileModel (loader + model pattern)
	// This Map updates automatically as profiles load from relays
	let communityProfiles = $state(/** @type {Map<string, any>} */ (new Map()));

	// Load profiles reactively using ProfileModel
	$effect(() => {
		if (allCommunities.length === 0) {
			console.log('📋 Discover: No communities to load profiles for');
			return;
		}

		console.log('📋 Discover: Setting up profile loading for', allCommunities.length, 'communities');
		
		const loaderSubscriptions = /** @type {any[]} */ ([]);
		const modelSubscriptions = /** @type {any[]} */ ([]);
		const profilesMap = new Map();

		allCommunities.forEach((community) => {
			const pubkey = getTagValue(community, 'd') || community.pubkey;

			// Step 1: Loader - fetch profile from relays into EventStore
			const loaderSub = profileLoader({
				kind: 0,
				pubkey,
				relays: appConfig.calendar.defaultRelays
			}).subscribe({
				next: () => {
					console.log('📋 Discover: Profile loader fetched for', pubkey.slice(0, 8));
				},
				error: (error) => {
					console.error('📋 Discover: Error loading profile for', pubkey.slice(0, 8), error);
				}
			});

			loaderSubscriptions.push(loaderSub);

			// Step 2: Model - subscribe to EventStore for reactive updates
			// ProfileModel returns ProfileContent directly, not an Event
			const modelSub = eventStore.model(ProfileModel, { pubkey }).subscribe((profile) => {
				if (profile) {
					profilesMap.set(pubkey, profile);
					// Trigger reactivity by creating new Map
					communityProfiles = new Map(profilesMap);
					console.log('📋 Discover: Profile updated for', profile?.name || pubkey.slice(0, 8));
				}
			});

			modelSubscriptions.push(modelSub);
		});

		console.log('📋 Discover: Profile subscriptions set up:', {
			loaders: loaderSubscriptions.length,
			models: modelSubscriptions.length
		});

		// Cleanup subscriptions when effect re-runs or component unmounts
		return () => {
			loaderSubscriptions.forEach((s) => s.unsubscribe());
			modelSubscriptions.forEach((s) => s.unsubscribe());
			console.log('📋 Discover: Cleaned up profile subscriptions');
		};
	});

	// Get joined community pubkeys for comparison
	const joinedPubkeys = $derived(
		new Set(joinedCommunities.map((c) => getTagValue(c, 'd')).filter(Boolean))
	);

	// Filter and sort communities
	const filteredCommunities = $derived.by(() => {
		let filtered = allCommunities;

		// Apply search filter by name and description (using pre-loaded profiles)
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter((community) => {
				const communityPubkey = getTagValue(community, 'd') || community.pubkey;
				const profile = communityProfiles.get(communityPubkey);
				
				const name = profile?.name?.toLowerCase() || '';
				const about = profile?.about?.toLowerCase() || '';
				
				return name.includes(query) || about.includes(query);
			});
		}

		// Apply tag filter (OR logic - show if community has ANY of the selected tags)
		if (selectedTags.length > 0) {
			filtered = filtered.filter((community) => {
				const communityPubkey = getTagValue(community, 'd') || community.pubkey;
				const profile = communityProfiles.get(communityPubkey);
				
				// Collect all tags from multiple sources
				const allTagsForCommunity = new Set();
				
				// 1. From profile about field
				if (profile?.about) {
					extractHashtags(profile.about).forEach(tag => allTagsForCommunity.add(tag));
				}
				
				// 2. From community content
				if (community.content) {
					extractHashtags(community.content).forEach(tag => allTagsForCommunity.add(tag));
				}
				
				// 3. From 't' tags
				const explicitTags = community.tags
					?.filter(tag => tag[0] === 't')
					.map(tag => tag[1].toLowerCase().trim()) || [];
				explicitTags.forEach(tag => {
					if (tag) allTagsForCommunity.add(tag);
				});
				
				// Check if any selected tag matches
				return selectedTags.some(selectedTag => 
					allTagsForCommunity.has(selectedTag.toLowerCase())
				);
			});
		}

		// Sort: joined communities first, then alphabetically
		return [...filtered].sort((a, b) => {
			const aPubkey = getTagValue(a, 'd') || a.pubkey;
			const bPubkey = getTagValue(b, 'd') || b.pubkey;
			const aJoined = joinedPubkeys.has(aPubkey);
			const bJoined = joinedPubkeys.has(bPubkey);

			// Joined communities first
			if (aJoined !== bJoined) {
				return aJoined ? -1 : 1;
			}

			// Then alphabetically by name
			const aProfile = communityProfiles.get(aPubkey);
			const bProfile = communityProfiles.get(bPubkey);
			const aName = aProfile?.name || aPubkey;
			const bName = bProfile?.name || bPubkey;
			return aName.localeCompare(bName);
		});
	});

	// Calculate display limit
	const displayLimit = 12;
	const displayedCommunities = $derived(
		showAll ? filteredCommunities : filteredCommunities.slice(0, displayLimit)
	);
	const hasMore = $derived(filteredCommunities.length > displayLimit);

	// Callback handlers for reusable components
	function handleSearchChange(/** @type {string} */ newQuery) {
		searchQuery = newQuery;
		console.log('📋 Discover: Search query updated:', newQuery);
	}

	function handleTagChange(/** @type {string[]} */ newTags) {
		selectedTags = newTags;
		console.log('📋 Discover: Selected tags updated:', newTags);
	}
</script>

<svelte:head>
	<title>Discover Communities - Communikey</title>
	<meta
		name="description"
		content="Discover and join decentralized communities on Nostr"
	/>
</svelte:head>

<div class="min-h-screen bg-base-100">
	<!-- Header -->
	<div class="bg-gradient-to-br from-primary/10 to-secondary/10 py-12">
		<div class="container mx-auto px-4">
			<h1 class="mb-4 text-center text-4xl font-bold text-base-content md:text-5xl">
				Discover Communities
			</h1>
			<p class="text-center text-lg text-base-content/70">
				Find and join communities that match your interests
			</p>
		</div>
	</div>

	<!-- Search Input Component -->
	<CommunitySearchInput onSearchChange={handleSearchChange} />

	<!-- Tag Filter Component -->
	<CommunityTagSelector
		communities={allCommunities}
		communityProfiles={communityProfiles}
		selectedTags={selectedTags}
		onTagChange={handleTagChange}
	/>

	<!-- Communities Grid -->
	<div class="container mx-auto px-4 py-12">
		{#if allCommunities.length === 0}
			<!-- Loading state -->
			<div class="flex justify-center py-12">
				<div class="text-center">
					<div class="loading loading-spinner loading-lg text-primary"></div>
					<p class="mt-4 text-base-content/70">Loading communities...</p>
				</div>
			</div>
		{:else if filteredCommunities.length === 0}
			<!-- No results -->
			<div class="flex justify-center py-12">
				<div class="text-center">
					<p class="text-xl text-base-content/70">No communities found</p>
					<p class="mt-2 text-base-content/50">Try a different search query</p>
				</div>
			</div>
		{:else}
			<!-- Results count -->
			<div class="mb-6 text-center">
				<p class="text-base-content/70">
					{filteredCommunities.length}
					{filteredCommunities.length === 1 ? 'community' : 'communities'} found
				</p>
			</div>

			<!-- Communities grid -->
			<div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each displayedCommunities as community (community.pubkey)}
					<CommunikeyCard 
						pubkey={community.pubkey}
						showJoinButton={true}
					/>
				{/each}
			</div>

			<!-- Show more/less button -->
			{#if hasMore}
				<div class="mt-8 text-center">
					<button
						onclick={() => (showAll = !showAll)}
						class="btn btn-primary btn-lg"
					>
						{showAll ? 'Show Less' : `Show All (${filteredCommunities.length})`}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>
