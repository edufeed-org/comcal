<script>
	import { runtimeConfig } from '$lib/stores/config.svelte.js';
	import CameraIcon from '$lib/components/icons/actions/CameraIcon.svelte';
	import * as m from '$lib/paraglide/messages';
	import { BlossomClient } from 'blossom-client-sdk';

	let { userData, signer = null, errors = $bindable({}) } = $props();

	// UI state
	let uploadingImage = $state(false);
	let imagePreview = $state(/** @type {string | null} */ (null));
	let fileInputRef = $state(/** @type {HTMLInputElement | null} */ (null));

	/**
	 * Upload image to Blossom server using the SDK
	 * @param {File} file
	 * @returns {Promise<string>} URL of uploaded image
	 */
	async function uploadImageToBlossom(file) {
		if (!signer) {
			throw new Error('Signer not available for authorization');
		}

		// Create a signer function compatible with blossom-client-sdk
		const signerFn = async (/** @type {any} */ event) => {
			return await signer.signEvent(event);
		};

		// Create Blossom client and upload
		const client = new BlossomClient(runtimeConfig.blossom.serverUrl, signerFn);
		const blob = await client.uploadBlob(file);
		
		return blob.url;
	}

	/**
	 * Handle image file selection
	 * @param {Event} event
	 */
	async function handleImageUpload(event) {
		const target = /** @type {HTMLInputElement} */ (event.target);
		const file = target.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			errors.image = m.avatar_uploader_error_invalid_file();
			return;
		}

		// Validate file size
		if (file.size > runtimeConfig.blossom.maxFileSize) {
			errors.image = m.avatar_uploader_error_too_large({size: Math.round(runtimeConfig.blossom.maxFileSize / (1024 * 1024))});
			return;
		}

		try {
			uploadingImage = true;
			errors.image = '';

			// Create preview
			const reader = new FileReader();
			reader.onload = (e) => {
				const result = e.target?.result;
				imagePreview = typeof result === 'string' ? result : null;
			};
			reader.readAsDataURL(file);

			// Upload to Blossom
			const imageUrl = await uploadImageToBlossom(file);
			userData.picture = imageUrl;
		} catch (error) {
			console.error('Image upload failed:', error);
			errors.image = m.avatar_uploader_error_upload_failed();
			imagePreview = null;
		} finally {
			uploadingImage = false;
		}
	}

	/**
	 * Trigger file input click
	 */
	function triggerUpload() {
		fileInputRef?.click();
	}
</script>

<div class="form-control">
	<label class="label" for="avatar-upload-input">
		<span class="label-text">{m.avatar_uploader_label()}</span>
	</label>
	
	<!-- Avatar Upload Container -->
	<div class="flex flex-col items-center gap-4">
		<!-- Circular Avatar with Upload Button -->
		<div class="relative">
			<!-- Avatar Circle -->
			<div class="w-32 h-32 rounded-full overflow-hidden bg-base-300 border-4 border-base-200 shadow-lg">
				{#if uploadingImage}
					<!-- Loading State -->
					<div class="w-full h-full flex flex-col items-center justify-center bg-base-300/90">
						<span class="loading loading-spinner loading-lg"></span>
						<span class="text-xs mt-2 opacity-70">{m.avatar_uploader_uploading()}</span>
					</div>
				{:else if userData.picture || imagePreview}
					<!-- Image Preview -->
					<img 
						src={userData.picture || imagePreview} 
						alt="Profile" 
						class="w-full h-full object-cover"
					/>
				{:else}
					<!-- Empty State Placeholder -->
					<div class="w-full h-full flex items-center justify-center text-base-content/30">
						<svg 
							class="w-16 h-16" 
							fill="none" 
							stroke="currentColor" 
							viewBox="0 0 24 24"
						>
							<path 
								stroke-linecap="round" 
								stroke-linejoin="round" 
								stroke-width="1.5"
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							/>
						</svg>
					</div>
				{/if}
			</div>

			<!-- Upload Button (Bottom-Right) -->
			<button
				type="button"
				onclick={triggerUpload}
				disabled={uploadingImage}
				class="absolute bottom-0 right-0 btn btn-circle btn-primary btn-sm shadow-lg hover:scale-110 transition-transform"
				class:opacity-50={uploadingImage}
			>
				<CameraIcon class="w-4 h-4" />
			</button>
		</div>

		<!-- Hidden File Input -->
		<input
			id="avatar-upload-input"
			bind:this={fileInputRef}
			type="file"
			accept="image/*"
			class="hidden"
			onchange={handleImageUpload}
			disabled={uploadingImage}
		/>

		<!-- Helper Text -->
		<div class="text-center">
			<p class="text-xs opacity-70">
				{m.avatar_uploader_help_text()}
			</p>
			<p class="text-xs opacity-70">
				{m.avatar_uploader_max_size({size: Math.round(runtimeConfig.blossom.maxFileSize / (1024 * 1024))})}
			</p>
		</div>
	</div>

	<!-- Error Message -->
	{#if errors.image}
		<div class="label" aria-live="polite">
			<span class="label-text-alt text-error">{errors.image}</span>
		</div>
	{/if}
</div>
