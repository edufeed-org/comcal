<!--
  ProfileAvatar Component
  Displays user avatar with fallback options
  Can load profile internally or accept it as a prop
-->

<script>
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
	import { getProfilePicture, getDisplayName } from 'applesauce-core/helpers';

	/**
	 * @typedef {Object} Props
	 * @property {string} [pubkey] - User pubkey (optional - if not provided, uses active user)
	 * @property {any} [profile] - Profile object (optional - if not provided, loads internally)
	 * @property {'xs' | 'sm' | 'md' | 'lg' | 'xl'} [size] - Avatar size
	 * @property {'initial' | 'robohash'} [fallbackType] - Type of fallback to use
	 * @property {string} [class] - Additional CSS classes
	 */

	/** @type {Props} */
	let {
		pubkey = undefined,
		profile = undefined,
		size = 'md',
		fallbackType = 'initial',
		class: className = ''
	} = $props();

	// Load profile if not provided as prop
	const getProfile = useUserProfile(pubkey);
	let loadedProfile = $derived(profile || getProfile());

	// Size mappings
	const sizeClasses = {
		xs: 'w-6',
		sm: 'w-8',
		md: 'w-10',
		lg: 'w-12',
		xl: 'w-16'
	};

	// Get avatar URL
	let avatarUrl = $derived(getProfilePicture(loadedProfile));

	// Get display name for fallback
	let displayName = $derived(getDisplayName(loadedProfile));

	// Get fallback content
	let fallbackContent = $derived.by(() => {
		if (fallbackType === 'robohash' && pubkey) {
			return `https://robohash.org/${pubkey}`;
		}
		// Use initial letter fallback
		return displayName?.charAt(0).toUpperCase() || '?';
	});

	let showInitialFallback = $derived(fallbackType === 'initial' && !avatarUrl);
	let showRobohashFallback = $derived(fallbackType === 'robohash' && !avatarUrl);
</script>

<div class="avatar {className}">
	<div class="{sizeClasses[size]} rounded-full">
		{#if avatarUrl}
			<img src={avatarUrl} alt={displayName || 'User avatar'} />
		{:else if showRobohashFallback}
			<img src={fallbackContent} alt={displayName || 'User avatar'} />
		{:else if showInitialFallback}
			<div
				class="flex h-full w-full items-center justify-center bg-primary text-sm font-semibold text-primary-content"
			>
				{fallbackContent}
			</div>
		{/if}
	</div>
</div>
