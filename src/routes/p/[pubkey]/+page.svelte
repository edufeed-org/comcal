<script>
	import { onMount } from 'svelte';
	import { eventStore } from '$lib/store.svelte';
	import { getProfilePicture, getProfileContent } from 'applesauce-core/helpers';
	import NotesTimeline from '$lib/components/notes/NotesTimeline.svelte';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	let profileEvent = $state(/** @type {any} */ (null));
	let showRawData = $state(false);
	let activeTab = $state('notes');
	let bannerError = $state(false);

	onMount(() => {
		eventStore.profile(data.pubkey).subscribe((event) => {
			// $inspect(profileEvent)
			profileEvent = event || null;
		});
	});

	/**
	 * Handle banner image load error
	 */
	function handleBannerError() {
		bannerError = true;
	}

	/**
	 * Get banner URL from profile
	 * @param {any} profile
	 * @returns {string|null}
	 */
	function getBannerUrl(profile) {
		if (!profile) return null;
		return profile.banner || null;
	}

	/**
	 * Copy text to clipboard
	 * @param {string} text
	 */
	async function copyToClipboard(text) {
		try {
			await navigator.clipboard.writeText(text);
			// Could add a toast notification here
		} catch (err) {
			console.error('Failed to copy: ', err);
		}
	}

	/**
	 * Format public key for display
	 * @param {string} pubkey
	 */
	function formatPubkey(pubkey) {
		return `${pubkey.slice(0, 16)}...${pubkey.slice(-8)}`;
	}

	let profile = $derived.by((() => {
		if (!profileEvent) return null;
		try {
			// getProfileContent expects the original Nostr event object
			$inspect("got profile event", profileEvent)
			// const content = getProfileContent(profileEvent);
			return profileEvent || null;
		} catch (error) {
			console.error('Error getting profile content:', error);
			// Fallback to manual parsing if applesauce helper fails
			try {
				if (profileEvent.content) {
					return JSON.parse(profileEvent.content);
				}
			} catch (parseError) {
				console.error('Error parsing profile content manually:', parseError);
			}
			return null;
		}
	}));
	let bannerUrl = $derived(getBannerUrl(profile));
</script>

{#if profileEvent}
	<!-- Main Container with Gradient Background -->
	<div class="min-h-screen">
		<!-- Profile Header Section -->
		<div class="relative">
			<!-- Banner Background (if available) -->
			{#if bannerUrl && !bannerError}
			<div class="h-48 md:h-64 bg-cover bg-center relative" style="background-image: url('{bannerUrl}')">
					<img 
						src={bannerUrl} 
						alt="Banner" 
						class="hidden" 
						onerror={() => handleBannerError()}
					/>
				</div>
			{:else}
				<div class="h-48 md:h-64 bg-gradient-to-r from-blue-500 to-purple-600"></div>
			{/if}

			<!-- Profile Content -->
			<div class="relative px-4 pb-6">
				<div class="max-w-4xl mx-auto">
					<!-- Profile Picture -->
					<div class="relative -mt-16 mb-4">
						<div class="w-32 h-32 rounded-full border-4 border-white bg-gray-800 overflow-hidden">
							<img
								src={getProfilePicture(profileEvent) || `https://robohash.org/${data.pubkey}`}
								alt="Profile picture"
								class="w-full h-full object-cover"
							/>
						</div>
						
						<!-- Edit Button (placeholder) -->
						<button class="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors">
							Edit
						</button>
					</div>

					<!-- Profile Info -->
					<div class="text-white mb-6">
						<h1 class="text-3xl font-bold mb-2">
							{profile?.name || profile?.display_name || 'Anonymous User'}
						</h1>
						
						{#if profile?.display_name && profile.display_name !== profile?.name}
							<p class="text-xl text-gray-300 mb-3">@{profile.display_name}</p>
						{/if}

						<!-- Contact Information -->
						<div class="flex flex-wrap items-center gap-4 mb-4 text-sm">
							{#if profile?.nip05}
								<div class="flex items-center gap-1 text-blue-300">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<span>{profile.nip05}</span>
								</div>
							{/if}

							{#if profile?.website}
								<div class="flex items-center gap-1 text-blue-300">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
									</svg>
									<a href={profile.website} target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">
										{profile.website}
									</a>
								</div>
							{/if}

							{#if profile?.lud16}
								<div class="flex items-center gap-1 text-yellow-400">
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
										<path d="M13 10V3L4 14h7v7l9-11h-7z"/>
									</svg>
									<span>{profile.lud16}</span>
								</div>
							{/if}
						</div>

						<!-- Public Key -->
						<div class="flex items-center gap-2 mb-4">
							<code class="bg-gray-800 bg-opacity-50 px-3 py-1 rounded text-sm font-mono">
								{formatPubkey(data.pubkey)}
							</code>
							<button 
								onclick={() => copyToClipboard(data.pubkey)}
								class="p-1 hover:bg-gray-700 rounded transition-colors"
								title="Copy public key"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							</button>
							<button class="p-1 hover:bg-gray-700 rounded transition-colors" title="Show QR code">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
								</svg>
							</button>
						</div>

						<!-- Bio -->
						{#if profile?.about}
							<p class="text-gray-200 mb-6 max-w-2xl leading-relaxed">{profile.about}</p>
						{/if}

						<!-- Social Stats (placeholder) -->
						<!-- <div class="flex gap-6 text-sm">
							<div class="flex items-center gap-1">
								<span class="font-bold text-white">482</span>
								<span class="text-gray-300">Following</span>
							</div>
							<div class="flex items-center gap-1">
								<span class="font-bold text-white">3</span>
								<span class="text-gray-300">Relays</span>
							</div>
							<div class="flex items-center gap-1">
								<span class="font-bold text-white">29</span>
								<span class="text-gray-300">Muted</span>
							</div>
						</div> -->
					</div>
				</div>
			</div>
		</div>

		<!-- Content Section -->
		<div class="bg-gray-900 min-h-screen">
			<div class="max-w-4xl mx-auto">
				<!-- Tab Navigation -->
				<div class="flex border-b border-gray-700">
					<button 
						class="px-6 py-4 font-medium transition-colors relative {activeTab === 'notes' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-200'}"
						onclick={() => activeTab = 'notes'}
					>
						Notes
					</button>
					<!-- <button 
						class="px-6 py-4 font-medium transition-colors relative {activeTab === 'replies' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-200'}"
						onclick={() => activeTab = 'replies'}
					>
						Replies
					</button> -->
					
					<!-- Tab Actions -->
					<!-- <div class="ml-auto flex items-center gap-2 px-4">
						<button class="p-2 hover:bg-gray-800 rounded-full transition-colors" title="Refresh">
							<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
							</svg>
						</button>
						<button class="p-2 hover:bg-gray-800 rounded-full transition-colors" title="Filter">
							<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
							</svg>
						</button>
					</div> -->
				</div>

				<!-- Tab Content -->
				<div class="p-6">
					{#if activeTab === 'notes'}
						<!-- Real Notes Timeline -->
						<NotesTimeline pubkey={data.pubkey} {profileEvent} />
					{:else}
						<!-- Replies Content -->
						<div class="text-center py-12">
							<div class="text-gray-400 mb-4">
								<svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
								</svg>
								<p class="text-lg">No replies yet</p>
								<p class="text-sm">Replies will appear here when available</p>
							</div>
						</div>
					{/if}
				</div>

				<!-- Developer Section (Collapsible) -->
				<div class="border-t border-gray-700 mt-8">
					<button 
						class="w-full px-6 py-4 text-left text-gray-400 hover:text-gray-200 transition-colors flex items-center justify-between"
						onclick={() => showRawData = !showRawData}
					>
						<span class="font-medium">Developer Information</span>
						<svg class="w-5 h-5 transform transition-transform {showRawData ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					
					{#if showRawData}
						<div class="px-6 pb-6 space-y-6">
							<!-- Basic Information -->
							<div class="bg-gray-800 rounded-lg p-4">
								<h3 class="text-lg font-medium text-white mb-4">Basic Information</h3>
								<div class="space-y-3 text-sm">
									<div class="flex justify-between items-center">
										<span class="text-gray-400">Public Key:</span>
										<code class="text-xs font-mono bg-gray-700 px-2 py-1 rounded text-gray-200">
											{data.pubkey}
										</code>
									</div>
									{#if profileEvent.created_at}
										<div class="flex justify-between items-center">
											<span class="text-gray-400">Profile Created:</span>
											<span class="text-gray-200">
												{new Date(profileEvent.created_at * 1000).toLocaleDateString()}
											</span>
										</div>
									{/if}
								</div>
							</div>

							<!-- Raw Profile Data -->
							<div class="bg-gray-800 rounded-lg p-4">
								<h3 class="text-lg font-medium text-white mb-4">Raw Profile Data</h3>
								<div class="bg-gray-900 rounded p-4 max-h-96 overflow-y-auto">
									<pre class="text-xs font-mono text-gray-300 whitespace-pre-wrap">{JSON.stringify(profile || {}, null, 2)}</pre>
								</div>
							</div>

							<!-- Raw Nostr Event -->
							<div class="bg-gray-800 rounded-lg p-4">
								<h3 class="text-lg font-medium text-white mb-4">Raw Nostr Event (Kind 0)</h3>
								<div class="bg-gray-900 rounded p-4 max-h-96 overflow-y-auto">
									<pre class="text-xs font-mono text-gray-300 whitespace-pre-wrap">{JSON.stringify(profileEvent || {}, null, 2)}</pre>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-gray-700 flex items-center justify-center">
		<div class="text-center">
			<div class="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
			<p class="text-white text-lg">Loading profile...</p>
		</div>
	</div>
{/if}
