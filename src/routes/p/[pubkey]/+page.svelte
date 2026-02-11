<script>
  import { ProfileModel } from 'applesauce-core/models';
  import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
  import { profileLoader } from '$lib/loaders/profile.js';
  import { runtimeConfig } from '$lib/stores/config.svelte.js';
  import { formatCalendarDate } from '$lib/helpers/calendar.js';
  import NotesTimeline from '$lib/components/notes/NotesTimeline.svelte';
  import { useActiveUser } from '$lib/stores/accounts.svelte.js';
  import { modalStore } from '$lib/stores/modal.svelte.js';
  import * as m from '$lib/paraglide/messages';

  /**
   * Get profile lookup relays from app config
   * @returns {string[]}
   */
  function getProfileRelays() {
    return runtimeConfig.fallbackRelays || [];
  }

  /** @type {import('./$types').PageProps} */
  let { data } = $props();

  let profile = $state(/** @type {any} */ (null));
  let profileEvent = $state(/** @type {any} */ (null));
  let showRawData = $state(false);
  let activeTab = $state('notes');
  let bannerError = $state(false);
  let loadingState = $state(/** @type {'loading' | 'found' | 'notFound'} */ ('loading'));
  let timeoutId = /** @type {ReturnType<typeof setTimeout> | null} */ (null);

  // Use loader + model pattern with timeout tracking
  $effect(() => {
    // Reset state when pubkey changes
    profile = null;
    profileEvent = null;
    loadingState = 'loading';

    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Set 5-second timeout to detect if no profile is found
    timeoutId = setTimeout(() => {
      if (!profile && !profileEvent) {
        loadingState = 'notFound';
      }
    }, 5000);

    // 1. Trigger loader to fetch from relays and populate eventStore
    const loaderSub = profileLoader({
      kind: 0,
      pubkey: data.pubkey,
      relays: getProfileRelays()
    }).subscribe((event) => {
      // Store the raw event for developer section
      if (event) {
        profileEvent = event;
        loadingState = 'found';
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    });

    // 2. Subscribe to model for reactive parsed profile from eventStore
    const modelSub = eventStore.model(ProfileModel, data.pubkey).subscribe((profileContent) => {
      if (profileContent) {
        profile = profileContent;
        loadingState = 'found';
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    });

    // Cleanup both subscriptions and timeout
    return () => {
      loaderSub.unsubscribe();
      modelSub.unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
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

  let bannerUrl = $derived(getBannerUrl(profile));

  // Check if the current user is viewing their own profile
  // Use reactive hook to properly track login/logout changes
  const getActiveUser = useActiveUser();
  let activeUser = $derived(getActiveUser());
  let isOwnProfile = $derived(activeUser?.pubkey === data.pubkey);

  /**
   * Open the edit profile modal
   */
  function openEditModal() {
    modalStore.openModal('profile', {
      profile: profile,
      pubkey: data.pubkey
    });
  }
</script>

{#if loadingState === 'loading'}
  <!-- Loading State -->
  <div
    class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-gray-700"
  >
    <div class="text-center">
      <div
        class="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent"
      ></div>
      <p class="text-lg text-white">{m.profile_loading()}</p>
    </div>
  </div>
{:else if loadingState === 'notFound' && isOwnProfile}
  <!-- Profile Not Found - Own Profile (Prominent Create Profile CTA) -->
  <div
    class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-gray-700 px-4"
  >
    <div class="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
      <div class="mb-6">
        <div
          class="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100"
        >
          <svg
            class="h-12 w-12 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h2 class="mb-2 text-2xl font-bold text-gray-900">{m.profile_not_found_title()}</h2>
        <p class="mb-6 text-gray-600">
          {m.profile_not_found_own_description()}
        </p>
      </div>

      <button
        onclick={openEditModal}
        class="btn mb-4 w-full shadow-lg transition-shadow btn-lg btn-primary hover:shadow-xl"
      >
        <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        {m.profile_create_button()}
      </button>

      <div class="rounded-lg bg-blue-50 p-4 text-left">
        <p class="text-sm text-gray-700">
          <span class="font-semibold">💡 {m.profile_what_happens_next()}</span><br />
          {m.profile_publish_info()}
        </p>
      </div>
    </div>
  </div>
{:else if loadingState === 'notFound' && !isOwnProfile}
  <!-- Profile Not Found - Other User's Profile -->
  <div
    class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-gray-700 px-4"
  >
    <div class="max-w-md text-center text-white">
      <div
        class="bg-opacity-20 mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white"
      >
        <svg class="h-12 w-12 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </div>
      <h2 class="mb-3 text-3xl font-bold">{m.profile_not_found_title()}</h2>
      <p class="mb-4 text-lg text-gray-200">{m.profile_not_found_other_description()}</p>
      <div class="bg-opacity-10 rounded-lg bg-white p-4 backdrop-blur-sm">
        <p class="text-sm text-gray-300">
          {m.profile_not_found_relay_info()}
        </p>
      </div>
    </div>
  </div>
{:else if profile}
  <!-- Profile Found - Main Container with Gradient Background -->
  <div class="min-h-screen">
    <!-- Profile Header Section -->
    <div class="relative">
      <!-- Banner Background (if available) -->
      {#if bannerUrl && !bannerError}
        <div
          class="relative h-48 bg-cover bg-center md:h-64"
          style="background-image: url('{bannerUrl}')"
        >
          <img src={bannerUrl} alt="Banner" class="hidden" onerror={() => handleBannerError()} />
        </div>
      {:else}
        <div class="h-48 bg-gradient-to-r from-blue-500 to-purple-600 md:h-64"></div>
      {/if}

      <!-- Profile Content -->
      <div class="relative px-4 pb-6">
        <div class="mx-auto max-w-4xl">
          <!-- Profile Picture -->
          <div class="relative -mt-16 mb-4">
            <div class="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-gray-800">
              <img
                src={profile?.picture || `https://robohash.org/${data.pubkey}`}
                alt={profile?.name || profile?.display_name || 'Profile'}
                class="h-full w-full object-cover"
              />
            </div>

            <!-- Edit Button (conditional - only show on own profile) -->
            {#if isOwnProfile}
              <button
                onclick={openEditModal}
                class="absolute top-2 right-2 rounded-full bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
              >
                {m.common_edit()}
              </button>
            {/if}
          </div>

          <!-- Profile Info -->
          <div class="mb-6 text-white">
            <h1 class="mb-2 text-3xl font-bold">
              {profile?.name || profile?.display_name || 'Anonymous User'}
            </h1>

            {#if profile?.display_name && profile.display_name !== profile?.name}
              <p class="mb-3 text-xl text-gray-300">@{profile.display_name}</p>
            {/if}

            <!-- Contact Information -->
            <div class="mb-4 flex flex-wrap items-center gap-4 text-sm">
              {#if profile?.nip05}
                <div class="flex items-center gap-1 text-blue-300">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{profile.nip05}</span>
                </div>
              {/if}

              {#if profile?.website}
                <div class="flex items-center gap-1 text-blue-300">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  <!-- eslint-disable svelte/no-navigation-without-resolve -- external: user website -->
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="transition-colors hover:text-white"
                  >
                    {profile.website}
                  </a>
                  <!-- eslint-enable svelte/no-navigation-without-resolve -->
                </div>
              {/if}

              {#if profile?.lud16}
                <div class="flex items-center gap-1 text-yellow-400">
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>{profile.lud16}</span>
                </div>
              {/if}
            </div>

            <!-- Public Key -->
            <div class="mb-4 flex items-center gap-2">
              <code class="bg-opacity-50 rounded bg-gray-800 px-3 py-1 font-mono text-sm">
                {data.npub
                  ? `${data.npub.slice(0, 16)}...${data.npub.slice(-8)}`
                  : formatPubkey(data.pubkey)}
              </code>
              <button
                onclick={() => copyToClipboard(data.npub || data.pubkey)}
                class="rounded p-1 transition-colors hover:bg-gray-700"
                title={m.profile_copy_pubkey()}
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <button
                class="rounded p-1 transition-colors hover:bg-gray-700"
                title={m.profile_show_qr()}
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
              </button>
            </div>

            <!-- Bio -->
            {#if profile?.about}
              <p class="mb-6 max-w-2xl leading-relaxed text-gray-200">{profile.about}</p>
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
    <div class="min-h-screen bg-gray-900">
      <div class="mx-auto max-w-4xl">
        <!-- Tab Navigation -->
        <div class="flex border-b border-gray-700">
          <button
            class="relative px-6 py-4 font-medium transition-colors {activeTab === 'notes'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-gray-400 hover:text-gray-200'}"
            onclick={() => (activeTab = 'notes')}
          >
            {m.profile_tab_notes()}
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
            <div class="py-12 text-center">
              <div class="mb-4 text-gray-400">
                <svg
                  class="mx-auto mb-4 h-16 w-16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p class="text-lg">{m.profile_no_replies_title()}</p>
                <p class="text-sm">{m.profile_no_replies_description()}</p>
              </div>
            </div>
          {/if}
        </div>

        <!-- Developer Section (Collapsible) -->
        <div class="mt-8 border-t border-gray-700">
          <button
            class="flex w-full items-center justify-between px-6 py-4 text-left text-gray-400 transition-colors hover:text-gray-200"
            onclick={() => (showRawData = !showRawData)}
          >
            <span class="font-medium">{m.profile_developer_info()}</span>
            <svg
              class="h-5 w-5 transform transition-transform {showRawData ? 'rotate-180' : ''}"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {#if showRawData}
            <div class="space-y-6 px-6 pb-6">
              <!-- Basic Information -->
              <div class="rounded-lg bg-gray-800 p-4">
                <h3 class="mb-4 text-lg font-medium text-white">{m.profile_basic_info()}</h3>
                <div class="space-y-3 text-sm">
                  <div class="flex items-center justify-between">
                    <span class="text-gray-400">{m.profile_npub_label()}</span>
                    <code class="rounded bg-gray-700 px-2 py-1 font-mono text-xs text-gray-200">
                      {data.npub || 'N/A'}
                    </code>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-gray-400">{m.profile_hex_pubkey_label()}</span>
                    <code class="rounded bg-gray-700 px-2 py-1 font-mono text-xs text-gray-200">
                      {data.pubkey}
                    </code>
                  </div>
                  {#if profileEvent.created_at}
                    <div class="flex items-center justify-between">
                      <span class="text-gray-400">{m.profile_created_label()}</span>
                      <span class="text-gray-200">
                        {formatCalendarDate(new Date(profileEvent.created_at * 1000), 'short')}
                      </span>
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Raw Profile Data -->
              <div class="rounded-lg bg-gray-800 p-4">
                <h3 class="mb-4 text-lg font-medium text-white">{m.profile_raw_data()}</h3>
                <div class="max-h-96 overflow-y-auto rounded bg-gray-900 p-4">
                  <pre class="font-mono text-xs whitespace-pre-wrap text-gray-300">{JSON.stringify(
                      profile || {},
                      null,
                      2
                    )}</pre>
                </div>
              </div>

              <!-- Raw Nostr Event -->
              <div class="rounded-lg bg-gray-800 p-4">
                <h3 class="mb-4 text-lg font-medium text-white">{m.profile_raw_event()}</h3>
                <div class="max-h-96 overflow-y-auto rounded bg-gray-900 p-4">
                  <pre class="font-mono text-xs whitespace-pre-wrap text-gray-300">{JSON.stringify(
                      profileEvent || {},
                      null,
                      2
                    )}</pre>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
