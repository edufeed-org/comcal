<script>
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { useCalendarManagement } from '$lib/stores/calendar-management-store.svelte.js';
	import { useCalendarActions } from '$lib/stores/calendar-actions.svelte.js';
	import { manager } from '$lib/accounts.svelte.js';

	/**
	 * @typedef {Object} Props
	 * @property {string} [modalId] - Unique ID for the modal dialog
	 */

	let { modalId = 'calendar-creation-modal' } = $props();

	// Form state
	let title = $state('');
	let description = $state('');
	let isSubmitting = $state(false);
	let error = $state('');

	// Get calendar actions for the active user (using empty string as community pubkey for global calendars)
	const calendarActions = manager.active ? useCalendarActions('') : null;

	// Get calendar management store for UI updates
	const calendarManagement = manager.active ? useCalendarManagement(manager.active.pubkey) : null;

	/**
	 * Handle form submission
	 */
	async function handleSubmit() {
		if (!title.trim()) {
			error = 'Calendar title is required';
			return;
		}

		if (!calendarActions) {
			error = 'No active account found';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			// Create calendar using calendar actions (publishes to Nostr)
			const calendarId = await calendarActions.createCalendar(
				title.trim(),
				description.trim()
			);

			if (calendarId) {
				console.log('Calendar created successfully:', calendarId);

				// Refresh the calendar management store to show the new calendar
				if (calendarManagement) {
					await calendarManagement.refresh();
				}

				handleClose();
			} else {
				error = 'Failed to create calendar';
			}
		} catch (err) {
			console.error('Error creating calendar:', err);
			error = err instanceof Error ? err.message : 'Failed to create calendar';
		} finally {
			isSubmitting = false;
		}
	}

	/**
	 * Handle modal close
	 */
	function handleClose() {
		// Reset form state
		title = '';
		description = '';
		error = '';
		isSubmitting = false;

		// Close modal
		modalStore.closeModal();
	}

	/**
	 * Handle form keydown (submit on Enter)
	 * @param {KeyboardEvent} event
	 */
	function handleKeydown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<dialog
	id={modalId}
	class="modal"
	onclick={(e) => {
		if (e.target === e.currentTarget) handleClose();
	}}
>
	<div class="modal-box max-w-md">
		<!-- Modal Header -->
		<div class="flex items-center justify-between mb-6">
			<h3 class="text-lg font-bold text-base-content">Create New Calendar</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleClose}
				aria-label="Close modal"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Error Display -->
		{#if error}
			<div class="alert alert-error mb-4">
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span class="text-sm">{error}</span>
			</div>
		{/if}

		<!-- Form -->
		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Title Field -->
			<div class="form-control">
				<label class="label" for="calendar-title">
					<span class="label-text font-medium">Calendar Title *</span>
				</label>
				<input
					id="calendar-title"
					type="text"
					placeholder="e.g., Work Calendar, Personal Events"
					class="input input-bordered w-full"
					bind:value={title}
					required
					disabled={isSubmitting}
					onkeydown={handleKeydown}
				/>
			</div>

			<!-- Description Field -->
			<div class="form-control">
				<label class="label" for="calendar-description">
					<span class="label-text font-medium">Description</span>
				</label>
				<textarea
					id="calendar-description"
					placeholder="Optional description of your calendar..."
					class="textarea textarea-bordered w-full resize-none"
					rows="3"
					bind:value={description}
					disabled={isSubmitting}
				></textarea>
			</div>

			<!-- Action Buttons -->
			<div class="flex gap-3 pt-4">
				<button
					type="button"
					class="btn btn-ghost flex-1"
					onclick={handleClose}
					disabled={isSubmitting}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="btn btn-primary flex-1"
					disabled={isSubmitting || !title.trim()}
				>
					{#if isSubmitting}
						<span class="loading loading-spinner loading-sm"></span>
						Creating...
					{:else}
						Create Calendar
					{/if}
				</button>
			</div>
		</form>
	</div>
</dialog>
