<script>
	import { getProfilePicture } from 'applesauce-core/helpers';
	import LoginModal from './LoginModal.svelte';
	import LoginWithPrivateKey from './LoginWithPrivateKey.svelte';
	import { useUserProfile } from '$lib/stores/user-profile.svelte';
	import { manager } from '$lib/accounts.svelte';

	const loginModalRef = 'loginModal';
	const privateKeyModalRef = 'privateKeyModal';

	// Modal state management
	let activeModal = $state('none'); // 'none', 'login', 'privateKey'

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

	// Modal transition handlers
	function openLoginModal() {
		activeModal = 'login';
		const modal = /** @type {HTMLDialogElement} */ (document.getElementById(loginModalRef));
		if (modal) modal.showModal();
	}

	function closeLoginModal() {
		activeModal = 'none';
		const modal = /** @type {HTMLDialogElement} */ (document.getElementById(loginModalRef));
		if (modal) modal.close();
	}

	function openPrivateKeyModal() {
		activeModal = 'privateKey';
		const modal = /** @type {HTMLDialogElement} */ (document.getElementById(privateKeyModalRef));
		if (modal) modal.showModal();
	}

	function closePrivateKeyModal() {
		activeModal = 'none';
		const modal = /** @type {HTMLDialogElement} */ (document.getElementById(privateKeyModalRef));
		if (modal) modal.close();
	}

	// Handle NSEC button click from LoginModal
	function handleNSECTransition() {
		closeLoginModal();
		openPrivateKeyModal();
	}

	// Handle successful account creation from LoginWithPrivateKey
	function handleAccountCreated() {
		closePrivateKeyModal();
		openLoginModal();
	}
</script>

<div class="navbar bg-base-100 shadow-sm">
	<div class="flex-1">
		<a href="/" class="btn text-xl btn-ghost">Communikey</a>
	</div>
	<div class="flex gap-2">
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

<LoginModal modalId={loginModalRef} onNSECTransition={handleNSECTransition} />
<LoginWithPrivateKey modalId={privateKeyModalRef} onAccountCreated={handleAccountCreated} />
