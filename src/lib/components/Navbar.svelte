<script>
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { useUserProfile } from '$lib/stores/user-profile.svelte';
	import { manager } from '$lib/accounts.svelte';
	import { modalStore } from '$lib/stores/modal.svelte.js';

	// Use the modal store for opening modals
	const modal = modalStore;

	// Use the enhanced hook without pubkey - it will automatically use manager.active
	const getProfile = useUserProfile();

	// Reactive state for active account
	let activeAccount = $state(manager.active);

	// Subscribe to active account changes
	$effect(() => {
		const subscription = manager.active$.subscribe((account) => {
			activeAccount = account;
			console.log('Navbar: Active account changed:', account);
		});
		return () => subscription.unsubscribe();
	});

	// Debug: Log profile changes
	$effect(() => {
		console.log('Navbar: Profile updated:', getProfile());
	});

	/**
	 * Open the login modal using the centralized modal store
	 * Also closes the dropdown menu if it's open
	 */
	function openLoginModal() {
		console.log('Navbar: Opening login modal');
		modal.openModal('login');

		// Close the dropdown by removing focus from the dropdown trigger
		const dropdownTrigger = /** @type {HTMLElement} */ (document.activeElement);
		if (dropdownTrigger && dropdownTrigger.closest('.dropdown')) {
			dropdownTrigger.blur();
		}
	}
</script>

<div class="navbar bg-base-100 shadow-sm ">
	<div class="flex-1">
		<a href="/" class="btn text-xl btn-ghost">Communikey</a>
	</div>
	<div class="flex gap-2 items-center">
		<a href="/calendar" class="btn btn-ghost btn">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
			</svg>
			Calendar
		</a>
		{#if activeAccount}
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn avatar btn-circle btn-ghost">
					<div class="w-10 rounded-full">
						<img alt="" src={getProfilePicture(getProfile()) || `https://robohash.org/${activeAccount.pubkey}`} />
					</div>
				</div>
				<ul class="dropdown-content menu z-1 mt-3 w-52 menu-sm rounded-box bg-base-100 p-2 shadow">
					<li>
						<a href="#" class="justify-between">
							Profile
							<span class="badge">New</span>
						</a>
					</li>
					<li>
						<button onclick={openLoginModal}>Switch Account</button>
					</li>
					<li><a href="#">Settings</a></li>
					<li><a href="#">Logout</a></li>
				</ul>
			</div>
		{:else}
			<button onclick={openLoginModal} class="btn btn-ghost">Login</button>
		{/if}
	</div>
</div>
