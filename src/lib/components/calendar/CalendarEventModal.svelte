<!--
  CalendarEventModal Component
  Modal for creating and editing calendar events with form validation
-->

<script>
	import { goto } from '$app/navigation';
	import { validateEventForm, getCurrentTimezone } from '../../helpers/calendar.js';
	import { encodeEventToNaddr } from '../../helpers/nostrUtils.js';
	import { useCalendarActions } from '../../stores/calendar-actions.svelte.js';
	import { useCalendarManagement } from '../../stores/calendar-management-store.svelte.js';
	import { useJoinedCommunitiesList } from '../../stores/joined-communities-list.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import CalendarSelector from './CalendarSelector.svelte';
	import CommunitySelector from './CommunitySelector.svelte';
	import LocationInput from '../shared/LocationInput.svelte';
	import { CloseIcon } from '../icons';

	/**
	 * @typedef {import('../../types/calendar.js').EventFormData} EventFormData
	 * @typedef {import('../../types/calendar.js').EventType} EventType
	 */

	let {
		isOpen = false,
		communityPubkey,
		selectedDate = null,
		mode = 'create',
		existingEvent = null,
		existingRawEvent = null,
		onClose = () => {},
		onEventCreated = () => {}
	} = $props();

	// Get calendar actions
	const calendarActions = useCalendarActions(communityPubkey);

	// Form state
	/** @type {EventFormData} */
	let formData = $state({
		title: '',
		summary: '',
		image: '',
		startDate: '',
		startTime: '09:00',
		endDate: '',
		endTime: '10:00',
		startTimezone: getCurrentTimezone(),
		endTimezone: getCurrentTimezone(),
		location: '',
		isAllDay: false,
		eventType: 'date'
	});

	let validationErrors = /** @type {string[]} */ ([]);
	let isSubmitting = false;
	let submitError = '';

	// Reactive user state
	let activeUser = $state(manager.active);
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

	// Get calendar management and joined communities for authenticated user
	let calendarManagement = $derived(activeUser ? useCalendarManagement(activeUser.pubkey) : null);
	const getJoinedCommunities = useJoinedCommunitiesList();
	const joinedCommunities = $derived(getJoinedCommunities());

	// Calendar and community selection state
	let selectedCalendarIds = $state(/** @type {string[]} */ ([]));
	let selectedCommunityIds = $state(/** @type {string[]} */ ([]));

	// Initialize form when modal opens
	$effect(() => {
		if (isOpen) {
			if (mode === 'edit' && existingEvent) {
				initializeFormForEdit();
			} else {
				initializeForm();
			}
			selectedCalendarIds = [];
			selectedCommunityIds = [];
		}
	});

	/**
	 * Initialize form with default values for creating new event
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
			location: '',
			isAllDay: false,
			eventType: 'date'
		};

		validationErrors = [];
		isSubmitting = false;
		submitError = '';
	}

	/**
	 * Initialize form with existing event data for editing
	 */
	function initializeFormForEdit() {
		if (!existingEvent) return;

		// Convert Unix timestamps to Date objects
		const startDate = new Date(existingEvent.start * 1000);
		const endDate = existingEvent.end ? new Date(existingEvent.end * 1000) : null;
		
		// Determine event type
		const isAllDay = existingEvent.kind === 31922;
		const eventType = isAllDay ? 'date' : 'time';

		// Extract location from event (handle both single string and array formats)
		let location = '';
		if (existingEvent.location) {
			location = existingEvent.location;
		} else if (existingEvent.locations && existingEvent.locations.length > 0) {
			location = existingEvent.locations[0];
		}

		formData = {
			title: existingEvent.title || '',
			summary: existingEvent.summary || '',
			image: existingEvent.image || '',
			startDate: startDate.toISOString().split('T')[0],
			startTime: startDate.toTimeString().slice(0, 5),
			endDate: endDate ? endDate.toISOString().split('T')[0] : '',
			endTime: endDate ? endDate.toTimeString().slice(0, 5) : '10:00',
			startTimezone: existingEvent.startTimezone || getCurrentTimezone(),
			endTimezone: existingEvent.endTimezone || getCurrentTimezone(),
			location: location,
			isAllDay: isAllDay,
			eventType: eventType
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
			let resultEvent = /** @type {any} */ (null);

			if (mode === 'edit' && existingRawEvent) {
				// Update existing event
				resultEvent = await calendarActions.updateEvent(formData, existingRawEvent);
				console.log('Event updated successfully');
				
				onEventCreated();
				handleClose();
			} else {
				// Create new event
				resultEvent = await calendarActions.createEvent(formData, communityPubkey);
				
				// Only proceed with calendar/community operations if event was created successfully
				if (resultEvent && resultEvent.id) {
					// Add event to selected calendars (event already has dTag from createEvent)
					if (calendarManagement && selectedCalendarIds.length > 0) {
						await Promise.all(
							selectedCalendarIds.map(calendarId =>
								calendarManagement.addEventToCalendar(calendarId, resultEvent)
							)
						);
					}
					
					// Share event with selected communities
					if (selectedCommunityIds.length > 0) {
						await Promise.all(
							selectedCommunityIds.map(communityPubkey =>
								calendarActions.createTargetedPublication(resultEvent.id, communityPubkey)
							)
						);
					}
					
					// Generate naddr and navigate to event page
					const naddr = encodeEventToNaddr(resultEvent, []);
					console.log('Navigating to newly created event:', naddr);
					
					onEventCreated();
					handleClose();
					
					// Navigate to the event page
					await goto(`/calendar/event/${naddr}`);
				}
			}
		} catch (error) {
			console.error(`Error ${mode === 'edit' ? 'updating' : 'creating'} event:`, error);
			submitError = error instanceof Error ? error.message : `Failed to ${mode === 'edit' ? 'update' : 'create'} event`;
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
		tabindex="-1"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<div class="modal-box max-w-2xl w-full max-h-screen overflow-y-auto">
			<!-- Modal Header -->
			<div class="flex items-center justify-between mb-4">
				<h2 id="modal-title" class="text-xl font-semibold text-base-content">
					{mode === 'edit' ? 'Edit Event' : 'Create New Event'}
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
					<span class="block text-sm font-medium text-base-content mb-1">Event Type</span>
					<div class="flex bg-base-200 rounded-lg p-1" role="group" aria-label="Event Type">
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

					<!-- Location with Autocomplete -->
					<div class="mb-4">
						<LocationInput 
							bind:value={formData.location}
							label="Location"
							placeholder="Enter location (e.g., Berlin, Germany)"
						/>
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

					<!-- Calendar Selection (Optional) -->
					{#if activeUser && calendarManagement && calendarManagement.calendars.length > 0}
						<div class="mb-4 border-t border-base-300 pt-4">
							<h3 class="mb-2 text-sm font-semibold text-base-content">Add to My Calendars (Optional)</h3>
							<CalendarSelector 
								calendars={calendarManagement.calendars}
								bind:selectedCalendarIds={selectedCalendarIds}
								title="Select Calendars"
								showSelectAll={true}
							/>
						</div>
					{/if}

					<!-- Community Selection (Optional) -->
					{#if activeUser && joinedCommunities.length > 0}
						<div class="mb-4 border-t border-base-300 pt-4">
							<h3 class="mb-2 text-sm font-semibold text-base-content">Share with Communities (Optional)</h3>
							<CommunitySelector 
								communities={joinedCommunities}
								bind:selectedCommunityIds={selectedCommunityIds}
								communitiesWithShares={new Set()}
								title="Select Communities"
								showSelectAll={true}
							/>
						</div>
					{/if}

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
								{mode === 'edit' ? 'Updating...' : 'Creating...'}
							{:else}
								{mode === 'edit' ? 'Update Event' : 'Create Event'}
							{/if}
						</button>
					</div>
				</form>
		</div>
	</div>
{/if}
