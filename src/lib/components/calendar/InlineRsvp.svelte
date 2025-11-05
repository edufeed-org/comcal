<!--
  InlineRsvp Component
  Inline RSVP interface with segmented button group for quick status selection
-->

<script>
	import { manager } from '$lib/stores/accounts.svelte';
	import { useCalendarActions } from '$lib/stores/calendar-actions.svelte';
	import { showToast } from '$lib/helpers/toast.js';
	import CalendarIcon from '$lib/components/icons/calendar/CalendarIcon.svelte';

	let {
		calendarEvent,
		userRsvpStatus = null,
		communityPubkey = '',
		size = 'md',
		showNote = false,
		compact = false
	} = $props();

	// Local state
	let isSubmitting = $state(false);
	let submittingStatus = $state(null);
	let showNoteField = $state(showNote);
	let rsvpNote = $state('');
	let error = $state('');

	// Get calendar actions
	const calendarActions = useCalendarActions(communityPubkey);

	// Reactive user state
	let activeUser = $state(manager.active);
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

	// Check if user is logged in
	const isLoggedIn = $derived(!!activeUser);

	// Current status for reactive display
	let currentStatus = $state(/** @type {'accepted' | 'tentative' | 'declined' | null} */ (userRsvpStatus));

	// Update current status when prop changes
	$effect(() => {
		currentStatus = /** @type {'accepted' | 'tentative' | 'declined' | null} */ (userRsvpStatus);
	});

	/**
	 * Handle RSVP status change
	 * @param {'accepted' | 'tentative' | 'declined'} status
	 */
	async function handleRsvp(status) {
		if (!isLoggedIn) {
			showToast('Please log in to RSVP', 'error');
			return;
		}

		if (!calendarEvent) {
			showToast('Event data not available', 'error');
			return;
		}

		// Store previous status for rollback on error
		const previousStatus = currentStatus;

		// Optimistic update
		currentStatus = /** @type {'accepted' | 'tentative' | 'declined' | null} */ (status);
		isSubmitting = true;
		submittingStatus = status;
		error = '';

		try {
			await calendarActions.createRsvp(
				calendarEvent,
				status,
				showNoteField ? rsvpNote : ''
			);

			// Success toast
			const statusLabels = {
				accepted: 'Going',
				tentative: 'Maybe',
				declined: 'Not Going'
			};
			showToast(`RSVP updated: ${statusLabels[status]}`, 'success');

			// Clear note after successful submit
			if (showNoteField && rsvpNote) {
				rsvpNote = '';
			}
		} catch (err) {
			console.error('Error creating RSVP:', err);
			// Rollback optimistic update
			currentStatus = previousStatus;
			const errorMsg = err instanceof Error ? err.message : 'Failed to update RSVP';
			error = errorMsg;
			showToast(errorMsg, 'error');
		} finally {
			isSubmitting = false;
			submittingStatus = null;
		}
	}

	/**
	 * Toggle note field visibility
	 */
	function toggleNoteField() {
		showNoteField = !showNoteField;
	}

	// Size classes
	const sizeClasses = /** @type {Record<string, string>} */ ({
		sm: 'btn-sm text-xs',
		md: 'btn-md text-sm',
		lg: 'btn-lg text-base'
	});
	const btnClass = sizeClasses[size] || sizeClasses.md;
</script>

<div class="inline-rsvp {compact ? 'space-y-2' : 'space-y-3'}">
	<!-- RSVP Button Group -->
	<div class="flex flex-col gap-2">
		{#if !isLoggedIn}
			<!-- Not logged in message -->
			<div class="text-sm text-base-content/60 text-center py-2">
				<CalendarIcon class_="w-4 h-4 inline mr-1" />
				Log in to RSVP to this event
			</div>
		{:else}
			<!-- Status Button Group -->
			<div class="btn-group w-full {compact ? 'btn-group-horizontal' : ''}">
				<!-- Going (Accepted) -->
				<button
					type="button"
					onclick={() => handleRsvp('accepted')}
					disabled={isSubmitting}
					class="btn {btnClass} flex-1 transition-all
						{currentStatus === 'accepted'
						? 'btn-success text-white'
						: 'btn-outline btn-success hover:btn-success hover:text-white'}
						{isSubmitting && submittingStatus === 'accepted' ? 'loading' : ''}"
					aria-label="RSVP as Going"
					aria-pressed={currentStatus === 'accepted'}
				>
					{#if isSubmitting && submittingStatus === 'accepted'}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<span class="flex items-center gap-1">
							<span>✓</span>
							<span>Going</span>
						</span>
					{/if}
				</button>

				<!-- Maybe (Tentative) -->
				<button
					type="button"
					onclick={() => handleRsvp('tentative')}
					disabled={isSubmitting}
					class="btn {btnClass} flex-1 transition-all
						{currentStatus === 'tentative'
						? 'btn-warning text-white'
						: 'btn-outline btn-warning hover:btn-warning hover:text-white'}
						{isSubmitting && submittingStatus === 'tentative' ? 'loading' : ''}"
					aria-label="RSVP as Maybe"
					aria-pressed={currentStatus === 'tentative'}
				>
					{#if isSubmitting && submittingStatus === 'tentative'}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<span class="flex items-center gap-1">
							<span>?</span>
							<span>Maybe</span>
						</span>
					{/if}
				</button>

				<!-- Not Going (Declined) -->
				<button
					type="button"
					onclick={() => handleRsvp('declined')}
					disabled={isSubmitting}
					class="btn {btnClass} flex-1 transition-all
						{currentStatus === 'declined'
						? 'btn-error text-white'
						: 'btn-outline btn-error hover:btn-error hover:text-white'}
						{isSubmitting && submittingStatus === 'declined' ? 'loading' : ''}"
					aria-label="RSVP as Not Going"
					aria-pressed={currentStatus === 'declined'}
				>
					{#if isSubmitting && submittingStatus === 'declined'}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<span class="flex items-center gap-1">
							<span>✗</span>
							<span>No</span>
						</span>
					{/if}
				</button>
			</div>

			<!-- Toggle Note Button -->
			{#if !compact}
				<button
					type="button"
					onclick={toggleNoteField}
					class="btn btn-ghost btn-xs self-start"
					disabled={isSubmitting}
				>
					{showNoteField ? '− Hide note' : '+ Add note'}
				</button>
			{/if}

			<!-- Optional Note Field -->
			{#if showNoteField}
				<div class="form-control">
					<textarea
						bind:value={rsvpNote}
						placeholder="Add a message with your RSVP..."
						rows={compact ? 2 : 3}
						disabled={isSubmitting}
						class="textarea textarea-bordered textarea-sm w-full
							bg-base-100 text-base-content
							placeholder-base-content/40
							focus:outline-none focus:border-primary"
					></textarea>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="alert alert-error shadow-lg text-sm py-2">
			<span>{error}</span>
		</div>
	{/if}
</div>

<style>
	/* Ensure smooth transitions for button states */
	.btn {
		transition: all 0.2s ease-in-out;
	}

	/* Override DaisyUI btn-group to ensure proper spacing */
	.btn-group {
		display: flex;
		gap: 0;
	}

	.btn-group > .btn {
		border-radius: 0;
	}

	.btn-group > .btn:first-child {
		border-top-left-radius: 0.5rem;
		border-bottom-left-radius: 0.5rem;
	}

	.btn-group > .btn:last-child {
		border-top-right-radius: 0.5rem;
		border-bottom-right-radius: 0.5rem;
	}

	/* Ensure buttons are equal width */
	.btn-group > .btn {
		flex: 1;
		min-width: 0;
	}
</style>
