<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import { hexToNpub } from '$lib/helpers/nostrUtils.js';
	import CommunitySidebar from '$lib/components/community/layout/CommunitySidebar.svelte';
	import ContentNavSidebar from '$lib/components/community/layout/ContentNavSidebar.svelte';
	import MainContentArea from '$lib/components/community/layout/MainContentArea.svelte';
	import BottomTabBar from '$lib/components/community/layout/BottomTabBar.svelte';
	import { MenuIcon, CloseIcon } from '$lib/components/icons';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { ProfileModel } from 'applesauce-core/models';
	import { profileLoader } from '$lib/loaders/profile.js';
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { runtimeConfig } from '$lib/stores/config.svelte.js';

	/**
	 * Get communikey relays from app config
	 * @returns {string[]}
	 */
	function getCommunikeyRelays() {
		return [
			...(runtimeConfig.appRelays?.communikey || []),
			...(runtimeConfig.fallbackRelays || [])
		];
	}

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	const activeUser = useActiveUser();

	// State management for content type navigation
	let selectedContentType = $state('home');
	let leftDrawerOpen = $state(false);
	let communikeyEvent = $state(/** @type {any} */ (null));
	let communityProfile = $state(/** @type {any} */ (null));

	// Check URL params for initial view (e.g., ?view=calendar)
	$effect(() => {
		const viewParam = $page.url.searchParams.get('view');
		if (viewParam === 'calendar') {
			selectedContentType = 'calendar';
		}
	});

	// Load community's kind:10222 event for content type configuration
	$effect(() => {
		if (data.pubkey) {
			const pointer = {
				kind: 10222,
				pubkey: data.pubkey
			};

			const sub = eventStore.replaceable(pointer).subscribe((event) => {
				communikeyEvent = event || null;
			});

			return () => {
				sub.unsubscribe();
			};
		} else {
			communikeyEvent = null;
		}
	});

	// Pre-warm community relays when community event is loaded
	$effect(() => {
		if (communikeyEvent) {
			import('$lib/services/relay-warming-service.svelte.js').then(({ warmCommunityRelays }) => {
				const signer = activeUser()?.signer || null;
				warmCommunityRelays(communikeyEvent, signer);
			});
		}
	});

	// Load community profile for header display
	$effect(() => {
		// Reset profile when community changes
		communityProfile = null;

		if (data.pubkey) {
			// 1. Trigger loader to fetch profile from relays
			const loaderSub = profileLoader({
				kind: 0,
				pubkey: data.pubkey,
				relays: getCommunikeyRelays()
			}).subscribe(() => {
				// Loader automatically populates eventStore
			});

			// 2. Subscribe to model for reactive parsed profile from eventStore
			const modelSub = eventStore
				.model(ProfileModel, data.pubkey)
				.subscribe((profileContent) => {
					communityProfile = profileContent;
				});

			// Cleanup subscriptions when community changes
			return () => {
				loaderSub.unsubscribe();
				modelSub.unsubscribe();
			};
		}
	});

	// Derive display name and avatar for mobile header
	let displayName = $derived(
		communityProfile?.name || 
		communityProfile?.display_name || 
		'Community'
	);
	
	let avatarUrl = $derived(getProfilePicture(communityProfile));

	/**
	 * Handle community selection from sidebar
	 * @param {string} pubkey
	 */
	function handleCommunitySelect(pubkey) {
		const npub = hexToNpub(pubkey);
		if (npub) {
			goto(`/c/${npub}`);
		}
		leftDrawerOpen = false; // Close drawer on mobile after selection
	}

	/**
	 * Handle content type selection
	 * @param {string} type
	 */
	function handleContentTypeSelect(type) {
		selectedContentType = type;
	}

	/**
	 * Handle navigation from content type kind number
	 * @param {number} kind - The content type kind number
	 */
	function handleKindNavigation(kind) {
		// Map kind numbers to content types
		const kindMap = /** @type {{ [key: number]: string }} */ ({
			9: 'chat',
			31923: 'calendar'
		});
		const contentType = kindMap[kind];
		if (contentType) {
			selectedContentType = contentType;
		}
	}

	function toggleDrawer() {
		leftDrawerOpen = !leftDrawerOpen;
	}
</script>

<!-- Desktop Layout -->
{#if activeUser()}
	<!-- Logged-in: Show all three sidebars -->
	<div class="hidden lg:flex h-[calc(100vh-8rem)] pt-16">
		<CommunitySidebar
			currentCommunityId={data.pubkey}
			onCommunitySelect={handleCommunitySelect}
		/>
		<ContentNavSidebar
			bind:selectedContentType
			onContentTypeSelect={handleContentTypeSelect}
			communitySelected={true}
		/>
		<MainContentArea
			selectedCommunityId={data.pubkey}
			{selectedContentType}
			onKindNavigation={handleKindNavigation}
		/>
	</div>
{:else}
	<!-- Logged-out: Just content nav + main -->
	<div class="hidden lg:flex h-[calc(100vh-8rem)] pt-16">
		<ContentNavSidebar
			bind:selectedContentType
			onContentTypeSelect={handleContentTypeSelect}
			communitySelected={true}
		/>
		<MainContentArea
			selectedCommunityId={data.pubkey}
			{selectedContentType}
			onKindNavigation={handleKindNavigation}
		/>
	</div>
{/if}

<!-- Mobile Layout -->
{#if activeUser()}
	<!-- Logged-in: Drawer + Bottom Tab Bar -->
	<div class="lg:hidden">
		<div class="drawer">
			<input id="community-drawer" type="checkbox" class="drawer-toggle" bind:checked={leftDrawerOpen} />
			<div class="drawer-content flex flex-col h-[calc(100vh-8rem)] pt-16">
				<!-- Mobile Header with Menu Button -->
				<div class="bg-base-200 border-b border-base-300 p-4 flex items-center justify-between">
					<button
						onclick={toggleDrawer}
						class="btn btn-ghost btn-circle"
					>
						<MenuIcon class_="w-6 h-6" />
					</button>
					
					<!-- Community Identity -->
					{#if communityProfile}
						<div class="flex items-center gap-2 flex-1 min-w-0 mx-3">
							<div class="avatar">
								<div class="w-8 rounded-full ring-1 ring-base-300">
									<img src={avatarUrl} alt={displayName} class="object-cover" />
								</div>
							</div>
							<h1 class="text-base font-semibold text-base-content truncate">
								{displayName}
							</h1>
						</div>
					{:else}
						<h1 class="text-lg font-semibold">Communikey</h1>
					{/if}
					
					<div class="w-10"></div> <!-- Spacer for balance -->
				</div>

				<!-- Main Content -->
				<div class="flex-1 overflow-auto">
					<MainContentArea
						selectedCommunityId={data.pubkey}
						{selectedContentType}
						onKindNavigation={handleKindNavigation}
					/>
				</div>

				<!-- Bottom Tab Bar -->
				<BottomTabBar
					bind:selectedContentType
					onContentTypeSelect={handleContentTypeSelect}
					communityEvent={communikeyEvent}
				/>
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
							currentCommunityId={data.pubkey}
							onCommunitySelect={handleCommunitySelect}
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Logged-out: Simple layout -->
	<div class="lg:hidden h-[calc(100vh-8rem)] pt-16 flex flex-col">
		<div class="flex-1 overflow-auto pb-16">
			<MainContentArea
				selectedCommunityId={data.pubkey}
				{selectedContentType}
				onKindNavigation={handleKindNavigation}
			/>
		</div>
		<BottomTabBar
			bind:selectedContentType
			onContentTypeSelect={handleContentTypeSelect}
			communityEvent={communikeyEvent}
		/>
	</div>
{/if}
