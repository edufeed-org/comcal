<script>
	import * as m from '$lib/paraglide/messages';
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
	 * Sync modal close with store state
	 * This effect ensures that when the dialog closes (via ESC, backdrop, etc.),
	 * the modal store state is updated accordingly
	 */
	$effect(() => {
		const dialog = /** @type {HTMLDialogElement} */ (document.getElementById(modalId));
		if (!dialog) return;

		const handleDialogClose = () => {
			// Only update store if this modal is currently active
			if (modalStore.activeModal === 'createCommunity') {
				console.log('CreateCommunityModal: Dialog closed, syncing with store');
				modalStore.closeModal();
				// Reset state on close
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
		};

		dialog.addEventListener('close', handleDialogClose);
		return () => {
			dialog.removeEventListener('close', handleDialogClose);
		};
	});

	/**
	 * @param {number} step
	 */
	function validateStep(step) {
		errors = {};

		// For current keypair flow, validate community settings in step 1
		if (useCurrentKeypair && step === 1) {
			if (communityData.relays.length === 0) {
				errors.relays = m.create_community_modal_error_relays_required();
				return false;
			}

			// Check if at least one content type is selected
			const hasContentType = Object.values(communityData.contentTypes).some(Boolean);
			if (!hasContentType) {
				errors.contentTypes = m.create_community_modal_error_content_types_required();
				return false;
			}
		}

		// For new keypair flow, validate profile in step 1
		if (!useCurrentKeypair && step === 1) {
			if (!userData.name.trim()) {
				errors.name = m.create_community_modal_error_name_required();
				return false;
			}
		}

		// For new keypair flow, validate key download in step 2
		if (!useCurrentKeypair && step === 2) {
			if (!userData.downloadConfirmed) {
				errors.download = m.create_community_modal_error_download_required();
				return false;
			}
		}

		// For new keypair flow, validate community settings in step 3
		if (!useCurrentKeypair && step === 3) {
			if (communityData.relays.length === 0) {
				errors.relays = m.create_community_modal_error_relays_required();
				return false;
			}

			// Check if at least one content type is selected
			const hasContentType = Object.values(communityData.contentTypes).some(Boolean);
			if (!hasContentType) {
				errors.contentTypes = m.create_community_modal_error_content_types_required();
				return false;
			}
		}

		return true;
	}

	// Get step labels based on flow
	function getStepLabels() {
		if (useCurrentKeypair) {
			return [m.create_community_modal_step_community_settings(), m.create_community_modal_step_confirm()];
		} else {
			return [m.create_community_modal_step_profile(), m.create_community_modal_step_keys(), m.create_community_modal_step_community_settings(), m.create_community_modal_step_confirm()];
		}
	}

	/**
	 * Validate relay URL format
	 * @param {string} url
	 */
	function validateRelayUrl(url) {
		if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
			return m.create_community_modal_relays_validation();
		}
		try {
			new URL(url);
			return null;
		} catch {
			return m.create_community_modal_error_invalid_url();
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
					throw new Error(m.create_community_modal_error_private_key());
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
				throw new Error(m.create_community_modal_error_no_account());
			}

			// Validate at least one relay
			if (communityData.relays.length === 0) {
				throw new Error(m.create_community_modal_error_relay_required());
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
				throw new Error(m.create_community_modal_error_publish_failed());
			}

		} catch (error) {
			console.error('Error creating community:', error);
			errors.publishing = error instanceof Error ? error.message : m.create_community_modal_error_failed();
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
			<h1 class="text-2xl font-bold mb-4">{m.create_community_modal_title()}</h1>

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
					<h2 class="text-xl font-semibold mb-4">{m.create_community_modal_keypair_selection_title()}</h2>

					<div class="space-y-4">
						<!-- Use Current Keypair Option -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">{m.create_community_modal_current_keypair_title()}</h3>
								<p class="text-sm opacity-70">
									{m.create_community_modal_current_keypair_description()}
								</p>
								<div class="card-actions justify-end mt-4">
									<button
										class="btn btn-primary"
										onclick={selectCurrentKeypair}
									>
										{m.create_community_modal_current_keypair_button()}
									</button>
								</div>
							</div>
						</div>

						<!-- Create New Keypair Option -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">{m.create_community_modal_new_keypair_title()}</h3>
								<p class="text-sm opacity-70">
									{m.create_community_modal_new_keypair_description()}
								</p>
								<div class="card-actions justify-end mt-4">
									<button class="btn btn-secondary" onclick={selectNewKeypair}>
										{m.create_community_modal_new_keypair_button()}
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
							{m.create_community_modal_current_settings_info()}
						</p>
					</div>

					<!-- Relays -->
					<EditableList
						bind:items={communityData.relays}
						label={m.create_community_modal_relays_label()}
						placeholder={m.create_community_modal_relays_placeholder()}
						buttonText={m.create_community_modal_relays_button()}
						itemType="relay"
						validator={validateRelayUrl}
						minItems={1}
						helpText={m.create_community_modal_relays_help()}
					/>

					<!-- Blossom Servers -->
					<EditableList
						bind:items={communityData.blossomServers}
						label={m.create_community_modal_blossom_label()}
						placeholder={m.create_community_modal_blossom_placeholder()}
						buttonText={m.create_community_modal_blossom_button()}
						itemType="server"
					/>

					<!-- Location -->
					<LocationInput
						bind:value={communityData.location}
						label={m.create_community_modal_location_label()}
						placeholder={m.create_community_modal_location_placeholder()}
					/>

					<!-- Community Description -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">{m.create_community_modal_description_label()}</span>
							<span class="label-text-alt">{m.create_community_modal_description_alt()}</span>
						</label>
						<textarea
							bind:value={communityData.description}
							placeholder={m.create_community_modal_description_placeholder()}
							class="textarea textarea-bordered h-24"
						></textarea>
					</div>

					<!-- Content Types -->
					<div class="form-control">
						<label class="label">
							<span class="label-text font-semibold">{m.create_community_modal_content_types_label()}</span>
							<span class="label-text-alt text-sm">{m.create_community_modal_content_types_alt()}</span>
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
										<span class="font-medium">{m.create_community_modal_content_calendar()}</span>
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
										<span class="font-medium">{m.create_community_modal_content_chat()}</span>
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
										<span class="font-medium">{m.create_community_modal_content_articles()}</span>
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
										<span class="font-medium">{m.create_community_modal_content_posts()}</span>
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
										<span class="font-medium">{m.create_community_modal_content_wikis()}</span>
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
					<h2 class="text-xl font-semibold mb-4">{m.create_community_modal_confirm_title()}</h2>

					<div class="space-y-4">
						<!-- Profile Info -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">{m.create_community_modal_confirm_profile_current()}</h3>
								<p class="text-sm text-base-content/70">{m.create_community_modal_confirm_profile_current_info()}</p>
								<p><strong>{m.create_community_modal_confirm_pubkey()}</strong> <code class="text-xs">{manager.active?.pubkey.slice(0, 16)}...</code></p>
							</div>
						</div>

						<!-- Community Settings -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">{m.create_community_modal_confirm_settings_section()}</h3>
								<div class="space-y-2 text-sm">
									<p><strong>{m.create_community_modal_confirm_relays()}</strong> {communityData.relays.join(', ')}</p>
									{#if communityData.blossomServers.length > 0}
										<p><strong>{m.create_community_modal_confirm_blossom()}</strong> {communityData.blossomServers.join(', ')}</p>
									{/if}
									{#if communityData.location}
										<p><strong>{m.create_community_modal_confirm_location()}</strong> {communityData.location}</p>
									{/if}
									{#if communityData.description}
										<p><strong>{m.create_community_modal_confirm_description()}</strong> {communityData.description}</p>
									{/if}
								</div>
							</div>
						</div>

						<!-- Content Types -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">{m.create_community_modal_confirm_content_types_section()}</h3>
								<div class="flex flex-wrap gap-2">
									{#if communityData.contentTypes.calendar}
										<span class="badge badge-primary">{m.create_community_modal_content_calendar()}</span>
									{/if}
									{#if communityData.contentTypes.chat}
										<span class="badge badge-primary">{m.create_community_modal_content_chat()}</span>
									{/if}
									{#if communityData.contentTypes.articles}
										<span class="badge badge-primary">{m.create_community_modal_content_articles()}</span>
									{/if}
									{#if communityData.contentTypes.posts}
										<span class="badge badge-primary">{m.create_community_modal_content_posts()}</span>
									{/if}
									{#if communityData.contentTypes.wikis}
										<span class="badge badge-primary">{m.create_community_modal_content_wikis()}</span>
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
							{m.create_community_modal_profile_title({ name: userData.name || 'Your Community' })}
						</h2>
						<p class="mb-4">
							{m.create_community_modal_profile_description()}
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
					<h2 class="text-xl font-semibold mb-4">{m.create_community_modal_step_community_settings()}</h2>

					<!-- Relays -->
					<EditableList
						bind:items={communityData.relays}
						label={m.create_community_modal_relays_label()}
						placeholder={m.create_community_modal_relays_placeholder()}
						buttonText={m.create_community_modal_relays_button()}
						itemType="relay"
						validator={validateRelayUrl}
						minItems={1}
						helpText={m.create_community_modal_relays_help()}
					/>

					<!-- Blossom Servers -->
					<EditableList
						bind:items={communityData.blossomServers}
						label={m.create_community_modal_blossom_label()}
						placeholder={m.create_community_modal_blossom_placeholder()}
						buttonText={m.create_community_modal_blossom_button()}
						itemType="server"
					/>

					<!-- Location -->
					<LocationInput
						bind:value={communityData.location}
						label={m.create_community_modal_location_label()}
						placeholder={m.create_community_modal_location_placeholder()}
					/>

					<!-- Community Description -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">{m.create_community_modal_description_label()}</span>
							<span class="label-text-alt">{m.create_community_modal_description_alt()}</span>
						</label>
						<textarea
							bind:value={communityData.description}
							placeholder={m.create_community_modal_description_placeholder()}
							class="textarea textarea-bordered h-24"
						></textarea>
					</div>

					<!-- Content Types -->
					<div class="form-control">
						<label class="label">
							<span class="label-text font-semibold">{m.create_community_modal_content_types_label()}</span>
							<span class="label-text-alt text-sm">{m.create_community_modal_content_types_alt()}</span>
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
										<span class="font-medium">{m.create_community_modal_content_calendar()}</span>
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
										<span class="font-medium">{m.create_community_modal_content_chat()}</span>
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
										<span class="font-medium">{m.create_community_modal_content_articles()}</span>
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
										<span class="font-medium">{m.create_community_modal_content_posts()}</span>
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
										<span class="font-medium">{m.create_community_modal_content_wikis()}</span>
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
					<h2 class="text-xl font-semibold mb-4">{m.create_community_modal_confirm_title()}</h2>

					<div class="space-y-4">
						<!-- Profile Info -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">{m.create_community_modal_confirm_profile_section()}</h3>
								<div class="space-y-2">
									<p><strong>{m.create_community_modal_confirm_name()}</strong> {userData.name}</p>
									<p><strong>{m.create_community_modal_confirm_about()}</strong> {userData.about || m.create_community_modal_confirm_about_none()}</p>
									<p><strong>{m.create_community_modal_confirm_pubkey()}</strong> <code class="text-xs">{userData.npub.slice(0, 16)}...</code></p>
								</div>
							</div>
						</div>

						<!-- Community Settings -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">{m.create_community_modal_confirm_settings_section()}</h3>
								<div class="space-y-2 text-sm">
									<p><strong>{m.create_community_modal_confirm_relays()}</strong> {communityData.relays.join(', ')}</p>
									{#if communityData.blossomServers.length > 0}
										<p><strong>{m.create_community_modal_confirm_blossom()}</strong> {communityData.blossomServers.join(', ')}</p>
									{/if}
									{#if communityData.location}
										<p><strong>{m.create_community_modal_confirm_location()}</strong> {communityData.location}</p>
									{/if}
									{#if communityData.description}
										<p><strong>{m.create_community_modal_confirm_description()}</strong> {communityData.description}</p>
									{/if}
								</div>
							</div>
						</div>

						<!-- Content Types -->
						<div class="card bg-base-200">
							<div class="card-body">
								<h3 class="card-title">{m.create_community_modal_confirm_content_types_section()}</h3>
								<div class="flex flex-wrap gap-2">
									{#if communityData.contentTypes.calendar}
										<span class="badge badge-primary">{m.create_community_modal_content_calendar()}</span>
									{/if}
									{#if communityData.contentTypes.chat}
										<span class="badge badge-primary">{m.create_community_modal_content_chat()}</span>
									{/if}
									{#if communityData.contentTypes.articles}
										<span class="badge badge-primary">{m.create_community_modal_content_articles()}</span>
									{/if}
									{#if communityData.contentTypes.posts}
										<span class="badge badge-primary">{m.create_community_modal_content_posts()}</span>
									{/if}
									{#if communityData.contentTypes.wikis}
										<span class="badge badge-primary">{m.create_community_modal_content_wikis()}</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</div>

			{:else}
				<!-- Fallback -->
				<div class="alert alert-error">
					<span>{m.create_community_modal_error_invalid_state()}</span>
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
							{m.create_community_modal_button_back()}
						</button>
					{/if}
				</div>

				<div class="flex gap-2">
					<form method="dialog">
						<button class="btn">{m.create_community_modal_button_cancel()}</button>
					</form>

					{#if currentStep > 0}
						{#if currentStep < totalSteps()}
							<button class="btn btn-primary" onclick={nextStep}>
								{m.create_community_modal_button_next()}
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
									{m.create_community_modal_button_creating()}
								{:else}
									{m.create_community_modal_button_create()}
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
