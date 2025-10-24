<script>
	import { goto } from '$app/navigation';
	import { manager } from '$lib/stores/accounts.svelte';
	import { SimpleSigner } from 'applesauce-signers';
	import { SimpleAccount } from 'applesauce-accounts/accounts';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { publishEvents } from '$lib/helpers/publisher.js';
	import { hexToNpub } from '$lib/helpers/nostrUtils.js';
	import ChevronLeftIcon from './icons/ui/ChevronLeftIcon.svelte';
	import ChevronRightIcon from './icons/ui/ChevronRightIcon.svelte';
	import KeypairGenerator from './shared/KeypairGenerator.svelte';
	import ImageUploader from './shared/ImageUploader.svelte';
	import ProfileForm from './shared/ProfileForm.svelte';
	import EditableList from './shared/EditableList.svelte';
	import LocationInput from './shared/LocationInput.svelte';

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
		location: '',
		description: '',
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

		// For current keypair flow, validate community settings in step 1
		if (useCurrentKeypair && step === 1) {
			if (communityData.relays.length === 0) {
				errors.relays = 'At least one relay is required';
				return false;
			}

			// Check if at least one content type is selected
			const hasContentType = Object.values(communityData.contentTypes).some(Boolean);
			if (!hasContentType) {
				errors.contentTypes = 'At least one content type must be selected';
				return false;
			}
		}

		// For new keypair flow, validate profile in step 1
		if (!useCurrentKeypair && step === 1) {
			if (!userData.name.trim()) {
				errors.name = 'Name is required';
				return false;
			}
		}

		// For new keypair flow, validate key download in step 2
		if (!useCurrentKeypair && step === 2) {
			if (!userData.downloadConfirmed) {
				errors.download = 'Please download your private key before continuing';
				return false;
			}
		}

		// For new keypair flow, validate community settings in step 3
		if (!useCurrentKeypair && step === 3) {
			if (communityData.relays.length === 0) {
				errors.relays = 'At least one relay is required';
				return false;
			}

			// Check if at least one content type is selected
			const hasContentType = Object.values(communityData.contentTypes).some(Boolean);
			if (!hasContentType) {
				errors.contentTypes = 'At least one content type must be selected';
				return false;
			}
		}

		return true;
	}

	// Get step labels based on flow
	function getStepLabels() {
		if (useCurrentKeypair) {
			return ['Community Settings', 'Confirm'];
		} else {
			return ['Profile', 'Keys', 'Community Settings', 'Confirm'];
		}
	}

	/**
	 * Validate relay URL format
	 * @param {string} url
	 */
	function validateRelayUrl(url) {
		if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
			return 'Relay URL must start with wss:// or ws://';
		}
		try {
			new URL(url);
			return null;
		} catch {
			return 'Invalid URL format';
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

				// Publish kind:0 profile event for new keypair
				const profileEvent = {
					kind: 0,
					created_at: Math.floor(Date.now() / 1000),
					tags: [],
					content: JSON.stringify({
						name: userData.name,
						about: userData.about,
						picture: userData.picture,
						website: userData.website
					}),
					pubkey: account.pubkey
				};

				const signedProfileEvent = await signer.signEvent(profileEvent);
				await publishEvents([signedProfileEvent], {
					logPrefix: 'CreateCommunityModal:Profile'
				});
				console.log('CreateCommunityModal: Profile event published');
			}

			if (!account || !signer) {
				throw new Error('No account available for community creation');
			}

			// Validate at least one relay
			if (communityData.relays.length === 0) {
				throw new Error('At least one relay is required');
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

			// Add optional location
			if (communityData.location?.trim()) {
				communityTags.push(['location', communityData.location.trim()]);
				// TODO: Add geohash support in the future
				// if (communityData.geohash) {
				//   communityTags.push(['g', communityData.geohash]);
				// }
			}

			// Add optional community description
			if (communityData.description?.trim()) {
				communityTags.push(['description', communityData.description.trim()]);
			}

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
				// communityTags.push(['k', '30040']); // Curated Publication Content
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

			// Publish community and relationship events
			const eventsToPublish = [signedCommunityEvent, signedRelationshipEvent];
			const publishResult = await publishEvents(eventsToPublish, {
				logPrefix: 'CreateCommunityModal'
			});

			if (publishResult.success) {
				console.log('CreateCommunityModal: Successfully created community');

				// Navigate to the newly created community
				const npub = hexToNpub(account.pubkey);
				if (npub) {
					closeModal();
					goto(`/c/${npub}`);
				} else {
					console.error('Failed to convert pubkey to npub');
					closeModal();
				}
			} else {
				throw new Error('Failed to publish community to any relay');
			}

		} catch (error) {
			console.error('Error creating community:', error);
			errors.publishing = error instanceof Error ? error.message : 'Failed to create community. Please try again.';
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
			location: '',
			description: '',
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
				<!-- Community Settings for Current Keypair -->
				<div class="space-y-6">
					<div class="prose max-w-none mb-4">
						<p class="text-sm text-base-content/70">
							Your community will use your current profile (name, picture, description). 
							Configure community-specific settings below.
						</p>
					</div>

					<!-- Relays -->
					<EditableList
						bind:items={communityData.relays}
						label="Community Relays"
						placeholder="wss://relay.example.com"
						buttonText="Add Relay"
						itemType="relay"
						validator={validateRelayUrl}
						minItems={1}
						helpText="At least one relay is required"
					/>

					<!-- Blossom Servers -->
					<EditableList
						bind:items={communityData.blossomServers}
						label="Blossom Servers (Optional)"
						placeholder="blossom.example.com"
						buttonText="Add Server"
						itemType="server"
					/>

					<!-- Location -->
					<LocationInput
						bind:value={communityData.location}
						label="Community Location (Optional)"
						placeholder="Berlin, Germany or Online"
					/>

					<!-- Community Description -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Community Description (Optional)</span>
							<span class="label-text-alt">Overwrites your profile description</span>
						</label>
						<textarea
							bind:value={communityData.description}
							placeholder="A specific description for this community (optional)"
							class="textarea textarea-bordered h-24"
						></textarea>
					</div>

					<!-- Content Types -->
					<div class="form-control">
						<label class="label">
							<span class="label-text font-semibold">Content Types</span>
							<span class="label-text-alt text-sm">Select features for your community</span>
						</label>
						<div class="grid grid-cols-2 gap-3">
							<!-- Calendar Card -->
							<button
								type="button"
								class="card bg-base-200 hover:bg-base-300 transition-all cursor-pointer {communityData.contentTypes.calendar ? 'ring-2 ring-primary' : ''}"
								onclick={() => communityData.contentTypes.calendar = !communityData.contentTypes.calendar}
							>
								<div class="card-body p-4">
									<div class="flex items-center justify-between">
										<span class="font-medium">Calendar</span>
										<input
											type="checkbox"
											checked={communityData.contentTypes.calendar}
											class="checkbox checkbox-primary pointer-events-none"
											tabindex="-1"
										/>
									</div>
								</div>
							</button>

							<!-- Chat Card -->
							<button
								type="button"
								class="card bg-base-200 hover:bg-base-300 transition-all cursor-pointer {communityData.contentTypes.chat ? 'ring-2 ring-primary' : ''}"
								onclick={() => communityData.contentTypes.chat = !communityData.contentTypes.chat}
							>
								<div class="card-body p-4">
									<div class="flex items-center justify-between">
										<span class="font-medium">Chat</span>
										<input
											type="checkbox"
											checked={communityData.contentTypes.chat}
											class="checkbox checkbox-primary pointer-events-none"
											tabindex="-1"
										/>
									</div>
								</div>
							</button>

							<!-- Articles Card -->
							<button
								type="button"
								class="card bg-base-200 hover:bg-base-300 transition-all cursor-pointer {communityData.contentTypes.articles ? 'ring-2 ring-primary' : ''}"
								onclick={() => communityData.contentTypes.articles = !communityData.contentTypes.articles}
							>
								<div class="card-body p-4">
									<div class="flex items-center justify-between">
										<span class="font-medium">Articles</span>
										<input
											type="checkbox"
											checked={communityData.contentTypes.articles}
											class="checkbox checkbox-primary pointer-events-none"
											tabindex="-1"
										/>
									</div>
								</div>
							</button>

							<!-- Posts Card -->
							<button
								type="button"
								class="card bg-base-200 hover:bg-base-300 transition-all cursor-pointer {communityData.contentTypes.posts ? 'ring-2 ring-primary' : ''}"
								onclick={() => communityData.contentTypes.posts = !communityData.contentTypes.posts}
							>
								<div class="card-body p-4">
									<div class="flex items-center justify-between">
										<span class="font-medium">Posts</span>
										<input
											type="checkbox"
											checked={communityData.contentTypes.posts}
											class="checkbox checkbox-primary pointer-events-none"
											tabindex="-1"
										/>
									</div>
								</div>
							</button>

							<!-- Wikis Card -->
							<button
								type="button"
								class="card bg-base-200 hover:bg-base-300 transition-all cursor-pointer {communityData.contentTypes.wikis ? 'ring-2 ring-primary' : ''}"
								onclick={() => communityData.contentTypes.wikis = !communityData.contentTypes.wikis}
							>
								<div class="card-body p-4">
									<div class="flex items-center justify-between">
										<span class="font-medium">Wikis</span>
										<input
											type="checkbox"
											checked={communityData.contentTypes.wikis}
											class="checkbox checkbox-primary pointer-events-none"
											tabindex="-1"
										/>
									</div>
								</div>
							</button>
						</div>
						{#if errors.contentTypes}
							<label class="label">
								<span class="label-text-alt text-error">{errors.contentTypes}</span>
							</label>
						{/if}
					</div>
				</div>

			{:else if currentStep === 2 && useCurrentKeypair}
				<!-- Confirmation for Current Keypair -->
				<div class="space-y-6">
					<h2 class="text-xl font-semibold mb-4">Confirm Community Creation</h2>

					<div class="space-y-4">
						<!-- Profile Info -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">Profile (from current account)</h3>
								<p class="text-sm text-base-content/70">Name, picture, and description from your current profile</p>
								<p><strong>Public Key:</strong> <code class="text-xs">{manager.active?.pubkey.slice(0, 16)}...</code></p>
							</div>
						</div>

						<!-- Community Settings -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">Community Settings</h3>
								<div class="space-y-2 text-sm">
									<p><strong>Relays:</strong> {communityData.relays.join(', ')}</p>
									{#if communityData.blossomServers.length > 0}
										<p><strong>Blossom Servers:</strong> {communityData.blossomServers.join(', ')}</p>
									{/if}
									{#if communityData.location}
										<p><strong>Location:</strong> {communityData.location}</p>
									{/if}
									{#if communityData.description}
										<p><strong>Community Description:</strong> {communityData.description}</p>
									{/if}
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
				<!-- Community Settings for New Keypair -->
				<div class="space-y-6">
					<h2 class="text-xl font-semibold mb-4">Community Settings</h2>

					<!-- Relays -->
					<EditableList
						bind:items={communityData.relays}
						label="Community Relays"
						placeholder="wss://relay.example.com"
						buttonText="Add Relay"
						itemType="relay"
						validator={validateRelayUrl}
						minItems={1}
						helpText="At least one relay is required"
					/>

					<!-- Blossom Servers -->
					<EditableList
						bind:items={communityData.blossomServers}
						label="Blossom Servers (Optional)"
						placeholder="blossom.example.com"
						buttonText="Add Server"
						itemType="server"
					/>

					<!-- Location -->
					<LocationInput
						bind:value={communityData.location}
						label="Community Location (Optional)"
						placeholder="Berlin, Germany or Online"
					/>

					<!-- Community Description -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Community Description (Optional)</span>
							<span class="label-text-alt">Overwrites your profile description</span>
						</label>
						<textarea
							bind:value={communityData.description}
							placeholder="A specific description for this community (optional)"
							class="textarea textarea-bordered h-24"
						></textarea>
					</div>

					<!-- Content Types -->
					<div class="form-control">
						<label class="label">
							<span class="label-text font-semibold">Content Types</span>
							<span class="label-text-alt text-sm">Select features for your community</span>
						</label>
						<div class="grid grid-cols-2 gap-3">
							<!-- Calendar Card -->
							<button
								type="button"
								class="card bg-base-200 hover:bg-base-300 transition-all cursor-pointer {communityData.contentTypes.calendar ? 'ring-2 ring-primary' : ''}"
								onclick={() => communityData.contentTypes.calendar = !communityData.contentTypes.calendar}
							>
								<div class="card-body p-4">
									<div class="flex items-center justify-between">
										<span class="font-medium">Calendar</span>
										<input
											type="checkbox"
											checked={communityData.contentTypes.calendar}
											class="checkbox checkbox-primary pointer-events-none"
											tabindex="-1"
										/>
									</div>
								</div>
							</button>

							<!-- Chat Card -->
							<button
								type="button"
								class="card bg-base-200 hover:bg-base-300 transition-all cursor-pointer {communityData.contentTypes.chat ? 'ring-2 ring-primary' : ''}"
								onclick={() => communityData.contentTypes.chat = !communityData.contentTypes.chat}
							>
								<div class="card-body p-4">
									<div class="flex items-center justify-between">
										<span class="font-medium">Chat</span>
										<input
											type="checkbox"
											checked={communityData.contentTypes.chat}
											class="checkbox checkbox-primary pointer-events-none"
											tabindex="-1"
										/>
									</div>
								</div>
							</button>

							<!-- Articles Card -->
							<button
								type="button"
								class="card bg-base-200 hover:bg-base-300 transition-all cursor-pointer {communityData.contentTypes.articles ? 'ring-2 ring-primary' : ''}"
								onclick={() => communityData.contentTypes.articles = !communityData.contentTypes.articles}
							>
								<div class="card-body p-4">
									<div class="flex items-center justify-between">
										<span class="font-medium">Articles</span>
										<input
											type="checkbox"
											checked={communityData.contentTypes.articles}
											class="checkbox checkbox-primary pointer-events-none"
											tabindex="-1"
										/>
									</div>
								</div>
							</button>

							<!-- Posts Card -->
							<button
								type="button"
								class="card bg-base-200 hover:bg-base-300 transition-all cursor-pointer {communityData.contentTypes.posts ? 'ring-2 ring-primary' : ''}"
								onclick={() => communityData.contentTypes.posts = !communityData.contentTypes.posts}
							>
								<div class="card-body p-4">
									<div class="flex items-center justify-between">
										<span class="font-medium">Posts</span>
										<input
											type="checkbox"
											checked={communityData.contentTypes.posts}
											class="checkbox checkbox-primary pointer-events-none"
											tabindex="-1"
										/>
									</div>
								</div>
							</button>

							<!-- Wikis Card -->
							<button
								type="button"
								class="card bg-base-200 hover:bg-base-300 transition-all cursor-pointer {communityData.contentTypes.wikis ? 'ring-2 ring-primary' : ''}"
								onclick={() => communityData.contentTypes.wikis = !communityData.contentTypes.wikis}
							>
								<div class="card-body p-4">
									<div class="flex items-center justify-between">
										<span class="font-medium">Wikis</span>
										<input
											type="checkbox"
											checked={communityData.contentTypes.wikis}
											class="checkbox checkbox-primary pointer-events-none"
											tabindex="-1"
										/>
									</div>
								</div>
							</button>
						</div>
						{#if errors.contentTypes}
							<label class="label">
								<span class="label-text-alt text-error">{errors.contentTypes}</span>
							</label>
						{/if}
					</div>
				</div>

			{:else if currentStep === 4 && !useCurrentKeypair}
				<!-- Confirmation for New Keypair -->
				<div class="space-y-6">
					<h2 class="text-xl font-semibold mb-4">Confirm Community Creation</h2>

					<div class="space-y-4">
						<!-- Profile Info -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">Profile</h3>
								<div class="space-y-2">
									<p><strong>Name:</strong> {userData.name}</p>
									<p><strong>About:</strong> {userData.about || 'No description'}</p>
									<p><strong>Public Key:</strong> <code class="text-xs">{userData.npub.slice(0, 16)}...</code></p>
								</div>
							</div>
						</div>

						<!-- Community Settings -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">Community Settings</h3>
								<div class="space-y-2 text-sm">
									<p><strong>Relays:</strong> {communityData.relays.join(', ')}</p>
									{#if communityData.blossomServers.length > 0}
										<p><strong>Blossom Servers:</strong> {communityData.blossomServers.join(', ')}</p>
									{/if}
									{#if communityData.location}
										<p><strong>Location:</strong> {communityData.location}</p>
									{/if}
									{#if communityData.description}
										<p><strong>Community Description:</strong> {communityData.description}</p>
									{/if}
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

					{#if currentStep > 0}
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
