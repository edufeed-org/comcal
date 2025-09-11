<script>
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import LoginModal from './LoginModal.svelte';
	import LoginWithPrivateKey from './LoginWithPrivateKey.svelte';

	/**
	 * ModalManager - Centralized modal rendering component
	 *
	 * This component acts as the single source of truth for modal rendering in the application.
	 * It uses the centralized modal store to determine which modal to display and handles
	 * all modal transitions and interactions.
	 *
	 * Key Features:
	 * - Centralized modal state management
	 * - Clean separation of modal logic from UI components
	 * - Type-safe modal transitions
	 * - Extensible for adding new modal types
	 */

	// Use the modal store
	const modal = modalStore;

	// Generate unique modal IDs for each modal instance
	const loginModalId = 'global-login-modal';
	const privateKeyModalId = 'global-private-key-modal';

	/**
	 * Reactive effect to handle modal opening/closing based on store state
	 * Automatically opens/closes the HTML dialog elements when modal state changes
	 */
	$effect(() => {
		const currentModal = modal.activeModal;
		console.log('ModalManager: Modal state changed to:', currentModal);

		// Close any currently open modals first
		if (currentModal === 'none') {
			const loginModal = /** @type {HTMLDialogElement} */ (document.getElementById(loginModalId));
			const privateKeyModal = /** @type {HTMLDialogElement} */ (document.getElementById(privateKeyModalId));

			if (loginModal && loginModal.open) {
				console.log('ModalManager: Closing login modal');
				loginModal.close();
			}
			if (privateKeyModal && privateKeyModal.open) {
				console.log('ModalManager: Closing private key modal');
				privateKeyModal.close();
			}
		} else if (currentModal === 'login') {
			// Open login modal
			const loginModal = /** @type {HTMLDialogElement} */ (document.getElementById(loginModalId));
			if (loginModal && !loginModal.open) {
				console.log('ModalManager: Opening login modal');
				loginModal.showModal();
			}
		} else if (currentModal === 'privateKey') {
			// Open private key modal
			const privateKeyModal = /** @type {HTMLDialogElement} */ (document.getElementById(privateKeyModalId));
			if (privateKeyModal && !privateKeyModal.open) {
				console.log('ModalManager: Opening private key modal');
				privateKeyModal.showModal();
			}
		}
	});

	/**
	 * Handle modal close events from any modal
	 * Delegates to the modal store to update state
	 */
	function handleModalClose() {
		modal.closeModal();
	}

	/**
	 * Handle NSEC transition from LoginModal to LoginWithPrivateKey
	 * This creates a seamless user experience when switching between login methods
	 */
	function handleNSECTransition() {
		modal.transitionModal('login', 'privateKey');
	}

	/**
	 * Handle successful account creation from LoginWithPrivateKey
	 * Transitions back to login modal to show account options or close flow
	 */
	function handleAccountCreated() {
		modal.transitionModal('privateKey', 'login');
	}
</script>

<!-- Render modals based on active modal state -->
{#if modal.activeModal === 'login'}
	<LoginModal
		modalId={loginModalId}
		onNSECTransition={handleNSECTransition}
	/>
{:else if modal.activeModal === 'privateKey'}
	<LoginWithPrivateKey
		modalId={privateKeyModalId}
		onAccountCreated={handleAccountCreated}
	/>
{/if}
