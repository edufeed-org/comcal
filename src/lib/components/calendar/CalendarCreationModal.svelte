<script>
	import { goto } from '$app/navigation';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	import { useCalendarManagement } from '$lib/stores/calendar-management-store.svelte.js';
	import { useCalendarActions } from '$lib/stores/calendar-actions.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import { CloseIcon, AlertIcon } from '$lib/components/icons';
	import { encodeEventToNaddr } from '$lib/helpers/nostrUtils';
	import { getCalendarRelays } from '$lib/helpers/relay-helper.js';
	import * as m from '$lib/paraglide/messages';

	/**
	 * @typedef {Object} Props
	 * @property {boolean} isOpen - Whether the modal is open
	 * @property {() => void} onClose - Callback when modal closes
	 * @property {() => void} [onCalendarCreated] - Optional callback when calendar is created
	 */

	let { isOpen = false, onClose, onCalendarCreated } = $props();

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
			error = m.calendar_creation_modal_error_title_required();
			return;
		}

		if (!calendarActions) {
			error = m.calendar_creation_modal_error_no_account();
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			// Create calendar using calendar actions (publishes to Nostr)
			const resultCalendar = await calendarActions.createCalendar(
				title.trim(),
				description.trim()
			);

			if (resultCalendar && resultCalendar.id) {
				console.log('Calendar created successfully:', resultCalendar.id);

				// Refresh the calendar management store to show the new calendar
				if (calendarManagement) {
					await calendarManagement.refresh();
				}

				// Generate naddr with relay hints and navigate to calendar page
				const relayHints = getCalendarRelays().slice(0, 3); // Limit to 3 per NIP-19
				const naddr = encodeEventToNaddr(resultCalendar, relayHints);
				console.log('Navigating to newly created calendar:', naddr);

				// Call optional success callback
				if (onCalendarCreated) {
					onCalendarCreated();
				}

				handleClose();

				// Navigate to the calendar page
				await goto(`/calendar/${naddr}`);
			} else {
				error = m.calendar_creation_modal_error_failed();
			}
		} catch (err) {
			console.error('Error creating calendar:', err);
			error = err instanceof Error ? err.message : m.calendar_creation_modal_error_failed();
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

		// Call close callback
		onClose();
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

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="modal modal-open"
		onclick={(e) => {
			if (e.target === e.currentTarget) handleClose();
		}}
	>
		<div class="modal-box max-w-md">
		<!-- Modal Header -->
		<div class="flex items-center justify-between mb-6">
			<h3 class="text-lg font-bold text-base-content">{m.calendar_creation_modal_title()}</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleClose}
				aria-label={m.calendar_creation_modal_close_modal()}
			>
				<CloseIcon class_="h-5 w-5" />
			</button>
		</div>

		<!-- Error Display -->
		{#if error}
			<div class="alert alert-error mb-4">
				<AlertIcon class_="h-5 w-5" />
				<span class="text-sm">{error}</span>
			</div>
		{/if}

		<!-- Form -->
		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Title Field -->
			<div class="form-control">
				<label class="label" for="calendar-title">
					<span class="label-text font-medium">{m.calendar_creation_modal_name_label()}</span>
				</label>
				<input
					id="calendar-title"
					type="text"
					placeholder={m.calendar_creation_modal_name_placeholder()}
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
					<span class="label-text font-medium">{m.calendar_creation_modal_description_label()}</span>
				</label>
				<textarea
					id="calendar-description"
					placeholder={m.calendar_creation_modal_description_placeholder()}
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
					{m.calendar_creation_modal_cancel_button()}
				</button>
				<button
					type="submit"
					class="btn btn-primary flex-1"
					disabled={isSubmitting || !title.trim()}
				>
					{#if isSubmitting}
						<span class="loading loading-spinner loading-sm"></span>
						{m.calendar_creation_modal_creating()}
					{:else}
						{m.calendar_creation_modal_create_button()}
					{/if}
				</button>
			</div>
		</form>
		</div>
	</div>
{/if}
