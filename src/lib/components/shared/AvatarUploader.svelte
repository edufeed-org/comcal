<script>
	import { appConfig } from '$lib/config.js';
	import CameraIcon from '$lib/components/icons/actions/CameraIcon.svelte';

	let { userData, signer = null, errors = $bindable({}) } = $props();

	// UI state
	let uploadingImage = $state(false);
	let imagePreview = $state(/** @type {string | null} */ (null));
	let fileInputRef = $state(/** @type {HTMLInputElement | null} */ (null));

	/**
	 * Calculate SHA-256 hash of file
	 * @param {File} file
	 * @returns {Promise<string>}
	 */
	async function calculateSHA256(file) {
		const arrayBuffer = await file.arrayBuffer();
		const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		return hashHex;
	}

	/**
	 * Create and sign Blossom authorization event
	 * @param {string} sha256Hash
	 * @param {string} action
	 * @returns {Promise<object>}
	 */
	async function createAuthorizationEvent(sha256Hash, action = 'upload') {
		if (!signer) {
			throw new Error('Signer not available for authorization');
		}

		const event = {
			kind: 24242,
			created_at: Math.floor(Date.now() / 1000),
			tags: [
				['t', action],
				['x', sha256Hash],
				['expiration', String(Math.floor(Date.now() / 1000) + 3600)] // 1 hour expiration
			],
			content: `Upload image to Blossom`
		};

		return await signer.signEvent(event);
	}

	/**
	 * Upload image to Blossom server with authorization
	 * @param {File} file
	 * @returns {Promise<string>} URL of uploaded image
	 */
	async function uploadImageToBlossom(file) {
		// Calculate SHA-256 hash
		const sha256Hash = await calculateSHA256(file);

		// Create and sign authorization event if signer is available
		let authEvent = null;
		if (signer) {
			try {
				authEvent = await createAuthorizationEvent(sha256Hash, 'upload');
			} catch (error) {
				console.warn('Failed to create authorization event, uploading without auth:', error);
			}
		}

		// Prepare form data
		const formData = new FormData();
		formData.append('file', file);

		// Prepare headers
		/** @type {HeadersInit} */
		const headers = {};
		if (authEvent) {
			headers['Authorization'] = `Nostr ${btoa(JSON.stringify(authEvent))}`;
		}

		// Upload to Blossom server
		try {
			const response = await fetch(appConfig.blossom.uploadEndpoint, {
				method: 'PUT',
				headers,
				body: file
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Upload failed: ${response.status} - ${errorText}`);
			}

			const result = await response.json();
			
			// Return the URL from the blob descriptor
			if (result.url) {
				return result.url;
			} else {
				throw new Error('No URL in response');
			}
		} catch (error) {
			console.error('Blossom upload failed:', error);
			throw error;
		}
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
			errors.image = 'Please select a valid image file';
			return;
		}

		// Validate file size
		if (file.size > appConfig.blossom.maxFileSize) {
			errors.image = `Image must be smaller than ${appConfig.blossom.maxFileSize / (1024 * 1024)}MB`;
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
			errors.image = 'Failed to upload image. Please try again.';
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
	<label class="label">
		<span class="label-text">Profile Picture</span>
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
						<span class="text-xs mt-2 opacity-70">Uploading...</span>
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
				Click the camera button to upload an image
			</p>
			<p class="text-xs opacity-70">
				Max size: {appConfig.blossom.maxFileSize / (1024 * 1024)}MB
			</p>
		</div>
	</div>

	<!-- Error Message -->
	{#if errors.image}
		<label class="label">
			<span class="label-text-alt text-error">{errors.image}</span>
		</label>
	{/if}
</div>
