<script>
	import { manager } from '$lib/accounts.svelte';
	import { SimpleSigner } from 'applesauce-signers';
	import { SimpleAccount } from 'applesauce-accounts/accounts';
	import { nip19, generateSecretKey, getPublicKey } from 'nostr-tools';
	import * as nip49 from 'nostr-tools/nip49';
	import { appConfig } from '$lib/config.js';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { publishEvents } from '$lib/helpers/publisher.js';
	import CopyIcon from './icons/actions/CopyIcon.svelte';
	import CheckIcon from './icons/ui/CheckIcon.svelte';
	import ChevronLeftIcon from './icons/ui/ChevronLeftIcon.svelte';
	import ChevronRightIcon from './icons/ui/ChevronRightIcon.svelte';

	let { modalId } = $props();

	// Step management
	let currentStep = $state(1);
	const totalSteps = 4;

	// User data state
	let userData = $state({
		name: '',
		about: '',
		picture: '',
		website: '',
		privateKey: null,
		publicKey: '',
		nsec: '',
		npub: '',
		selectedFollows: [],
		downloadConfirmed: false,
		ncryptsecPassword: '',
		useEncryption: false
	});

	// UI state
	let isGeneratingKeys = $state(false);
	let isPublishing = $state(false);
	let uploadingImage = $state(false);
	let imageFile = $state(null);
	let errors = $state({});

	// Generate keypair when entering step 3
	$effect(() => {
		if (currentStep === 3 && !userData.privateKey) {
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

	async function uploadImageToBlossom(file) {
		const formData = new FormData();
		formData.append('file', file);

		// Try nstart.me first, fallback to blossom.primal.net
		const endpoints = [
			'https://nstart.me/a/step-end',
			'https://blossom.primal.net/upload'
		];

		for (const endpoint of endpoints) {
			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					body: formData
				});

				if (response.ok) {
					const result = await response.json();
					return result.url || result.data?.url;
				}
			} catch (error) {
				console.warn(`Failed to upload to ${endpoint}:`, error);
			}
		}

		throw new Error('Failed to upload image to any Blossom service');
	}

	async function handleImageUpload(event) {
		const file = event.target.files[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			errors.image = 'Please select a valid image file';
			return;
		}

		if (file.size > 5 * 1024 * 1024) { // 5MB limit
			errors.image = 'Image must be smaller than 5MB';
			return;
		}

		try {
			uploadingImage = true;
			errors.image = '';
			imageFile = file;
			
			const imageUrl = await uploadImageToBlossom(file);
			userData.picture = imageUrl;
		} catch (error) {
			console.error('Image upload failed:', error);
			errors.image = 'Failed to upload image. Please try again.';
		} finally {
			uploadingImage = false;
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

	function toggleFollowUser(user) {
		const index = userData.selectedFollows.findIndex(u => u.npub === user.npub);
		if (index >= 0) {
			userData.selectedFollows.splice(index, 1);
		} else {
			userData.selectedFollows.push(user);
		}
	}

	function copyToClipboard(text) {
		navigator.clipboard.writeText(text).then(() => {
			// Could add a toast notification here
		});
	}

	function validateStep(step) {
		errors = {};
		
		switch (step) {
			case 2:
				if (!userData.name.trim()) {
					errors.name = 'Name is required';
					return false;
				}
				break;
			case 3:
				if (!userData.downloadConfirmed) {
					errors.download = 'Please download your private key before continuing';
					return false;
				}
				break;
		}
		return true;
	}

	function nextStep() {
		if (!validateStep(currentStep)) return;
		
		if (currentStep < totalSteps) {
			currentStep++;
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
		}
	}

	async function publishProfile() {
		try {
			isPublishing = true;
			
			// Create signer and account
			const signer = new SimpleSigner(userData.privateKey);
			const account = new SimpleAccount(userData.publicKey, signer);

			// Create metadata event (Kind 0)
			const metadata = {
				name: userData.name,
				about: userData.about,
				picture: userData.picture,
				website: userData.website
			};

			const metadataEvent = {
				kind: 0,
				created_at: Math.floor(Date.now() / 1000),
				tags: [],
				content: JSON.stringify(metadata),
				pubkey: userData.publicKey
			};

			// Sign the event
			const signedMetadataEvent = await signer.signEvent(metadataEvent);

			// Create contacts event (Kind 3) if users selected
			let signedContactsEvent = null;
			if (userData.selectedFollows.length > 0) {
				const contactTags = userData.selectedFollows.map(user => {
					const decoded = nip19.decode(user.npub);
					return ['p', decoded.data];
				});

				const contactsEvent = {
					kind: 3,
					created_at: Math.floor(Date.now() / 1000),
					tags: contactTags,
					content: '',
					pubkey: userData.publicKey
				};

				signedContactsEvent = await signer.signEvent(contactsEvent);
			}

			// Prepare events to publish
			const eventsToPublish = [signedMetadataEvent];
			if (signedContactsEvent) {
				eventsToPublish.push(signedContactsEvent);
			}

			// Publish events to relays using the generic publisher
			const publishResult = await publishEvents(eventsToPublish, {
				logPrefix: 'SignupModal'
			});

			if (publishResult.success) {
				// Add account to manager after successful publishing
				if (!manager.getAccountForPubkey(userData.publicKey)) {
					manager.addAccount(account);
					manager.setActive(account);
				}

				console.log('SignupModal: Successfully published profile events');
				
				// Close modal and show success
				closeModal();
			} else {
				throw new Error('Failed to publish profile to any relay');
			}
			
		} catch (error) {
			console.error('Error publishing profile:', error);
			errors.publishing = 'Failed to create account. Please try again.';
		} finally {
			isPublishing = false;
		}
	}

	function closeModal() {
		modalStore.closeModal();
		// Reset state
		currentStep = 1;
		userData = {
			name: '', about: '', picture: '', website: '',
			privateKey: null, publicKey: null, nsec: '', npub: '',
			selectedFollows: [], downloadConfirmed: false,
			ncryptsecPassword: '', useEncryption: false
		};
		errors = {};
	}
</script>

<dialog id={modalId} class="modal">
	<div class="modal-box max-w-2xl">
		<!-- Header with steps -->
		<div class="mb-6">
			<h1 class="text-2xl font-bold mb-4">Join Nostr</h1>
			
			<!-- Step indicator -->
			<ul class="steps w-full">
				<li class="step {currentStep >= 1 ? 'step-primary' : ''}">Introduction</li>
				<li class="step {currentStep >= 2 ? 'step-primary' : ''}">Profile</li>
				<li class="step {currentStep >= 3 ? 'step-primary' : ''}">Keys</li>
				<li class="step {currentStep >= 4 ? 'step-primary' : ''}">Follow</li>
			</ul>
		</div>

		<!-- Step content -->
		<div class="min-h-96">
			{#if currentStep === 1}
				<!-- Introduction Step -->
				<div class="prose max-w-none">
					<p class="text-lg mb-4">
						To join Nostr you need a profile, but it is not the usual one that a company generates and manages for you. You create it yourself, no permissions are required.
					</p>
					<p class="mb-4">
						Nostr is a different experience from the beginning: because there is no central authority taking care of who is who, each user is identified by a cryptographic keypair; don't worry about the tech slang, it is just a strong password that you will have to keep safe.
					</p>
					<p class="mb-6">
						This wizard is used by Jumble to let you create your new profile and safely manage it, in a few steps.
					</p>
				</div>

			{:else if currentStep === 2}
				<!-- Profile Creation Step -->
				<div class="space-y-4">
					<h2 class="text-xl font-semibold mb-4">Create Your Profile</h2>
					
					<!-- Avatar Upload -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Profile Picture</span>
						</label>
						<div class="flex items-center gap-4">
							{#if userData.picture}
								<div class="avatar">
									<div class="w-16 rounded-full">
										<img src={userData.picture} alt="Profile" />
									</div>
								</div>
							{/if}
							<input
								type="file"
								accept="image/*"
								class="file-input file-input-bordered w-full max-w-xs"
								onchange={handleImageUpload}
								disabled={uploadingImage}
							/>
							{#if uploadingImage}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
						</div>
						{#if errors.image}
							<label class="label">
								<span class="label-text-alt text-error">{errors.image}</span>
							</label>
						{/if}
					</div>

					<!-- Name -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Name *</span>
						</label>
						<input
							type="text"
							bind:value={userData.name}
							placeholder="Your name or nickname"
							class="input input-bordered w-full"
							class:input-error={errors.name}
						/>
						{#if errors.name}
							<label class="label">
								<span class="label-text-alt text-error">{errors.name}</span>
							</label>
						{/if}
					</div>

					<!-- About -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">About</span>
						</label>
						<textarea
							bind:value={userData.about}
							placeholder="Tell us something about yourself"
							class="textarea textarea-bordered h-24"
						></textarea>
					</div>

					<!-- Website -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Website</span>
						</label>
						<input
							type="url"
							bind:value={userData.website}
							placeholder="https://your-website.com"
							class="input input-bordered w-full"
						/>
					</div>
				</div>

			{:else if currentStep === 3}
				<!-- Keys Management Step -->
				<div class="space-y-6">
					<div class="prose max-w-none">
						<h2 class="text-xl font-semibold mb-4">
							Well done {userData.name}, your Nostr profile is ready! Yes, it was that easy.
						</h2>
						<p class="mb-4">
							On Nostr your keypair is identified by a unique string that starts with npub. This is your public profile code you can share with anyone.
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

			{:else if currentStep === 4}
				<!-- Follow Suggestions Step -->
				<div class="space-y-4">
					<h2 class="text-xl font-semibold mb-4">Follow Some Interesting People</h2>
					<p class="text-sm opacity-70 mb-6">
						Here are some suggested users to follow. You can skip this step if you prefer.
					</p>

					<div class="space-y-3">
						{#each appConfig.signup.suggestedUsers as user}
							<div class="card bg-base-200">
								<div class="card-body p-4">
									<div class="flex items-center gap-4">
										<div class="avatar">
											<div class="w-12 rounded-full">
												<img src={user.picture} alt={user.name} />
											</div>
										</div>
										<div class="flex-1">
											<h3 class="font-semibold">{user.name}</h3>
											<p class="text-sm opacity-70">{user.about}</p>
										</div>
										<input
											type="checkbox"
											class="checkbox checkbox-primary"
											checked={userData.selectedFollows.some(u => u.npub === user.npub)}
											onchange={() => toggleFollowUser(user)}
										/>
									</div>
								</div>
							</div>
						{/each}
					</div>

					{#if userData.selectedFollows.length > 0}
						<div class="alert alert-info">
							<span>You've selected {userData.selectedFollows.length} user{userData.selectedFollows.length === 1 ? '' : 's'} to follow.</span>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Navigation -->
		<div class="modal-action">
			<div class="flex justify-between w-full">
				<div>
					{#if currentStep > 1}
						<button class="btn btn-ghost" onclick={prevStep}>
							<ChevronLeftIcon />
							Back
						</button>
					{/if}
				</div>

				<div class="flex gap-2">
					<form method="dialog">
						<button class="btn">Cancel</button>
					</form>

					{#if currentStep < totalSteps}
						<button class="btn btn-primary" onclick={nextStep}>
							Next
							<ChevronRightIcon />
						</button>
					{:else}
						<button
							class="btn btn-primary"
							onclick={publishProfile}
							disabled={isPublishing}
						>
							{#if isPublishing}
								<span class="loading loading-spinner loading-sm"></span>
								Creating Account...
							{:else}
								Finish & Create Account
							{/if}
						</button>
					{/if}

					{#if errors.publishing}
						<div class="alert alert-error mt-4">
							<span>{errors.publishing}</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</dialog>
