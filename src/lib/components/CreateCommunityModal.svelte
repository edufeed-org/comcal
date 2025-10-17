<script>
	import { manager } from '$lib/stores/accounts.svelte';
	import { SimpleSigner } from 'applesauce-signers';
	import { SimpleAccount } from 'applesauce-accounts/accounts';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { publishEvents } from '$lib/helpers/publisher.js';
	import ChevronLeftIcon from './icons/ui/ChevronLeftIcon.svelte';
	import ChevronRightIcon from './icons/ui/ChevronRightIcon.svelte';
	import KeypairGenerator from './shared/KeypairGenerator.svelte';
	import ImageUploader from './shared/ImageUploader.svelte';
	import ProfileForm from './shared/ProfileForm.svelte';

	let { modalId } = $props();

	// Step management - improved flow
	let currentStep = $state(0); // 0 = keypair selection, 1+ = actual steps
	let useCurrentKeypair = $state(false);

	// Dynamic step count based on choice (after keypair selection)
	let totalSteps = $derived(() => {
		if (currentStep === 0) return 0; // No stepper during selection
		return useCurrentKeypair ? 2 : 4; // Current: 2 steps, New: 4 steps
	});

	// Current step display (adjusted for stepper)
	let displayStep = $derived(() => {
		if (currentStep === 0) return 0;
		return useCurrentKeypair ? currentStep : currentStep - 1; // New keypair starts from step 1 after profile
	});

	// User data state for new keypair creation
	let userData = $state({
		name: '',
		about: '',
		picture: '',
		website: '',
		privateKey: /** @type {Uint8Array | null} */ (null),
		publicKey: '',
		nsec: '',
		npub: '',
		downloadConfirmed: false,
		ncryptsecPassword: '',
		useEncryption: false
	});

	// Community data state
	let communityData = $state({
		relays: ['wss://relay.edufeed.org'],
		blossomServers: ['blossom.edufeed.org'],
		contentTypes: {
			calendar: true,
			chat: true,
			articles: true,
			posts: true,
			wikis: true
		}
	});

	// UI state
	let isPublishing = $state(false);
	let errors = $state(/** @type {Record<string, string>} */ ({}));

	/**
	 * @param {number} step
	 */
	function validateStep(step) {
		errors = {};

		// For new keypair flow, validate profile in step 2
		if (!useCurrentKeypair && step === 2) {
			if (!userData.name.trim()) {
				errors.name = 'Name is required';
				return false;
			}
		}

		// For new keypair flow, validate key download in step 3
		if (!useCurrentKeypair && step === 3) {
			if (!userData.downloadConfirmed) {
				errors.download = 'Please download your private key before continuing';
				return false;
			}
		}

		return true;
	}

	// Get step labels based on flow
	function getStepLabels() {
		if (useCurrentKeypair) {
			return ['Metadata', 'Confirm'];
		} else {
			return ['Profile', 'Keys', 'Metadata', 'Confirm'];
		}
	}

	function nextStep() {
		if (!validateStep(currentStep)) return;

		const maxSteps = useCurrentKeypair ? 2 : 4;
		if (currentStep < maxSteps) {
			currentStep++;
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
		}
	}

	function selectCurrentKeypair() {
		useCurrentKeypair = true;
		nextStep();
	}

	function selectNewKeypair() {
		useCurrentKeypair = false;
		nextStep();
	}

	async function createCommunity() {
		try {
			isPublishing = true;

			// Determine which account to use
			let account = manager.active;
			let signer = account?.signer;

			if (!useCurrentKeypair) {
				// Create new account for the community
				if (!userData.privateKey) {
					throw new Error('Private key not available');
				}
				signer = new SimpleSigner(userData.privateKey);
				account = new SimpleAccount(userData.publicKey, signer);

				// Add account to manager
				if (!manager.getAccountForPubkey(userData.publicKey)) {
					manager.addAccount(account);
					manager.setActive(account);
				}
			}

			if (!account || !signer) {
				throw new Error('No account available for community creation');
			}

			// Create community creation event (kind:10222)
			const communityTags = [];

			// Add relays
			communityData.relays.forEach(relay => {
				communityTags.push(['r', relay]);
			});

			// Add blossom servers
			communityData.blossomServers.forEach(server => {
				communityTags.push(['blossom', server]);
			});

			// Add content types
			if (communityData.contentTypes.calendar) {
				communityTags.push(['content', 'Calendar']);
				communityTags.push(['k', '31922']); // Date-Based Calendar Event
				communityTags.push(['k', '31923']); // Time-Based Calendar Event
			}

			if (communityData.contentTypes.chat) {
				communityTags.push(['content', 'Chat']);
				communityTags.push(['k', '9']); // Chat Message
			}

			if (communityData.contentTypes.articles) {
				communityTags.push(['content', 'Articles']);
				communityTags.push(['k', '30023']); // Long-form Content
				communityTags.push(['k', '30040']); // Curated Publication Content
			}

			if (communityData.contentTypes.posts) {
				communityTags.push(['content', 'Posts']);
				communityTags.push(['k', '1']); // Short Text Note
				communityTags.push(['k', '11']); // Thread
			}

			if (communityData.contentTypes.wikis) {
				communityTags.push(['content', 'Wikis']);
				communityTags.push(['k', '30818']); // Wiki article
			}

			const communityEvent = {
				kind: 10222,
				created_at: Math.floor(Date.now() / 1000),
				tags: communityTags,
				content: '',
				pubkey: account.pubkey
			};

			// Sign the community event
			const signedCommunityEvent = await signer.signEvent(communityEvent);

			// Create relationship event (kind:30382)
			const relationshipEvent = {
				kind: 30382,
				created_at: Math.floor(Date.now() / 1000),
				tags: [
					['d', account.pubkey],
					['n', 'follow']
				],
				content: '',
				pubkey: account.pubkey
			};

			// Sign the relationship event
			const signedRelationshipEvent = await signer.signEvent(relationshipEvent);

			// Publish both events
			const eventsToPublish = [signedCommunityEvent, signedRelationshipEvent];
			const publishResult = await publishEvents(eventsToPublish, {
				logPrefix: 'CreateCommunityModal'
			});

			if (publishResult.success) {
				console.log('CreateCommunityModal: Successfully created community');

				// Close modal and show success
				closeModal();
			} else {
				throw new Error('Failed to publish community to any relay');
			}

		} catch (error) {
			console.error('Error creating community:', error);
			errors.publishing = 'Failed to create community. Please try again.';
		} finally {
			isPublishing = false;
		}
	}

	function closeModal() {
		modalStore.closeModal();
		// Reset state
		currentStep = 0;
		useCurrentKeypair = false;
		userData = {
			name: '', about: '', picture: '', website: '',
			privateKey: /** @type {Uint8Array | null} */ (null), publicKey: '', nsec: '', npub: '',
			downloadConfirmed: false, ncryptsecPassword: '', useEncryption: false
		};
		communityData = {
			relays: ['wss://relay.edufeed.org'],
			blossomServers: ['blossom.edufeed.org'],
			contentTypes: {
				calendar: true, chat: true, articles: true, posts: true, wikis: true
			}
		};
		errors = {};
	}
</script>

<dialog id={modalId} class="modal">
	<div class="modal-box max-w-2xl">
		<!-- Header with steps -->
		<div class="mb-6">
			<h1 class="text-2xl font-bold mb-4">Create New Community</h1>

			<!-- Step indicator - only show after keypair selection -->
			{#if currentStep > 0}
				<ul class="steps w-full">
					{#each getStepLabels() as label, index}
						<li class="step {displayStep() > index ? 'step-primary' : ''}">{label}</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Step content -->
		<div class="min-h-96">
			{#if currentStep === 0}
				<!-- Keypair Selection Step -->
				<div class="space-y-4">
					<h2 class="text-xl font-semibold mb-4">Choose Keypair for Community</h2>

					<div class="space-y-4">
						<!-- Use Current Keypair Option -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">Use Current Keypair</h3>
								<p class="text-sm opacity-70">
									Create the community using your currently active account. No additional signup required.
								</p>
								<div class="card-actions justify-end mt-4">
									<button
										class="btn btn-primary"
										onclick={selectCurrentKeypair}
									>
										Use Current Keypair
									</button>
								</div>
							</div>
						</div>

						<!-- Create New Keypair Option -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">Create New Keypair</h3>
								<p class="text-sm opacity-70">
									Generate a new keypair specifically for this community. You'll need to create a profile and download keys.
								</p>
								<div class="card-actions justify-end mt-4">
									<button class="btn btn-secondary" onclick={selectNewKeypair}>
										Create New Keypair
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>

			{:else if currentStep === 1 && useCurrentKeypair}
				<!-- Community Metadata for Current Keypair -->
				<div class="space-y-6">
					<h2 class="text-xl font-semibold mb-4">Community Information</h2>

					<!-- Community Name -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Community Name *</span>
						</label>
						<input
							type="text"
							bind:value={userData.name}
							placeholder="Community name"
							class="input input-bordered w-full"
							class:input-error={errors.name}
						/>
						{#if errors.name}
							<label class="label">
								<span class="label-text-alt text-error">{errors.name}</span>
							</label>
						{/if}
					</div>

					<!-- Community Description -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Description</span>
						</label>
						<textarea
							bind:value={userData.about}
							placeholder="Describe your community"
							class="textarea textarea-bordered h-24"
						></textarea>
					</div>

					<!-- Community Avatar -->
					<ImageUploader {userData} {errors} />

					<!-- Content Types -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Content Types</span>
						</label>
						<div class="grid grid-cols-2 gap-4">
							<label class="label cursor-pointer">
								<span class="label-text">Calendar</span>
								<input
									type="checkbox"
									bind:checked={communityData.contentTypes.calendar}
									class="checkbox checkbox-primary"
								/>
							</label>
							<label class="label cursor-pointer">
								<span class="label-text">Chat</span>
								<input
									type="checkbox"
									bind:checked={communityData.contentTypes.chat}
									class="checkbox checkbox-primary"
								/>
							</label>
							<label class="label cursor-pointer">
								<span class="label-text">Articles</span>
								<input
									type="checkbox"
									bind:checked={communityData.contentTypes.articles}
									class="checkbox checkbox-primary"
								/>
							</label>
							<label class="label cursor-pointer">
								<span class="label-text">Posts</span>
								<input
									type="checkbox"
									bind:checked={communityData.contentTypes.posts}
									class="checkbox checkbox-primary"
								/>
							</label>
							<label class="label cursor-pointer">
								<span class="label-text">Wikis</span>
								<input
									type="checkbox"
									bind:checked={communityData.contentTypes.wikis}
									class="checkbox checkbox-primary"
								/>
							</label>
						</div>
					</div>
				</div>

			{:else if currentStep === 2 && useCurrentKeypair}
				<!-- Confirmation for Current Keypair -->
				<div class="space-y-6">
					<h2 class="text-xl font-semibold mb-4">Confirm Community Creation</h2>

					<div class="space-y-4">
						<!-- Community Info -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">Community Details</h3>
								<div class="space-y-2">
									<p><strong>Name:</strong> {userData.name}</p>
									<p><strong>Description:</strong> {userData.about || 'No description'}</p>
									<p><strong>Public Key:</strong> <code class="text-xs">{manager.active?.pubkey.slice(0, 16)}...</code></p>
								</div>
							</div>
						</div>

						<!-- Content Types -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">Content Types</h3>
								<div class="flex flex-wrap gap-2">
									{#if communityData.contentTypes.calendar}
										<span class="badge badge-primary">Calendar</span>
									{/if}
									{#if communityData.contentTypes.chat}
										<span class="badge badge-primary">Chat</span>
									{/if}
									{#if communityData.contentTypes.articles}
										<span class="badge badge-primary">Articles</span>
									{/if}
									{#if communityData.contentTypes.posts}
										<span class="badge badge-primary">Posts</span>
									{/if}
									{#if communityData.contentTypes.wikis}
										<span class="badge badge-primary">Wikis</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</div>

			{:else if currentStep === 1 && !useCurrentKeypair}
				<!-- Profile Creation for New Keypair -->
				<div class="space-y-6">
					<div class="prose max-w-none">
						<h2 class="text-xl font-semibold mb-4">
							Create Profile for {userData.name || 'Your Community'}
						</h2>
						<p class="mb-4">
							Your community needs its own Nostr profile. This will be the identity that manages the community.
						</p>
					</div>

					<ImageUploader {userData} {errors} />

					<ProfileForm {userData} {errors} />
				</div>

			{:else if currentStep === 2 && !useCurrentKeypair}
				<!-- Keys Generation for New Keypair -->
				<KeypairGenerator {userData} {errors} />

			{:else if currentStep === 3 && !useCurrentKeypair}
				<!-- Community Metadata for New Keypair -->
				<div class="space-y-6">
					<h2 class="text-xl font-semibold mb-4">Community Information</h2>

					<!-- Content Types -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Content Types</span>
						</label>
						<div class="grid grid-cols-2 gap-4">
							<label class="label cursor-pointer">
								<span class="label-text">Calendar</span>
								<input
									type="checkbox"
									bind:checked={communityData.contentTypes.calendar}
									class="checkbox checkbox-primary"
								/>
							</label>
							<label class="label cursor-pointer">
								<span class="label-text">Chat</span>
								<input
									type="checkbox"
									bind:checked={communityData.contentTypes.chat}
									class="checkbox checkbox-primary"
								/>
							</label>
							<label class="label cursor-pointer">
								<span class="label-text">Articles</span>
								<input
									type="checkbox"
									bind:checked={communityData.contentTypes.articles}
									class="checkbox checkbox-primary"
								/>
							</label>
							<label class="label cursor-pointer">
								<span class="label-text">Posts</span>
								<input
									type="checkbox"
									bind:checked={communityData.contentTypes.posts}
									class="checkbox checkbox-primary"
								/>
							</label>
							<label class="label cursor-pointer">
								<span class="label-text">Wikis</span>
								<input
									type="checkbox"
									bind:checked={communityData.contentTypes.wikis}
									class="checkbox checkbox-primary"
								/>
							</label>
						</div>
					</div>
				</div>

			{:else if currentStep === 4 && !useCurrentKeypair}
				<!-- Confirmation for New Keypair -->
				<div class="space-y-6">
					<h2 class="text-xl font-semibold mb-4">Confirm Community Creation</h2>

					<div class="space-y-4">
						<!-- Community Info -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">Community Details</h3>
								<div class="space-y-2">
									<p><strong>Name:</strong> {userData.name}</p>
									<p><strong>Description:</strong> {userData.about || 'No description'}</p>
									<p><strong>Public Key:</strong> <code class="text-xs">{userData.npub.slice(0, 16)}...</code></p>
								</div>
							</div>
						</div>

						<!-- Content Types -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">Content Types</h3>
								<div class="flex flex-wrap gap-2">
									{#if communityData.contentTypes.calendar}
										<span class="badge badge-primary">Calendar</span>
									{/if}
									{#if communityData.contentTypes.chat}
										<span class="badge badge-primary">Chat</span>
									{/if}
									{#if communityData.contentTypes.articles}
										<span class="badge badge-primary">Articles</span>
									{/if}
									{#if communityData.contentTypes.posts}
										<span class="badge badge-primary">Posts</span>
									{/if}
									{#if communityData.contentTypes.wikis}
										<span class="badge badge-primary">Wikis</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</div>

			{:else}
				<!-- Fallback -->
				<div class="alert alert-error">
					<span>Invalid state reached. Please start over.</span>
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

					{#if currentStep < totalSteps()}
						<button class="btn btn-primary" onclick={nextStep}>
							Next
							<ChevronRightIcon />
						</button>
					{:else}
						<button
							class="btn btn-primary"
							onclick={createCommunity}
							disabled={isPublishing}
						>
							{#if isPublishing}
								<span class="loading loading-spinner loading-sm"></span>
								Creating Community...
							{:else}
								Create Community
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
