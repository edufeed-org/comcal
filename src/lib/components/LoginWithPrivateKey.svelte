<script>
	import { manager } from '$lib/stores/accounts.svelte';
	import { SimpleSigner } from 'applesauce-signers';
	import { SimpleAccount } from 'applesauce-accounts/accounts';
	import { nip19 } from 'nostr-tools';
	import { modalStore } from '$lib/stores/modal.svelte.js';

	let { modalId, onAccountCreated } = $props();

	let inputNSEC = $state('');

	/**
	 * Sync modal close with store state
	 * This effect ensures that when the dialog closes (via ESC, backdrop, etc.),
	 * the modal store state is updated accordingly
	 */
	$effect(() => {
		const dialog = /** @type {HTMLDialogElement} */ (document.getElementById(modalId));
		if (!dialog) return;

		const handleDialogClose = () => {
			// Only update store if this modal is currently active
			if (modalStore.activeModal === 'privateKey') {
				console.log('LoginWithPrivateKey: Dialog closed, syncing with store');
				modalStore.closeModal();
			}
		};

		dialog.addEventListener('close', handleDialogClose);
		return () => {
			dialog.removeEventListener('close', handleDialogClose);
		};
	});

	async function handleLoginWithPrivateKey() {
		let privateKey;
		try {
			const decoded = nip19.decode(inputNSEC);
			if (decoded.type !== 'nsec') throw new Error('Invalid nsec');
			
      privateKey = decoded.data;
			const simpleSigner = new SimpleSigner(privateKey);
			const pk = await simpleSigner.getPublicKey();
      console.log('Public Key:', pk);
			const account = new SimpleAccount(pk, simpleSigner);

			if (!manager.getAccountForPubkey(pk)) {
				manager.addAccount(account);
				manager.setActive(account);
				console.log('LoginWithPrivateKey: New account created and set active:', account);
			} else {
				manager.setActive(account);
				console.log('LoginWithPrivateKey: Existing account set active:', account);
			}

			console.log('LoginWithPrivateKey: Current active account:', manager.active);
			console.log('LoginWithPrivateKey: All accounts:', manager.accounts);

			// Call the callback to notify parent component of successful account creation
			if (onAccountCreated) {
				onAccountCreated();
			}

			const modal = /** @type {HTMLDialogElement} */ (document.getElementById(modalId));
			if (modal) modal.close();
		} catch (error) {
			console.error('Error logging in with private key:', error);
			alert('Failed to log in. Please check your private key and try again.');
		}
	}
</script>

<dialog id={modalId} class="modal">
	<div class="modal-box">
		<h1 class="text-lg font-bold">Add an Account</h1>
		<p class="py-4">Press ESC key or click the button below to close</p>
		<div class="join flex flex-col">
			<input
				bind:value={inputNSEC}
				type="text"
				placeholder="Enter your NSEC"
				class="input-bordered input join-item w-full"
			/>
			<button class="btn join-item" onclick={handleLoginWithPrivateKey}>Login</button>
		</div>
		<h1 class="mt-4 text-lg font-bold">Don't have an account yet?</h1>
		<button class="btn btn-primary" onclick={() => modalStore.openModal('signup')}>Sign Up!</button>
		
		<div class="modal-action">
			<form method="dialog">
				<!-- if there is a button in form, it will close the modal -->
				<button class="btn">Close</button>
			</form>
		</div>
	</div>
</dialog>
