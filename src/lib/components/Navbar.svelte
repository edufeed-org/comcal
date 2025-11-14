<script>
	import * as m from '$lib/paraglide/messages';
	import { manager } from '$lib/stores/accounts.svelte';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { dev } from '$app/environment';
	import { CalendarIcon, ScrollTextIcon } from './icons';
	import ProfileAvatar from './shared/ProfileAvatar.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import { config } from 'rxjs';
	import { appConfig } from '$lib/config';

	// Use the modal store for opening modals
	const modal = modalStore;

	// Use $state + $effect for reactive RxJS subscription bridge (Svelte 5 pattern)
	let activeAccount = $state(/** @type {any} */ (null));
	let accountCount = $state(0);

	$effect(() => {
		const subscription = manager.active$.subscribe((account) => {
			activeAccount = account;
		});
		return () => subscription.unsubscribe();
	});

	$effect(() => {
		const subscription = manager.accounts$.subscribe((accounts) => {
			accountCount = accounts.length;
		});
		return () => subscription.unsubscribe();
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

		if (confirm(m.navbar_logout_all_confirm())) {
			const accounts = [...manager.accounts];
			accounts.forEach((account) => {
				manager.removeAccount(account.id);
			});
		}

		closeDropdown();
	}
</script>

<div class="navbar bg-base-100 shadow-sm">
	<div class="flex-1">
		<div class="avatar">
			<div class="mask w-10 mask-hexagon-2">
				<img
					src={`${appConfig.logo}`}
					alt="App Logo"
				/>
			</div>
		</div>
		<a href="/" class="btn text-xl btn-ghost">{m.navbar_brand({ appName: appConfig.name })}</a>
	</div>
	<div class="flex items-center gap-2">
		{#if dev}
			<a href="/feed" class="btn btn-ghost">
				<ScrollTextIcon class_="w-5 h-5" />
				{m.navbar_feed()}
			</a>
		{/if}
		<a href="/calendar" class="btn btn-ghost">
			<CalendarIcon class_="w-5 h-5" />
			{m.navbar_calendar()}
		</a>
		{#if activeAccount}
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-circle btn-ghost">
					<ProfileAvatar pubkey={activeAccount.pubkey} size="md" fallbackType="robohash" />
				</div>
				<ul class="dropdown-content menu z-1 mt-3 w-52 menu-sm rounded-box bg-base-100 p-2 shadow">
					<li>
						<a href="/p/{activeAccount.pubkey}" class="justify-between">
							{m.common_profile()}
						</a>
					</li>
					<li>
						<button onclick={openLoginModal}>{m.navbar_switch_account()}</button>
					</li>
					<!-- TODO: Implement settings functionality -->
					<!-- <li><button>{m["common.settings"]()}</button></li> -->
					<li><button onclick={handleLogoutCurrent}>{m.navbar_logout_current()}</button></li>
					{#if accountCount > 1}
						<li><button onclick={handleLogoutAll}>{m.navbar_logout_all()}</button></li>
					{/if}
				</ul>
			</div>
		{:else}
			<button onclick={openLoginModal} class="btn btn-ghost">{m.common_login()}</button>
		{/if}
		<LanguageSwitcher />
	</div>
</div>
