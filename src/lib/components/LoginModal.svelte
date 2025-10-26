<script>
	let { modalId, onNSECTransition } = $props();

	import { ExtensionSigner } from 'applesauce-signers';
	import { signer } from '$lib/stores/accounts.svelte';

	import { manager } from '$lib/stores/accounts.svelte';
	import { ExtensionAccount } from 'applesauce-accounts/accounts';
	import AccountProfile from './AccountProfile.svelte';
	import { useAccounts } from '$lib/stores/accounts.svelte.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';

	import LoginWithPrivateKey from './LoginWithPrivateKey.svelte';

	const getAccounts = useAccounts();

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
			if (modalStore.activeModal === 'login') {
				console.log('LoginModal: Dialog closed, syncing with store');
				modalStore.closeModal();
			}
		};

		dialog.addEventListener('close', handleDialogClose);
		return () => {
			dialog.removeEventListener('close', handleDialogClose);
		};
	});

	function closeModal() {
		const modal = /** @type {HTMLDialogElement} */ (document.getElementById(modalId));
		if (modal) modal.close();
	}

	async function createSigner(selectedSigner) {
		switch (selectedSigner) {
			case 'Extension':
				signer.signer = new ExtensionSigner();
				const pk = await signer.signer.getPublicKey();
				const account = new ExtensionAccount(pk, signer.signer);

				if (!manager.getAccountForPubkey(pk)) {
					manager.addAccount(account);
					manager.setActive(account);
				}

				modalStore.closeModal();
				break;
			case 'NSEC':
				if (onNSECTransition) {
					onNSECTransition();
				}
				return null;
			case 'Bunker':
				return null;
			default:
				throw new Error('Unknown signer');
		}
	}
</script>

<dialog id={modalId} class="modal">
	<div class="modal-box">
		<h1 class="text-lg font-bold">Add an Account</h1>
		<p class="py-4">Press ESC key or click the button below to close</p>
		<div class="join flex flex-col">
			<button onclick={() => createSigner('Extension')} class="btn join-item">Extension</button>
			<button onclick={() => createSigner('NSEC')} class="btn join-item">NSEC</button>
			<button disabled onclick={() => createSigner('Bunker')} class="btn join-item">Bunker</button>
		</div>
		<h1 class="mt-4 text-lg font-bold">Don't have an account yet?</h1>
		<button class="btn btn-primary" onclick={() => modalStore.openModal('signup')}>Sign Up!</button>
		<h1>Available Accounts</h1>
		<ul>
			{#each getAccounts() as account}
				<AccountProfile {account} />
			{/each}
		</ul>
		<div class="modal-action">
			<form method="dialog">
				<!-- if there is a button in form, it will close the modal -->
				<button class="btn">Close</button>
			</form>
		</div>
	</div>
</dialog>
