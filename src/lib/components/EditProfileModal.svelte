<script>
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte.js';
	import ProfileForm from './shared/ProfileForm.svelte';
	import AvatarUploader from './shared/AvatarUploader.svelte';
	import { publishEvent } from '$lib/helpers/publisher.js';
	import { appConfig } from '$lib/config.js';
	import * as m from '$lib/paraglide/messages';
	
	let { modalId = 'edit-profile-modal' } = $props();
	
	// Get profile data from modal props
	const modalProps = $derived(/** @type {any} */ (modalStore.modalProps));
	const profile = $derived(modalProps.profile || {});
	const pubkey = $derived(modalProps.pubkey);
	
	// Initialize form data with current profile values
	let userData = $state(/** @type {any} */ ({
		name: profile.name || '',
		display_name: profile.display_name || '',
		about: profile.about || '',
		picture: profile.picture || '',
		banner: profile.banner || '',
		website: profile.website || '',
		nip05: profile.nip05 || '',
		lud16: profile.lud16 || ''
	}));
	
	let errors = $state(/** @type {any} */ ({}));
	let isSubmitting = $state(false);
	let submitError = $state('');
	let submitSuccess = $state(false);
	
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
			if (modalStore.activeModal === 'profile') {
				console.log('EditProfileModal: Dialog closed, syncing with store');
				modalStore.closeModal();
			}
		};

		dialog.addEventListener('close', handleDialogClose);
		return () => {
			dialog.removeEventListener('close', handleDialogClose);
		};
	});
	
	/**
	 * Validate form data
	 */
	function validate() {
		errors = {};
		
		if (!userData.name?.trim()) {
			errors.name = m.profile_edit_modal_error_name_required();
			return false;
		}
		
		// Validate URLs if provided
		if (userData.website && userData.website.trim()) {
			try {
				new URL(userData.website);
			} catch {
				errors.website = m.profile_edit_modal_error_invalid_url();
				return false;
			}
		}
		
		if (userData.picture && userData.picture.trim()) {
			try {
				new URL(userData.picture);
			} catch {
				errors.picture = m.profile_edit_modal_error_invalid_image_url();
				return false;
			}
		}
		
		if (userData.banner && userData.banner.trim()) {
			try {
				new URL(userData.banner);
			} catch {
				errors.banner = m.profile_edit_modal_error_invalid_image_url();
				return false;
			}
		}
		
		return true;
	}
	
	/**
	 * Handle form submission
	 */
	async function handleSubmit() {
		submitError = '';
		submitSuccess = false;
		
		// Validate form
		if (!validate()) {
			return;
		}
		
		// Check if user is logged in
		if (!manager.active) {
			submitError = m.profile_edit_modal_error_must_login();
			return;
		}
		
		// Verify ownership
		if (manager.active.pubkey !== pubkey) {
			submitError = m.profile_edit_modal_error_ownership();
			return;
		}
		
		isSubmitting = true;
		
		try {
			// Create profile content object (only include non-empty fields)
			const profileContent = {};
			if (userData.name) profileContent.name = userData.name;
			if (userData.display_name) profileContent.display_name = userData.display_name;
			if (userData.about) profileContent.about = userData.about;
			if (userData.picture) profileContent.picture = userData.picture;
			if (userData.banner) profileContent.banner = userData.banner;
			if (userData.website) profileContent.website = userData.website;
			if (userData.nip05) profileContent.nip05 = userData.nip05;
			if (userData.lud16) profileContent.lud16 = userData.lud16;
			
			// Create Kind 0 event (profile metadata)
			const event = {
				kind: 0,
				created_at: Math.floor(Date.now() / 1000),
				tags: [],
				content: JSON.stringify(profileContent),
				pubkey: manager.active.pubkey
			};
			
			// Sign the event
			const signedEvent = await manager.active.signer.signEvent(event);
			
			// Publish to relays
			const result = await publishEvent(signedEvent, {
				relays: appConfig.calendar.defaultRelays,
				addToStore: true,
				logPrefix: 'EditProfile'
			});
			
			if (result.success) {
				console.log('Profile updated successfully');
				submitSuccess = true;
				
				// Close modal after a brief delay to show success message
				setTimeout(() => {
					modalStore.closeModal();
				}, 1000);
			} else {
				throw new Error('Failed to publish profile update to any relay');
			}
			
		} catch (error) {
			console.error('Error updating profile:', error);
			submitError = error instanceof Error ? error.message : m.profile_edit_modal_error_failed();
		} finally {
			isSubmitting = false;
		}
	}
	
	/**
	 * Handle modal close
	 */
	function handleClose() {
		if (!isSubmitting) {
			modalStore.closeModal();
		}
	}
</script>

<dialog id={modalId} class="modal">
	<div class="modal-box max-w-2xl">
		<!-- Modal Header -->
		<div class="flex items-center justify-between mb-6">
			<h3 class="font-bold text-2xl">{m.profile_edit_modal_title()}</h3>
			<button 
				onclick={handleClose}
				class="btn btn-sm btn-circle btn-ghost"
				disabled={isSubmitting}
			>
				✕
			</button>
		</div>
		
		<!-- Success Message -->
		{#if submitSuccess}
			<div class="alert alert-success mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{m.profile_edit_modal_success()}</span>
			</div>
		{/if}
		
		<!-- Error Message -->
		{#if submitError}
			<div class="alert alert-error mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{submitError}</span>
			</div>
		{/if}
		
		<!-- Profile Form -->
		<div class="space-y-6">
			<!-- Avatar Uploader (centered) -->
			<div class="flex flex-col items-center">
				<AvatarUploader 
					{userData} 
					signer={manager.active?.signer} 
					bind:errors 
				/>
			</div>
			
			<!-- Form Fields (centered with max-width) -->
			<div class="flex flex-col items-center w-full">
				<div class="w-full max-w-md space-y-4">
					<ProfileForm {userData} bind:errors />
				</div>
			</div>
		</div>
		
		<!-- Modal Actions -->
		<div class="modal-action">
			<button 
				onclick={handleClose}
				class="btn btn-ghost"
				disabled={isSubmitting}
			>
				{m.profile_edit_modal_cancel_button()}
			</button>
			<button 
				onclick={handleSubmit}
				class="btn btn-primary"
				disabled={isSubmitting}
			>
				{#if isSubmitting}
					<span class="loading loading-spinner loading-sm"></span>
					{m.profile_edit_modal_saving()}
				{:else}
					{m.profile_edit_modal_save_button()}
				{/if}
			</button>
		</div>
	</div>
	
	<!-- Modal backdrop -->
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleClose} disabled={isSubmitting}>close</button>
	</form>
</dialog>
