<script>
	import { PlusIcon } from '$lib/components/icons';
	import { manager } from '$lib/stores/accounts.svelte';
	import AMBUploadModal from './AMBUploadModal.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {string} communityPubkey - The community pubkey to target
	 */

	/** @type {Props} */
	let { communityPubkey } = $props();

	// Modal state
	let isModalOpen = $state(false);

	/**
	 * Handle creating a new educational resource
	 */
	function handleCreateResource() {
		if (!manager.active) {
			// TODO: Show login modal or toast
			console.warn('User must be logged in to create resources');
			return;
		}
		isModalOpen = true;
	}

	/**
	 * Handle modal close
	 */
	function handleModalClose() {
		isModalOpen = false;
	}

	/**
	 * Handle resource published
	 * @param {string} naddr - The naddr of the published resource
	 */
	function handleResourcePublished(naddr) {
		console.log('📚 Resource published:', naddr);
		// Modal handles navigation, just close it
		isModalOpen = false;
	}
</script>

<!-- Floating Action Button for Educational Resources -->
<div class="fab fixed z-[60] bottom-20 right-6 lg:bottom-6">
	<!-- Main FAB Button -->
	<div
		tabindex="0"
		role="button"
		class="btn btn-lg btn-circle btn-primary shadow-lg hover:shadow-xl"
		aria-label="Open actions menu"
	>
		<PlusIcon class_="h-6 w-6" />
	</div>

	<!-- Create Educational Resource Action -->
	<button
		class="btn btn-lg btn-circle tooltip tooltip-left"
		data-tip="Create Learning Content"
		onclick={handleCreateResource}
		aria-label="Create new learning content"
	>
		<!-- Book/Document icon -->
		<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
			/>
		</svg>
	</button>
</div>

<!-- Educational Resource Upload Modal -->
<AMBUploadModal
	isOpen={isModalOpen}
	{communityPubkey}
	onClose={handleModalClose}
	onPublished={handleResourcePublished}
/>

<style>
	/* FAB container with hover expand */
	.fab {
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 0.75rem;
	}

	/* Hide action buttons by default */
	.fab > button {
		opacity: 0;
		transform: scale(0.8) translateY(10px);
		pointer-events: none;
		transition: all 0.2s ease;
	}

	/* Show action buttons on hover/focus */
	.fab:hover > button,
	.fab:focus-within > button {
		opacity: 1;
		transform: scale(1) translateY(0);
		pointer-events: auto;
	}

	/* Stagger animation for multiple buttons */
	.fab > button:nth-child(2) {
		transition-delay: 0.05s;
	}

	.fab > button:nth-child(3) {
		transition-delay: 0.1s;
	}

	.fab > button:nth-child(4) {
		transition-delay: 0.15s;
	}
</style>
