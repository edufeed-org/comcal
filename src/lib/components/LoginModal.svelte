<script>
	let { modalId } = $props();

	import { ExtensionSigner } from 'applesauce-signers';
	import { signer, userProfile } from '$lib/shared.svelte.js';

	import { manager } from '$lib/accounts.svelte';
	import { ExtensionAccount } from 'applesauce-accounts/accounts';
	import AccountProfile from './AccountProfile.svelte';

	let accounts = $state([]);
	manager.accounts$.subscribe((account) => {
		accounts = account;
	});

	async function createSigner(selectedSigner) {
		switch (selectedSigner) {
			case 'Extension':
				signer.signer = new ExtensionSigner();
				const pk = await signer.signer.getPublicKey();
				const account = new ExtensionAccount(pk, signer.signer);
				// FIXME don't add duplicate accounts
				// if (!manager.getAccount(pk)) {
				// }
				manager.addAccount(account);
				manager.setActive(account);

				const modal = /** @type {HTMLDialogElement} */ (document.getElementById(modalId));
				if (modal) modal.close();
			case 'NSEC':
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
			<button disabled onclick={() => createSigner('NSEC')} class="btn join-item">NSEC</button>
			<button disabled onclick={() => createSigner('Bunker')} class="btn join-item">Bunker</button>
		</div>
		<h1 class="mt-4 text-lg font-bold">Don't have an account yet?</h1>
		<button class="btn" disabled>Sign Up!</button>
		<h1>Available Accounts</h1>
		<ul>
			{#each accounts as account}
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
