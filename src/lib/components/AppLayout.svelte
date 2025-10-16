<script>
	import { useJoinedCommunitiesList } from '$lib/stores/joined-communities-list.svelte.js';
	import { getTagValue } from 'applesauce-core/helpers';
	import CommunitySidebar from '$lib/components/CommunitySidebar.svelte';
	import ContentNavSidebar from '$lib/components/ContentNavSidebar.svelte';
	import BottomTabBar from '$lib/components/BottomTabBar.svelte';
	import MainContentArea from '$lib/components/MainContentArea.svelte';
	import { MenuIcon, CloseIcon } from '$lib/components/icons';

	const getJoinedCommunities = useJoinedCommunitiesList();
	const joinedCommunities = $derived(getJoinedCommunities());

	let selectedCommunityId = $state(/** @type {string | null} */ (null));
	let selectedContentType = $state('home');
	let leftDrawerOpen = $state(false);

	// Auto-select first community on mount if none selected
	$effect(() => {
		if (!selectedCommunityId && joinedCommunities.length > 0) {
			const firstCommunity = joinedCommunities.sort()[0];
			const pubkey = getTagValue(firstCommunity, 'd');
			if (pubkey) {
				selectedCommunityId = pubkey;
			}
		}
	});

	/**
	 * Handle community selection
	 * @param {string} pubkey
	 */
	function handleCommunitySelect(pubkey) {
		selectedCommunityId = pubkey;
		leftDrawerOpen = false; // Close drawer on mobile after selection
	}

	/**
	 * Handle content type selection
	 * @param {string} type
	 */
	function handleContentTypeSelect(type) {
		selectedContentType = type;
	}

	function toggleDrawer() {
		leftDrawerOpen = !leftDrawerOpen;
	}
</script>

<!-- Desktop Layout: Fixed sidebars -->
<div class="hidden lg:flex h-[calc(100vh-4rem)] pt-16">
	<CommunitySidebar
		bind:selectedCommunityId
		onCommunitySelect={handleCommunitySelect}
	/>
	<ContentNavSidebar
		bind:selectedContentType
		onContentTypeSelect={handleContentTypeSelect}
		communitySelected={!!selectedCommunityId}
	/>
	<MainContentArea
		{selectedCommunityId}
		{selectedContentType}
	/>
</div>

<!-- Mobile Layout: Drawer + Bottom Tab Bar -->
<div class="lg:hidden">
	<div class="drawer">
		<input id="community-drawer" type="checkbox" class="drawer-toggle" bind:checked={leftDrawerOpen} />
		<div class="drawer-content flex flex-col h-[calc(100vh-4rem)] pt-16">
			<!-- Mobile Header with Menu Button -->
			<div class="bg-base-200 border-b border-base-300 p-4 flex items-center justify-between">
				<button
					onclick={toggleDrawer}
					class="btn btn-ghost btn-circle"
				>
					<MenuIcon class_="w-6 h-6" />
				</button>
				<h1 class="text-lg font-semibold">Communikey</h1>
				<div class="w-10"></div> <!-- Spacer for centering -->
			</div>

			<!-- Main Content -->
			<div class="flex-1 overflow-auto">
				<MainContentArea
					{selectedCommunityId}
					{selectedContentType}
				/>
			</div>

			<!-- Bottom Tab Bar -->
			{#if selectedCommunityId}
				<BottomTabBar
					bind:selectedContentType
					onContentTypeSelect={handleContentTypeSelect}
				/>
			{/if}
		</div>

		<!-- Drawer Side (Community List) -->
		<div class="drawer-side z-50">
			<label for="community-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
			<div class="w-80 min-h-full bg-base-200">
				<!-- Drawer Header -->
				<div class="flex items-center justify-between p-4 border-b border-base-300">
					<h2 class="text-lg font-semibold">Communities</h2>
					<button
						onclick={toggleDrawer}
						class="btn btn-ghost btn-circle btn-sm"
					>
						<CloseIcon class_="w-5 h-5" />
					</button>
				</div>

				<!-- Community List -->
				<div class="overflow-y-auto h-[calc(100vh-8rem)]">
					<CommunitySidebar
						bind:selectedCommunityId
						onCommunitySelect={handleCommunitySelect}
					/>
				</div>
			</div>
		</div>
	</div>
</div>
