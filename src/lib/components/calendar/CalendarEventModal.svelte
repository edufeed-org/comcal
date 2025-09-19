<!--
  CalendarEventModal Component
  Modal for creating and editing calendar events with form validation
-->

<script>
	import { validateEventForm, getCurrentTimezone } from '../../helpers/calendar.js';
	import { useCalendarActions } from '../../stores/calendar-actions.svelte.js';
	import { CloseIcon } from '../icons';

	/**
	 * @typedef {import('../../types/calendar.js').EventFormData} EventFormData
	 * @typedef {import('../../types/calendar.js').EventType} EventType
	 */

	/** @type {boolean} */
	export let isOpen = false;
	
	/** @type {string} */
	export let communityPubkey;
	
	/** @type {Date | null} */
	export let selectedDate = null;
	
	/** @type {function(): void} */
	export let onClose = () => {};
	
	/** @type {function(): void} */
	export let onEventCreated = () => {};

	// Get calendar actions
	const calendarActions = useCalendarActions(communityPubkey);

	// Form state
	/** @type {EventFormData} */
	let formData = {
		title: '',
		summary: '',
		image: '',
		startDate: '',
		startTime: '09:00',
		endDate: '',
		endTime: '10:00',
		startTimezone: getCurrentTimezone(),
		endTimezone: getCurrentTimezone(),
		locations: [''],
		isAllDay: false,
		eventType: 'date'
	};

	let validationErrors = /** @type {string[]} */ ([]);
	let isSubmitting = false;
	let submitError = '';

	// Initialize form when modal opens
	$: if (isOpen) {
		initializeForm();
	}

	/**
	 * Initialize form with default values
	 */
	function initializeForm() {
		const today = selectedDate || new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		formData = {
			title: '',
			summary: '',
			image: '',
			startDate: today.toISOString().split('T')[0],
			startTime: '09:00',
			endDate: tomorrow.toISOString().split('T')[0],
			endTime: '10:00',
			startTimezone: getCurrentTimezone(),
			endTimezone: getCurrentTimezone(),
			locations: [''],
			isAllDay: false,
			eventType: 'date'
		};

		validationErrors = [];
		isSubmitting = false;
		submitError = '';
	}

	/**
	 * Handle event type change
	 * @param {EventType} newType
	 */
	function handleEventTypeChange(newType) {
		formData.eventType = newType;
		formData.isAllDay = newType === 'date';
	}

	/**
	 * Add a new location field
	 */
	function addLocation() {
		formData.locations = [...formData.locations, ''];
	}

	/**
	 * Remove a location field
	 * @param {number} index
	 */
	function removeLocation(index) {
		if (formData.locations.length > 1) {
			formData.locations = formData.locations.filter((_, i) => i !== index);
		}
	}

	/**
	 * Handle form submission
	 * @param {Event} e
	 */
	async function handleSubmit(e) {
		e.preventDefault();
		
		// Validate form
		validationErrors = validateEventForm(formData);
		if (validationErrors.length > 0) {
			return;
		}

		isSubmitting = true;
		submitError = '';

		try {
			await calendarActions.createEvent(formData, communityPubkey);
			onEventCreated();
			handleClose();
		} catch (error) {
			console.error('Error creating event:', error);
			submitError = error instanceof Error ? error.message : 'Failed to create event';
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
</script>

<!-- Modal Backdrop -->
{#if isOpen}
	<div
		class="modal modal-open"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<div class="modal-box max-w-2xl w-full max-h-screen overflow-y-auto">
			<!-- Modal Header -->
			<div class="flex items-center justify-between mb-4">
				<h2 id="modal-title" class="text-xl font-semibold text-base-content">
					Create New Event
				</h2>
				<button
					class="btn btn-sm btn-circle btn-ghost"
					onclick={handleClose}
					aria-label="Close modal"
				>
					<CloseIcon class_="w-6 h-6" />
				</button>
			</div>

			<!-- Modal Body -->
			<form onsubmit={handleSubmit}>
				<!-- Event Type Selector -->
				<div class="mb-4">
					<label class="block text-sm font-medium text-base-content mb-1">Event Type</label>
					<div class="flex bg-base-200 rounded-lg p-1">
						<button
							type="button"
							class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 {formData.eventType === 'date' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content hover:bg-base-300'}"
							onclick={() => handleEventTypeChange('date')}
						>
							All Day Event
						</button>
						<button
							type="button"
							class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 {formData.eventType === 'time' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content hover:bg-base-300'}"
							onclick={() => handleEventTypeChange('time')}
						>
							Timed Event
						</button>
					</div>
				</div>

				<!-- Event Title -->
				<div class="mb-4">
					<label for="title" class="block text-sm font-medium text-base-content mb-1">
						Event Title <span class="text-error">*</span>
					</label>
					<input
						id="title"
						type="text"
						class="input input-bordered w-full"
						bind:value={formData.title}
						placeholder="Enter event title"
						required
					/>
				</div>

				<!-- Event Description -->
				<div class="mb-4">
					<label for="summary" class="block text-sm font-medium text-base-content mb-1">Description</label>
					<textarea
						id="summary"
						class="textarea textarea-bordered w-full resize-vertical"
						bind:value={formData.summary}
						placeholder="Enter event description"
						rows="3"
					></textarea>
				</div>

					<!-- Date and Time -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
						<div class="mb-4">
							<label for="startDate" class="block text-sm font-medium text-base-content mb-1">
								Start Date <span class="text-error">*</span>
							</label>
							<input
								id="startDate"
								type="date"
								class="input input-bordered w-full"
								bind:value={formData.startDate}
								required
							/>
						</div>

						{#if formData.eventType === 'time'}
							<div class="mb-4">
								<label for="startTime" class="block text-sm font-medium text-base-content mb-1">
									Start Time <span class="text-error">*</span>
								</label>
								<input
									id="startTime"
									type="time"
									class="input input-bordered w-full"
									bind:value={formData.startTime}
									required
								/>
							</div>
						{/if}
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
						<div class="mb-4">
							<label for="endDate" class="block text-sm font-medium text-base-content mb-1">End Date</label>
							<input
								id="endDate"
								type="date"
								class="input input-bordered w-full"
								bind:value={formData.endDate}
							/>
						</div>

						{#if formData.eventType === 'time'}
							<div class="mb-4">
								<label for="endTime" class="block text-sm font-medium text-base-content mb-1">End Time</label>
								<input
									id="endTime"
									type="time"
									class="input input-bordered w-full"
									bind:value={formData.endTime}
								/>
							</div>
						{/if}
					</div>

					<!-- Locations -->
					<div class="mb-4">
						<label class="block text-sm font-medium text-base-content mb-1">Locations</label>
						{#each formData.locations as location, index}
							<div class="flex gap-2 mb-2">
								<input
									type="text"
									class="input input-bordered flex-1"
									bind:value={formData.locations[index]}
									placeholder="Enter location"
								/>
								{#if formData.locations.length > 1}
									<button
										type="button"
										class="btn btn-sm btn-error"
										onclick={() => removeLocation(index)}
										aria-label="Remove location"
									>
										<CloseIcon class_="w-4 h-4" />
									</button>
								{/if}
							</div>
						{/each}
						<button
							type="button"
							class="btn btn-sm btn-primary"
							onclick={addLocation}
						>
							Add Location
						</button>
					</div>

					<!-- Event Image -->
					<div class="mb-4">
						<label for="image" class="block text-sm font-medium text-base-content mb-1">Event Image URL</label>
						<input
							id="image"
							type="url"
							class="input input-bordered w-full"
							bind:value={formData.image}
							placeholder="https://example.com/image.jpg"
						/>
					</div>

					<!-- Validation Errors -->
					{#if validationErrors.length > 0}
						<div class="alert alert-error mb-4">
							{#each validationErrors as error}
								<div class="text-sm">{error}</div>
							{/each}
						</div>
					{/if}

					<!-- Submit Error -->
					{#if submitError}
						<div class="alert alert-error mb-4">
							<div class="text-sm">{submitError}</div>
						</div>
					{/if}

					<!-- Form Actions -->
					<div class="flex justify-end gap-3 pt-4 border-t border-base-300">
						<button
							type="button"
							class="btn btn-outline"
							onclick={handleClose}
							disabled={isSubmitting}
						>
							Cancel
						</button>
						<button
							type="submit"
							class="btn btn-primary"
							disabled={isSubmitting}
						>
							{#if isSubmitting}
								Creating...
							{:else}
								Create Event
							{/if}
						</button>
					</div>
				</form>
		</div>
	</div>
{/if}
