<script>
	import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
	import * as nip49 from 'nostr-tools/nip49';
	import CopyIcon from '../icons/actions/CopyIcon.svelte';
	import CheckIcon from '../icons/ui/CheckIcon.svelte';

	let { userData, errors = $bindable({}) } = $props();

	// UI state
	let isGeneratingKeys = $state(false);

	// Generate keypair when component mounts
	$effect(() => {
		if (!userData.privateKey) {
			generateKeypair();
		}
	});

	function generateKeypair() {
		try {
			isGeneratingKeys = true;
			const privateKey = generateSecretKey();
			const publicKey = getPublicKey(privateKey);

			userData.privateKey = privateKey;
			userData.publicKey = publicKey;
			userData.nsec = nip19.nsecEncode(privateKey);
			userData.npub = nip19.npubEncode(publicKey);
		} catch (error) {
			console.error('Error generating keypair:', error);
			errors.keyGeneration = 'Failed to generate keys. Please try again.';
		} finally {
			isGeneratingKeys = false;
		}
	}

	function downloadFile(content, filename, mimeType = 'text/plain') {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function downloadNsec() {
		downloadFile(userData.nsec, 'nostr-private-key.txt');
		userData.downloadConfirmed = true;
	}

	function downloadNcryptsec() {
		if (!userData.ncryptsecPassword) {
			errors.password = 'Please enter a password for encryption';
			return;
		}

		if (!userData.privateKey) {
			errors.password = 'Private key not available';
			return;
		}

		try {
			// Use proper NIP-49 encryption
			const ncryptsec = nip49.encrypt(userData.privateKey, userData.ncryptsecPassword);
			downloadFile(ncryptsec, 'nostr-encrypted-key.txt');
			userData.downloadConfirmed = true;
			errors.password = '';
		} catch (error) {
			console.error('NIP-49 encryption failed:', error);
			errors.password = 'Failed to create encrypted key';
		}
	}

	/**
	 * @param {string} text
	 */
	function copyToClipboard(text) {
		navigator.clipboard.writeText(text).then(() => {
			// Could add a toast notification here
		});
	}
</script>

<div class="space-y-6">
	<div class="prose max-w-none">
		<h3 class="text-lg font-semibold mb-4">
			Your Nostr Keys
		</h3>
		<p class="mb-4">
			Your keypair is identified by a unique string that starts with npub. This is your public profile code you can share with anyone.
		</p>
		<p class="mb-6">
			Then there is the private key. It starts with nsec, and is used to control your profile and to publish notes. This must be kept absolutely secret.
		</p>
		<p class="mb-6 font-semibold text-warning">
			Now please download your nsec (it's a text file) and save it in a safe place, for example your password manager.
		</p>
	</div>

	{#if isGeneratingKeys}
		<div class="flex items-center justify-center py-8">
			<span class="loading loading-spinner loading-lg"></span>
			<span class="ml-2">Generating your keys...</span>
		</div>
	{:else}
		<!-- Public Key Display -->
		<div class="card bg-base-200">
			<div class="card-body">
				<h3 class="card-title text-sm">Your Public Key (npub)</h3>
				<div class="flex items-center gap-2">
					<code class="text-xs break-all flex-1 p-2 bg-base-300 rounded">
						{userData.npub}
					</code>
					<button
						class="btn btn-sm btn-square"
						onclick={() => copyToClipboard(userData.npub)}
					>
						<CopyIcon />
					</button>
				</div>
			</div>
		</div>

		<!-- Private Key Download -->
		<div class="card bg-base-200">
			<div class="card-body">
				<h3 class="card-title text-sm">Download Your Private Key</h3>

				<div class="space-y-4">
					<!-- Plain nsec download -->
					<div>
						<button
							class="btn btn-primary"
							onclick={downloadNsec}
							disabled={userData.downloadConfirmed}
						>
							{#if userData.downloadConfirmed}
								<CheckIcon />
								Downloaded
							{:else}
								Download NSEC
							{/if}
						</button>
					</div>

					<!-- Encrypted option -->
					<div class="divider">OR</div>

					<div class="space-y-2">
						<label class="label">
							<span class="label-text">Create encrypted backup with password:</span>
						</label>
						<div class="flex gap-2">
							<input
								type="password"
								bind:value={userData.ncryptsecPassword}
								placeholder="Enter password for encryption"
								class="input input-bordered flex-1"
								class:input-error={errors.password}
							/>
							<button
								class="btn btn-secondary"
								onclick={downloadNcryptsec}
								disabled={!userData.ncryptsecPassword || userData.downloadConfirmed}
							>
								{#if userData.downloadConfirmed}
									<CheckIcon />
									Downloaded
								{:else}
									Download NCRYPTSEC
								{/if}
							</button>
						</div>
						{#if errors.password}
							<label class="label">
								<span class="label-text-alt text-error">{errors.password}</span>
							</label>
						{/if}
					</div>
				</div>
			</div>
		</div>

		{#if errors.download}
			<div class="alert alert-error">
				<span>{errors.download}</span>
			</div>
		{/if}
	{/if}
</div>
