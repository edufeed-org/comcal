<script>
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { useUserProfile } from '$lib/stores/user-profile.svelte';
	import { manager } from '$lib/stores/accounts.svelte';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { CalendarIcon } from './icons';

	// Use the modal store for opening modals
	const modal = modalStore;

	// Use $state + $effect for reactive RxJS subscription bridge (Svelte 5 pattern)
	let activeAccount = $state(/** @type {any} */ (null));
	let accountCount = $state(0);

	$effect(() => {
		const subscription = manager.active$.subscribe((account) => {
			activeAccount = account;
			console.log('Navbar: Active account changed:', account);
		});
		return () => subscription.unsubscribe();
	});

	$effect(() => {
		const subscription = manager.accounts$.subscribe((accounts) => {
			accountCount = accounts.length;
			console.log('Navbar: Account count changed:', accountCount);
		});
		return () => subscription.unsubscribe();
	});

	// Use the enhanced hook without pubkey - it will automatically use manager.active
	const getProfile = useUserProfile();

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

	/**
	 * Helper to close the dropdown menu
	 */
	function closeDropdown() {
		const dropdownTrigger = /** @type {HTMLElement} */ (document.activeElement);
		if (dropdownTrigger && dropdownTrigger.closest('.dropdown')) {
			dropdownTrigger.blur();
		}
	}

	/**
	 * Logout the current active account only
	 */
	function handleLogoutCurrent() {
		console.log('Navbar: Logging out current account');
		
		if (activeAccount) {
			manager.removeAccount(activeAccount.id);
		}
		
		closeDropdown();
	}

	/**
	 * Logout all accounts
	 */
	function handleLogoutAll() {
		console.log('Navbar: Logging out all accounts');
		
		if (confirm('Are you sure you want to logout all accounts?')) {
			const accounts = [...manager.accounts];
			accounts.forEach(account => {
				manager.removeAccount(account.id);
			});
		}
		
		closeDropdown();
	}
</script>

<div class="navbar bg-base-100 shadow-sm ">
	<div class="flex-1">
		<a href="/" class="btn text-xl btn-ghost">Communikey</a>
	</div>
	<div class="flex gap-2 items-center">
		<a href="/calendar" class="btn btn-ghost btn">
			<CalendarIcon class_="w-5 h-5" />
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
						<a href="/p/{activeAccount.pubkey}" class="justify-between">
							Profile
						</a>
					</li>
					<li>
						<button onclick={openLoginModal}>Switch Account</button>
					</li>
					<!-- TODO: Implement settings functionality -->
					<!-- <li><button>Settings</button></li> -->
					<li><button onclick={handleLogoutCurrent}>Logout</button></li>
					{#if accountCount > 1}
						<li><button onclick={handleLogoutAll}>Logout All Accounts</button></li>
					{/if}
				</ul>
			</div>
		{:else}
			<button onclick={openLoginModal} class="btn btn-ghost">Login</button>
		{/if}
	</div>
</div>
