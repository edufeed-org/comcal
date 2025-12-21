<!--
  AMBUploadModal Component
  Paginated wizard for creating educational resources (kind:30142)
-->

<script>
	import { goto } from '$app/navigation';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import { CloseIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon } from '$lib/components/icons';
	import SKOSDropdown from './SKOSDropdown.svelte';
	import BlossomUploader from './BlossomUploader.svelte';
	import CreatorInput from './CreatorInput.svelte';
	import { createEducationalActions } from '$lib/stores/educational-actions.svelte.js';
	import { fetchProfileData } from '$lib/helpers/profile.js';
	import * as m from '$lib/paraglide/messages';

	/**
	 * @typedef {import('./SKOSDropdown.svelte').SelectedConcept} SelectedConcept
	 * @typedef {import('./BlossomUploader.svelte').UploadedFile} UploadedFile
	 * @typedef {import('./CreatorInput.svelte').Creator} Creator
	 */

	/** @type {{ isOpen?: boolean, communityPubkey?: string, onClose?: () => void, onPublished?: (naddr: string) => void }} */
	let {
		isOpen = false,
		communityPubkey = '',
		onClose = () => {},
		onPublished = () => {}
	} = $props();

	// Current wizard step (1-4)
	let currentStep = $state(1);
	const totalSteps = 4;

	// Form data state
	let formData = $state({
		// Basic Info (Step 1)
		name: '',
		description: '',
		inLanguage: 'de',
		image: '',
		identifier: '',

		// Classification (Step 2)
		learningResourceType: /** @type {SelectedConcept[]} */ ([]),
		about: /** @type {SelectedConcept[]} */ ([]),
		keywords: /** @type {string[]} */ ([]),

		// Content & Creators (Step 3)
		creators: /** @type {Creator[]} */ ([]),
		encodings: /** @type {UploadedFile[]} */ ([]),
		externalUrl: '',

		// Rights (Step 4)
		license: 'https://creativecommons.org/licenses/by/4.0/',
		isAccessibleForFree: true
	});

	// Validation and submission state
	let validationErrors = $state(/** @type {string[]} */ ([]));
	let isSubmitting = $state(false);
	let submitError = $state('');

	// Track if user manually edited the identifier
	let identifierManuallyEdited = $state(false);

	// Get active user
	let activeUser = $state(manager.active);
	$effect(() => {
		const subscription = manager.active$.subscribe(async (user) => {
			activeUser = user;
			// Auto-add logged-in user as first creator with fetched profile name
			if (user && formData.creators.length === 0) {
				// Set initial placeholder while fetching profile
				formData.creators = [{
					name: 'Loading...',
					type: 'Person',
					pubkey: user.pubkey
				}];
				
				// Fetch profile to get actual name
				try {
					/** @type {{ name?: string, display_name?: string }} */
					const profile = await fetchProfileData(user.pubkey);
					// Only update if still the same user and creators array still has our placeholder
					if (activeUser?.pubkey === user.pubkey && 
						formData.creators.length === 1 && 
						formData.creators[0].pubkey === user.pubkey) {
						formData.creators = [{
							name: profile.name || '',
							type: 'Person',
							pubkey: user.pubkey
						}];
					}
				} catch (error) {
					console.warn('Failed to fetch profile for creator:', error);
					// Leave name empty so user can type it (per CreatorInput)
					if (activeUser?.pubkey === user.pubkey && 
						formData.creators.length === 1 && 
						formData.creators[0].pubkey === user.pubkey) {
						formData.creators = [{
							name: '',
							type: 'Person',
							pubkey: user.pubkey
						}];
					}
				}
			}
		});
		return () => subscription.unsubscribe();
	});

	// License options
	const licenseOptions = [
		{ id: 'https://creativecommons.org/licenses/by/4.0/', label: 'CC BY 4.0' },
		{ id: 'https://creativecommons.org/licenses/by-sa/4.0/', label: 'CC BY-SA 4.0' },
		{ id: 'https://creativecommons.org/licenses/by-nc/4.0/', label: 'CC BY-NC 4.0' },
		{ id: 'https://creativecommons.org/licenses/by-nc-sa/4.0/', label: 'CC BY-NC-SA 4.0' },
		{ id: 'https://creativecommons.org/publicdomain/zero/1.0/', label: 'CC0 (Public Domain)' },
		{ id: 'https://opensource.org/licenses/MIT', label: 'MIT License' }
	];

	// Language options
	const languageOptions = [
		{ code: 'de', label: 'Deutsch' },
		{ code: 'en', label: 'English' },
		{ code: 'fr', label: 'Français' },
		{ code: 'es', label: 'Español' },
		{ code: 'it', label: 'Italiano' }
	];

	// Step titles
	const stepTitles = [
		'Basic Information',
		'Classification',
		'Content & Creators',
		'License & Publish'
	];

	// Reset form when modal opens
	$effect(() => {
		if (isOpen) {
			resetForm();
		}
	});

	/**
	 * Reset form to initial state
	 */
	async function resetForm() {
		currentStep = 1;
		validationErrors = [];
		isSubmitting = false;
		submitError = '';
		identifierManuallyEdited = false;
		
		// Set initial form state
		formData = {
			name: '',
			description: '',
			inLanguage: 'de',
			image: '',
			identifier: '',
			learningResourceType: [],
			about: [],
			keywords: [],
			creators: activeUser ? [{
				name: 'Loading...',
				type: 'Person',
				pubkey: activeUser.pubkey
			}] : [],
			encodings: [],
			externalUrl: '',
			license: 'https://creativecommons.org/licenses/by/4.0/',
			isAccessibleForFree: true
		};
		
		// Fetch profile for creator name if user is logged in
		if (activeUser) {
			try {
				/** @type {{ name?: string }} */
				const profile = await fetchProfileData(activeUser.pubkey);
				// Only update if user hasn't changed and creators still has our placeholder
				if (formData.creators.length === 1 && 
					formData.creators[0].pubkey === activeUser.pubkey) {
					formData.creators = [{
						name: profile.name || '',
						type: 'Person',
						pubkey: activeUser.pubkey
					}];
				}
			} catch (error) {
				console.warn('Failed to fetch profile for creator in resetForm:', error);
				// Leave name empty so user can type it
				if (formData.creators.length === 1 && 
					formData.creators[0].pubkey === activeUser.pubkey) {
					formData.creators = [{
						name: '',
						type: 'Person',
						pubkey: activeUser.pubkey
					}];
				}
			}
		}
	}

	/**
	 * Generate slug from title
	 * @param {string} title
	 * @returns {string}
	 */
	function generateSlug(title) {
		return title
			.toLowerCase()
			.replace(/[äöüß]/g, (c) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[c] || c))
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 50);
	}

	// Auto-generate identifier from name (only if not manually edited)
	$effect(() => {
		if (formData.name && !identifierManuallyEdited) {
			formData.identifier = generateSlug(formData.name);
		}
	});

	/**
	 * Handle manual identifier input
	 */
	function handleIdentifierInput() {
		identifierManuallyEdited = true;
	}

	/**
	 * Validate current step
	 * @returns {boolean}
	 */
	function validateCurrentStep() {
		validationErrors = [];

		switch (currentStep) {
			case 1:
				if (!formData.name.trim()) {
					validationErrors.push('Title is required');
				}
				if (!formData.description.trim()) {
					validationErrors.push('Description is required');
				}
				break;
			case 2:
				if (formData.learningResourceType.length === 0) {
					validationErrors.push('Please select at least one resource type');
				}
				if (formData.about.length === 0) {
					validationErrors.push('Please select at least one subject');
				}
				break;
			case 3:
				// Optional - no strict validation
				break;
			case 4:
				if (!formData.license) {
					validationErrors.push('Please select a license');
				}
				break;
		}

		return validationErrors.length === 0;
	}

	/**
	 * Go to next step
	 */
	function nextStep() {
		if (validateCurrentStep() && currentStep < totalSteps) {
			currentStep++;
		}
	}

	/**
	 * Go to previous step
	 */
	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
			validationErrors = [];
		}
	}

	/**
	 * Handle form submission
	 */
	async function handleSubmit() {
		if (!validateCurrentStep()) return;
		if (!activeUser) {
			submitError = 'Please log in to publish';
			return;
		}

		isSubmitting = true;
		submitError = '';

		try {
			const actions = createEducationalActions();
			
			// Transform formData to the structure expected by educational-actions
			const resourceData = {
				name: formData.name,
				description: formData.description,
				slug: formData.identifier || generateSlug(formData.name),
				learningResourceType: formData.learningResourceType[0]?.id || '',
				learningResourceTypeLabel: formData.learningResourceType[0]?.label || '',
				about: formData.about.map(s => s.id),
				aboutLabels: formData.about.map(s => ({ id: s.id, label: s.label })),
				inLanguage: formData.inLanguage,
				license: formData.license,
				creators: formData.creators,
				keywords: formData.keywords,
				files: formData.encodings
			};
			
			const result = await actions.createResource(resourceData, communityPubkey);

			if (result.naddr) {
				onPublished(result.naddr);
				handleClose();
				await goto(`/${result.naddr}`);
			}
		} catch (error) {
			console.error('Error publishing resource:', error);
			submitError = error instanceof Error ? error.message : 'Failed to publish';
		} finally {
			isSubmitting = false;
		}
	}

	/**
	 * Handle modal close
	 */
	function handleClose() {
		onClose();
	}

	/**
	 * Handle backdrop click
	 * @param {MouseEvent} e
	 */
	function handleBackdropClick(e) {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}

	/**
	 * Handle escape key
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}

	/**
	 * Add keyword
	 * @param {Event} e
	 */
	function handleAddKeyword(e) {
		const input = /** @type {HTMLInputElement} */ (e.target);
		if (e instanceof KeyboardEvent && e.key === 'Enter') {
			e.preventDefault();
			const keyword = input.value.trim();
			if (keyword && !formData.keywords.includes(keyword)) {
				formData.keywords = [...formData.keywords, keyword];
			}
			input.value = '';
		}
	}

	/**
	 * Remove keyword
	 * @param {string} keyword
	 */
	function removeKeyword(keyword) {
		formData.keywords = formData.keywords.filter((k) => k !== keyword);
	}

	/**
	 * Create remove keyword handler
	 * @param {string} keyword
	 */
	function handleRemoveKeyword(keyword) {
		return () => removeKeyword(keyword);
	}
</script>

<!-- Modal -->
{#if isOpen}
	<div
		class="modal modal-open"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<div class="modal-box max-w-2xl w-full max-h-[90vh] flex flex-col">
			<!-- Header -->
			<div class="flex items-center justify-between mb-4 flex-shrink-0">
				<div>
					<h2 id="modal-title" class="text-xl font-semibold text-base-content">
						Create Educational Resource
					</h2>
					<p class="text-sm text-base-content/60 mt-1">
						Step {currentStep} of {totalSteps}: {stepTitles[currentStep - 1]}
					</p>
				</div>
				<button
					class="btn btn-sm btn-circle btn-ghost"
					onclick={handleClose}
					aria-label="Close"
				>
					<CloseIcon class_="w-6 h-6" />
				</button>
			</div>

			<!-- Progress Steps -->
			<div class="flex items-center justify-center gap-2 mb-6 flex-shrink-0">
				{#each Array(totalSteps) as _, i}
					<div
						class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors {i + 1 <= currentStep ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/50'}"
					>
						{#if i + 1 < currentStep}
							<CheckIcon class_="w-4 h-4" />
						{:else}
							{i + 1}
						{/if}
					</div>
					{#if i < totalSteps - 1}
						<div
							class="w-12 h-1 rounded transition-colors"
							class:bg-primary={i + 1 < currentStep}
							class:bg-base-300={i + 1 >= currentStep}
						></div>
					{/if}
				{/each}
			</div>

			<!-- Form Content (scrollable) -->
			<div class="flex-1 overflow-y-auto pr-2">
				<!-- Step 1: Basic Info -->
				{#if currentStep === 1}
					<div class="space-y-4">
						<!-- Title -->
						<div class="form-control">
							<label class="label">
								<span class="label-text font-medium">Title <span class="text-error">*</span></span>
							</label>
							<input
								type="text"
								class="input input-bordered w-full"
								bind:value={formData.name}
								placeholder="Enter a descriptive title"
							/>
						</div>

						<!-- Description -->
						<div class="form-control">
							<label class="label">
								<span class="label-text font-medium">Description <span class="text-error">*</span></span>
							</label>
							<textarea
								class="textarea textarea-bordered w-full resize-vertical"
								bind:value={formData.description}
								placeholder="Describe the educational content"
								rows="4"
							></textarea>
						</div>

						<!-- Language -->
						<div class="form-control">
							<label class="label">
								<span class="label-text font-medium">Language <span class="text-error">*</span></span>
							</label>
							<select class="select select-bordered w-full" bind:value={formData.inLanguage}>
								{#each languageOptions as lang}
									<option value={lang.code}>{lang.label}</option>
								{/each}
							</select>
						</div>

						<!-- Image URL -->
						<div class="form-control">
							<label class="label">
								<span class="label-text font-medium">Thumbnail Image URL (optional)</span>
							</label>
							<input
								type="url"
								class="input input-bordered w-full"
								bind:value={formData.image}
								placeholder="https://..."
							/>
						</div>

						<!-- Identifier -->
						<div class="form-control">
							<label class="label">
								<span class="label-text font-medium">Identifier (URL-friendly)</span>
							</label>
							<input
								type="text"
								class="input input-bordered w-full font-mono text-sm"
								bind:value={formData.identifier}
								oninput={handleIdentifierInput}
								placeholder="auto-generated-from-title"
							/>
							<label class="label">
								<span class="label-text-alt text-base-content/60">
									Used in the URL. Auto-generated from title if empty.
								</span>
							</label>
						</div>
					</div>
				{/if}

				<!-- Step 2: Classification -->
				{#if currentStep === 2}
					<div class="space-y-4">
						<!-- Resource Type -->
						<SKOSDropdown
							vocabularyKey="learningResourceType"
							bind:selected={formData.learningResourceType}
							label="Resource Type"
							placeholder="Select resource type(s)"
							required={true}
							multiple={true}
							helpText="What type of educational content is this?"
						/>

						<!-- Subject -->
						<SKOSDropdown
							vocabularyKey="about"
							bind:selected={formData.about}
							label="Subject / Topic"
							placeholder="Select subject(s)"
							required={true}
							multiple={true}
							helpText="What subjects does this resource cover?"
						/>

						<!-- Keywords -->
						<div class="form-control">
							<label class="label">
								<span class="label-text font-medium">Keywords (optional)</span>
							</label>
							<input
								type="text"
								class="input input-bordered w-full"
								placeholder="Type and press Enter to add"
								onkeydown={handleAddKeyword}
							/>
							{#if formData.keywords.length > 0}
								<div class="flex flex-wrap gap-2 mt-2">
									{#each formData.keywords as keyword}
										<span class="badge badge-outline gap-1">
											{keyword}
											<button
												type="button"
												class="hover:text-error"
												onclick={handleRemoveKeyword(keyword)}
											>
												<CloseIcon class_="w-3 h-3" />
											</button>
										</span>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Step 3: Content & Creators -->
				{#if currentStep === 3}
					<div class="space-y-4">
						<!-- Creators -->
						<CreatorInput
							bind:creators={formData.creators}
							label="Creators / Authors"
							helpText="Add the people or organizations who created this content"
						/>

						<!-- File Upload -->
						<BlossomUploader
							bind:files={formData.encodings}
							label="Content Files (optional)"
							helpText="Upload PDFs, videos, or other content files"
							multiple={true}
						/>

						<!-- External URL -->
						<div class="form-control">
							<label class="label">
								<span class="label-text font-medium">External Content URL (optional)</span>
							</label>
							<input
								type="url"
								class="input input-bordered w-full"
								bind:value={formData.externalUrl}
								placeholder="https://youtube.com/... or other URL"
							/>
							<label class="label">
								<span class="label-text-alt text-base-content/60">
									Link to external content (YouTube, Vimeo, website, etc.)
								</span>
							</label>
						</div>
					</div>
				{/if}

				<!-- Step 4: License & Publish -->
				{#if currentStep === 4}
					<div class="space-y-4">
						<!-- License -->
						<div class="form-control">
							<label class="label">
								<span class="label-text font-medium">License <span class="text-error">*</span></span>
							</label>
							<select class="select select-bordered w-full" bind:value={formData.license}>
								{#each licenseOptions as license}
									<option value={license.id}>{license.label}</option>
								{/each}
							</select>
							<label class="label">
								<a
									href={formData.license}
									target="_blank"
									rel="noopener noreferrer"
									class="label-text-alt link link-primary"
								>
									View license details →
								</a>
							</label>
						</div>

						<!-- Free Access -->
						<div class="form-control">
							<label class="label cursor-pointer justify-start gap-3">
								<input
									type="checkbox"
									class="checkbox checkbox-primary"
									bind:checked={formData.isAccessibleForFree}
								/>
								<span class="label-text">This resource is freely accessible</span>
							</label>
						</div>

						<!-- Preview Summary -->
						<div class="bg-base-200 rounded-lg p-4">
							<h3 class="font-medium mb-3">Summary</h3>
							<dl class="space-y-2 text-sm">
								<div class="flex">
									<dt class="w-28 text-base-content/60">Title:</dt>
									<dd class="flex-1 font-medium">{formData.name || '—'}</dd>
								</div>
								<div class="flex">
									<dt class="w-28 text-base-content/60">Language:</dt>
									<dd class="flex-1">{languageOptions.find((l) => l.code === formData.inLanguage)?.label}</dd>
								</div>
								<div class="flex">
									<dt class="w-28 text-base-content/60">Type:</dt>
									<dd class="flex-1">{formData.learningResourceType.map((t) => t.label).join(', ') || '—'}</dd>
								</div>
								<div class="flex">
									<dt class="w-28 text-base-content/60">Subject:</dt>
									<dd class="flex-1">{formData.about.map((s) => s.label).join(', ') || '—'}</dd>
								</div>
								<div class="flex">
									<dt class="w-28 text-base-content/60">Creators:</dt>
									<dd class="flex-1">{formData.creators.map((c) => c.name).join(', ') || '—'}</dd>
								</div>
								<div class="flex">
									<dt class="w-28 text-base-content/60">Files:</dt>
									<dd class="flex-1">{formData.encodings.length} file(s)</dd>
								</div>
								<div class="flex">
									<dt class="w-28 text-base-content/60">License:</dt>
									<dd class="flex-1">{licenseOptions.find((l) => l.id === formData.license)?.label}</dd>
								</div>
							</dl>
						</div>

						<!-- Community Info -->
						{#if communityPubkey}
							<div class="alert alert-info">
								<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span>This resource will be shared with the community.</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Validation Errors -->
			{#if validationErrors.length > 0}
				<div class="alert alert-error mt-4 flex-shrink-0">
					<ul class="list-disc list-inside text-sm">
						{#each validationErrors as error}
							<li>{error}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Submit Error -->
			{#if submitError}
				<div class="alert alert-error mt-4 flex-shrink-0">
					<span>{submitError}</span>
				</div>
			{/if}

			<!-- Footer / Navigation -->
			<div class="flex justify-between items-center mt-6 pt-4 border-t border-base-300 flex-shrink-0">
				<button
					type="button"
					class="btn btn-outline"
					onclick={prevStep}
					disabled={currentStep === 1 || isSubmitting}
				>
					<ChevronLeftIcon class_="w-4 h-4" />
					Back
				</button>

				{#if currentStep < totalSteps}
					<button
						type="button"
						class="btn btn-primary"
						onclick={nextStep}
					>
						Next
						<ChevronRightIcon class_="w-4 h-4" />
					</button>
				{:else}
					<button
						type="button"
						class="btn btn-primary"
						onclick={handleSubmit}
						disabled={isSubmitting}
					>
						{#if isSubmitting}
							<span class="loading loading-spinner loading-sm"></span>
							Publishing...
						{:else}
							Publish Resource
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
