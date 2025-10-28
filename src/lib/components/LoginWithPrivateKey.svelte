<script>
	import { manager } from '$lib/stores/accounts.svelte';
	import { SimpleSigner } from 'applesauce-signers';
	import { SimpleAccount } from 'applesauce-accounts/accounts';
	import { nip19 } from 'nostr-tools';
	import * as nip49 from 'nostr-tools/nip49';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import SignupButton from './shared/SignupButton.svelte';

	let { modalId, onAccountCreated } = $props();

	let inputNSEC = $state('');
	let password = $state('');
	let errorMessage = $state('');
	
	// Detect if input is ncryptsec format
	let isNcryptsec = $derived(inputNSEC.trim().startsWith('ncryptsec1'));

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
		errorMessage = '';
		
		try {
			const trimmedInput = inputNSEC.trim();
			
			// Check if it's an encrypted key (ncryptsec)
			if (trimmedInput.startsWith('ncryptsec1')) {
				if (!password) {
					errorMessage = 'Password is required for encrypted keys';
					return;
				}
				
				try {
					// Decrypt the ncryptsec with the provided password
					privateKey = nip49.decrypt(trimmedInput, password);
					console.log('Successfully decrypted ncryptsec');
				} catch (decryptError) {
					console.error('Decryption error:', decryptError);
					errorMessage = 'Failed to decrypt key. Please check your password and try again.';
					return;
				}
			} else {
				// Try to decode as regular nsec
				const decoded = nip19.decode(trimmedInput);
				if (decoded.type !== 'nsec') {
					errorMessage = 'Invalid key format. Please enter a valid nsec or ncryptsec key.';
					return;
				}
				privateKey = decoded.data;
			}
			
			// Create signer and account with the private key
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
			errorMessage = 'Failed to log in. Please check your key and try again.';
		}
	}
</script>

<dialog id={modalId} class="modal">
	<div class="modal-box">
		<h1 class="text-lg font-bold">Add an Account</h1>
		<p class="py-4">Enter your private key (nsec) or encrypted key (ncryptsec)</p>
		
		<div class="space-y-4">
			<!-- Private Key Input -->
			<div class="form-control">
				<label class="label">
					<span class="label-text">Private Key</span>
				</label>
				<input
					bind:value={inputNSEC}
					type="text"
					placeholder="nsec1... or ncryptsec1..."
					class="input input-bordered w-full"
					class:input-error={errorMessage}
				/>
			</div>

			<!-- Password Input (shown only for ncryptsec) -->
			{#if isNcryptsec}
				<div class="form-control">
					<label class="label">
						<span class="label-text">Password</span>
					</label>
					<input
						bind:value={password}
						type="password"
						placeholder="Enter decryption password"
						class="input input-bordered w-full"
						class:input-error={errorMessage}
					/>
					<label class="label">
						<span class="label-text-alt">Encrypted key detected - password required</span>
					</label>
				</div>
			{/if}

			<!-- Error Message -->
			{#if errorMessage}
				<div class="alert alert-error">
					<span>{errorMessage}</span>
				</div>
			{/if}

			<!-- Login Button -->
			<button class="btn btn-primary w-full" onclick={handleLoginWithPrivateKey}>
				Login
			</button>
		</div>

		<div class="divider">OR</div>

		<div class="text-center">
			<h2 class="text-lg font-bold mb-2">Don't have an account yet?</h2>
			<SignupButton class="w-full" />
		</div>
		
		<div class="modal-action">
			<form method="dialog">
				<button class="btn">Close</button>
			</form>
		</div>
	</div>
</dialog>
