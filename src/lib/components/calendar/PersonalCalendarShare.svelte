<!--
  PersonalCalendarShare Component
  Manages adding/removing calendar events to/from personal calendars
  Features:
  - Automatically checks which calendars contain the event
  - Shows correct checkbox states
  - Handles add/remove operations
  - Built-in debug logging
  - Supports compact mode for different layouts
  - Uses loader/model pattern for reactive calendar loading
-->

<script>
	import { manager } from '$lib/stores/accounts.svelte';
	import { registerCalendarEventsRefreshCallback } from '../../stores/calendar-management-store.svelte.js';
	import { PlusIcon, CheckIcon, AlertIcon } from '../icons';
	import { userCalendarLoader } from '$lib/loaders';
	import { eventStore } from '$lib/stores/nostr-infrastructure.svelte';
	import { getCalendarEventTitle } from 'applesauce-common/helpers';
	import { EventFactory } from 'applesauce-core/event-factory';
	import { publishEvent } from '$lib/services/publish-service.js';

	/**
	 * @typedef {Object} Calendar
	 * @property {string} id - Event ID
	 * @property {string} pubkey - Calendar owner pubkey
	 * @property {number} kind - Event kind (31924)
	 * @property {string} title - Calendar title
	 * @property {string} description - Calendar description
	 * @property {string} dTag - Unique identifier (d-tag)
	 * @property {string[]} eventReferences - Array of event references (a-tags)
	 * @property {number} createdAt - Creation timestamp
	 */

	/**
	 * @typedef {Object} Props
	 * @property {any} event - Calendar event to share
	 * @property {any} activeUser - Current active user
	 * @property {boolean} [compact=false] - Use compact layout for dropdowns
	 */

	/** @type {Props} */
	let { event, activeUser, compact = false } = $props();

	// Calendar state using loader/model pattern
	let calendars = $state(/** @type {Calendar[]} */ ([]));
	let loading = $state(false);
	let error = $state(/** @type {string | null} */ (null));
	let loadedCalendars = new Map();

	// Load calendars using proper loader/model pattern
	$effect(() => {
		if (!activeUser) {
			calendars = [];
			loading = false;
			error = null;
			return;
		}

		loading = true;
		error = null;
		loadedCalendars.clear();

		const loaderSub = userCalendarLoader(activeUser.pubkey)().subscribe();
		const modelSub = eventStore.timeline({
			kinds: [31924],
			authors: [activeUser.pubkey]
		}).subscribe((events) => {
			let hasNew = false;
			for (const evt of events || []) {
				if (!loadedCalendars.has(evt.id)) {
					const calendar = convertEventToCalendar(evt);
					loadedCalendars.set(evt.id, calendar);
					hasNew = true;
				}
			}
			if (hasNew) {
				calendars = Array.from(loadedCalendars.values());
			}
			loading = false;
		});

		return () => {
			loaderSub.unsubscribe();
			modelSub.unsubscribe();
		};
	});

	/**
	 * Convert event to Calendar object
	 * @param {any} evt - Calendar event
	 * @returns {Calendar} Calendar object
	 */
	function convertEventToCalendar(evt) {
		/** @type {Calendar} */
		const calendar = {
			id: evt.id || '',
			pubkey: evt.pubkey || '',
			kind: evt.kind,
			title: getCalendarEventTitle(evt) || 'Untitled Calendar',
			description: evt.content || '',
			dTag: '',
			eventReferences: [],
			createdAt: evt.created_at || 0
		};

		// Extract data from tags
		if (evt.tags) {
			evt.tags.forEach(/** @param {any[]} tag */ tag => {
				switch (tag[0]) {
					case 'd':
						calendar.dTag = tag[1] || '';
						break;
					case 'a':
						if (tag[1]) calendar.eventReferences.push(tag[1]);
						break;
				}
			});
		}

		return calendar;
	}

	// State management
	let selectedCalendarIds = $state(/** @type {string[]} */ ([]));
	let isProcessingChanges = $state(false);
	let calendarChangesError = $state('');
	let calendarChangesSuccess = $state(false);

	/**
	 * Generate event reference for NIP-52 (addressable format)
	 * Handles missing dTag by extracting from originalEvent or generating one
	 * @param {any} evt
	 * @returns {string | null}
	 */
	function getEventReference(evt) {
		console.log('📅 PersonalCalendarShare: Checking event reference for:', evt?.title || 'Unknown');
		
		if (!evt || !evt.kind || !evt.pubkey) {
			console.warn('📅 PersonalCalendarShare: Missing required event properties (kind or pubkey)');
			return null;
		}

		// Try to get dTag from event
		let dTag = evt.dTag;
		
		// If no dTag, try to extract from originalEvent tags
		if (!dTag && evt.originalEvent?.tags) {
			const dTagArray = evt.originalEvent.tags.find((/** @type {string[]} */ t) => t[0] === 'd');
			dTag = dTagArray?.[1];
			console.log('📅 PersonalCalendarShare: Extracted dTag from originalEvent:', dTag);
		}
		
		// If still no dTag, generate one from event ID
		if (!dTag && evt.id) {
			dTag = `event-${evt.id.slice(0, 8)}`;
			console.log('📅 PersonalCalendarShare: Generated dTag from event ID:', dTag);
		}

		if (!dTag) {
			console.warn('📅 PersonalCalendarShare: Unable to determine dTag for event');
			return null;
		}

		const reference = `${evt.kind}:${evt.pubkey}:${dTag}`;
		console.log('📅 PersonalCalendarShare: Event reference:', reference);
		return reference;
	}

	/**
	 * Check which calendars already contain this event
	 * Returns a Set of calendar IDs
	 */
	let calendarsContainingEvent = $derived(() => {
		if (!calendars.length || !event) {
			console.log('📅 PersonalCalendarShare: No calendars or event');
			return new Set();
		}

		const eventRef = getEventReference(event);
		if (!eventRef) {
			console.log('📅 PersonalCalendarShare: No event reference available');
			return new Set();
		}

		const containingCalendars = calendars
			.filter((calendar) => {
				const contains = calendar.eventReferences.includes(eventRef);
				if (contains) {
					console.log(`📅 PersonalCalendarShare: Calendar "${calendar.title}" contains event`);
				}
				return contains;
			})
			.map((calendar) => calendar.id);

		console.log(`📅 PersonalCalendarShare: Found ${containingCalendars.length} calendars containing event`);
		return new Set(containingCalendars);
	});

	/**
	 * Toggle calendar selection
	 * @param {string} calendarId
	 */
	function toggleCalendarSelection(calendarId) {
		if (selectedCalendarIds.includes(calendarId)) {
			selectedCalendarIds = selectedCalendarIds.filter((id) => id !== calendarId);
		} else {
			selectedCalendarIds = [...selectedCalendarIds, calendarId];
		}
		console.log('📅 PersonalCalendarShare: Selected calendars:', selectedCalendarIds);
	}

	/**
	 * Select all calendars that don't already contain the event
	 */
	function selectAllCalendars() {
		const availableCalendars = calendars
			.filter((calendar) => !calendarsContainingEvent().has(calendar.id))
			.map((calendar) => calendar.id);
		selectedCalendarIds = availableCalendars;
		console.log('📅 PersonalCalendarShare: Selected all available calendars:', availableCalendars);
	}

	/**
	 * Deselect all calendars
	 */
	function deselectAllCalendars() {
		selectedCalendarIds = [];
		console.log('📅 PersonalCalendarShare: Deselected all calendars');
	}

	/**
	 * Add an event to a calendar following NIP-52 specification
	 * @param {string} calendarId - Calendar ID to add the event to
	 * @param {any} event - Calendar event to add (must have id, pubkey, kind, and dTag)
	 * @returns {Promise<boolean>} Success status
	 */
	async function addEventToCalendar(calendarId, event) {
		try {
			// Find the calendar to update
			const calendar = calendars.find(c => c.id === calendarId);
			if (!calendar) {
				throw new Error('Calendar not found');
			}

			// Check if event is already in the calendar
			const eventReference = `${event.kind}:${event.pubkey}:${event.dTag}`;
			if (calendar.eventReferences.includes(eventReference)) {
				console.log('📅 PersonalCalendarShare: Event already in calendar');
				return true;
			}

			// Create new calendar event with updated event references
			const updatedEventReferences = [...calendar.eventReferences, eventReference];

			// Build tags for the updated calendar
			const tags = [
				['d', calendar.dTag],
				['title', calendar.title]
			];

			// Add all existing event references as 'a' tags
			updatedEventReferences.forEach(ref => {
				tags.push(['a', ref]);
			});

			// Create the updated calendar event using EventFactory
			const eventFactory = new EventFactory();
			const eventTemplate = await eventFactory.build({
				kind: 31924,
				content: calendar.description,
				tags: tags
			});

			// Sign the event
			const signedEvent = await activeUser.signEvent(eventTemplate);

			// Publish using outbox model + app relays
			const publishResult = await publishEvent(signedEvent, []);

			if (publishResult.success) {
				// Add to event store for local caching
				eventStore.add(signedEvent);

				console.log('📅 PersonalCalendarShare: Successfully added event to calendar:', calendar.title);
				return true;
			} else {
				throw new Error('Failed to publish calendar update to any relay');
			}
		} catch (error) {
			console.error('Error adding event to calendar:', error);
			return false;
		}
	}

	/**
	 * Remove an event from a calendar following NIP-52 specification
	 * @param {string} calendarId - Calendar ID to remove the event from
	 * @param {any} event - Calendar event to remove (must have id, pubkey, kind, and dTag)
	 * @returns {Promise<boolean>} Success status
	 */
	async function removeEventFromCalendar(calendarId, event) {
		try {
			// Find the calendar to update
			const calendar = calendars.find(c => c.id === calendarId);
			if (!calendar) {
				throw new Error('Calendar not found');
			}

			// Check if event is in the calendar
			const eventReference = `${event.kind}:${event.pubkey}:${event.dTag}`;
			if (!calendar.eventReferences.includes(eventReference)) {
				console.log('📅 PersonalCalendarShare: Event not in calendar');
				return true;
			}

			// Create new calendar event with updated event references (remove the event)
			const updatedEventReferences = calendar.eventReferences.filter(ref => ref !== eventReference);

			// Build tags for the updated calendar
			const tags = [
				['d', calendar.dTag],
				['title', calendar.title]
			];

			// Add all remaining event references as 'a' tags
			updatedEventReferences.forEach(ref => {
				tags.push(['a', ref]);
			});

			// Create the updated calendar event using EventFactory
			const eventFactory = new EventFactory();
			const eventTemplate = await eventFactory.build({
				kind: 31924,
				content: calendar.description,
				tags: tags
			});

			// Sign the event
			const signedEvent = await activeUser.signEvent(eventTemplate);

			// Publish using outbox model + app relays
			const publishResult = await publishEvent(signedEvent, []);

			if (publishResult.success) {
				// Add to event store for local caching
				eventStore.add(signedEvent);

				console.log('📅 PersonalCalendarShare: Successfully removed event from calendar:', calendar.title);
				return true;
			} else {
				throw new Error('Failed to publish calendar update to any relay');
			}
		} catch (error) {
			console.error('Error removing event from calendar:', error);
			return false;
		}
	}

	/**
	 * Handle applying calendar changes (add/remove events)
	 */
	async function handleApplyCalendarChanges() {
		if (selectedCalendarIds.length === 0 || !activeUser || !event) {
			console.log('📅 PersonalCalendarShare: Nothing to apply');
			return;
		}

		isProcessingChanges = true;
		calendarChangesError = '';
		calendarChangesSuccess = false;

		console.log(`📅 PersonalCalendarShare: Applying changes to ${selectedCalendarIds.length} calendars`);

		try {
			// Ensure event has a dTag
			const eventRef = getEventReference(event);
			if (!eventRef) {
				throw new Error('Cannot process event: missing required properties');
			}

			// Extract dTag from the reference
			const parts = eventRef.split(':');
			const dTag = parts[2];

			const eventWithDTag = {
				...event,
				dTag: dTag
			};

			console.log('📅 PersonalCalendarShare: Event prepared with dTag:', dTag);

			// Process each selected calendar
			const results = await Promise.allSettled(
				selectedCalendarIds.map(async (calendarId) => {
					const isAlreadyInCalendar = calendarsContainingEvent().has(calendarId);
					const calendar = calendars.find((c) => c.id === calendarId);

					if (isAlreadyInCalendar) {
						console.log(`📅 PersonalCalendarShare: Removing event from calendar "${calendar?.title}"`);
						return await removeEventFromCalendar(calendarId, eventWithDTag);
					} else {
						console.log(`📅 PersonalCalendarShare: Adding event to calendar "${calendar?.title}"`);
						return await addEventToCalendar(calendarId, eventWithDTag);
					}
				})
			);

			// Check results
			const successful = results.filter(
				(result) => result.status === 'fulfilled' && result.value === true
			).length;

			console.log(`📅 PersonalCalendarShare: ${successful}/${results.length} operations successful`);

			if (successful > 0) {
				calendarChangesSuccess = true;
				selectedCalendarIds = []; // Reset selection
				console.log('📅 PersonalCalendarShare: Calendar changes applied successfully');
			} else {
				calendarChangesError = 'Failed to apply changes to any calendar';
			}
		} catch (error) {
			console.error('📅 PersonalCalendarShare: Error applying changes:', error);
			calendarChangesError =
				error instanceof Error ? error.message : 'Failed to apply calendar changes';
		} finally {
			isProcessingChanges = false;
		}
	}
</script>

<!-- Calendar Selection UI -->
<div class="personal-calendar-share" class:compact>
	<div class="mb-3">
		<div class="mb-2 flex items-center justify-between">
			<label class="block text-sm font-medium text-base-content">
				{compact ? 'Personal Calendars' : 'Select Calendars'}
			</label>
			{#if calendars.length > 1}
				<div class="flex gap-2">
					<button
						class="btn btn-ghost btn-xs"
						onclick={selectAllCalendars}
						disabled={selectedCalendarIds.length === calendars.length}
					>
						Select All
					</button>
					<button
						class="btn btn-ghost btn-xs"
						onclick={deselectAllCalendars}
						disabled={selectedCalendarIds.length === 0}
					>
						Deselect All
					</button>
				</div>
			{/if}
		</div>

		<!-- Calendar Checkboxes -->
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<span class="loading loading-spinner {compact ? 'loading-sm' : 'loading-md'}"></span>
			</div>
		{:else if calendars.length > 0}
			<div class="max-h-40 overflow-y-auto rounded-lg border border-base-300 p-3">
				{#each calendars as calendar}
					{@const isAlreadyInCalendar = calendarsContainingEvent().has(calendar.id)}
					{@const isSelected = selectedCalendarIds.includes(calendar.id)}
					<label class="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-base-200">
						<input
							type="checkbox"
							class="checkbox checkbox-primary {compact ? 'checkbox-sm' : ''}"
							checked={isSelected || isAlreadyInCalendar}
							onchange={() => toggleCalendarSelection(calendar.id)}
						/>
						<span class="font-medium {compact ? 'text-sm' : ''}">{calendar.title}</span>
						{#if calendar.description && !compact}
							<span class="truncate text-xs text-base-content/60">{calendar.description}</span>
						{/if}
						{#if isAlreadyInCalendar && !isSelected}
							<span class="text-xs font-medium text-success">(Added - click to remove)</span>
						{:else if isAlreadyInCalendar && isSelected}
							<span class="text-xs font-medium text-warning">(Will be removed)</span>
						{:else if isSelected}
							<span class="text-xs font-medium text-info">(Will be added)</span>
						{/if}
					</label>
				{/each}
			</div>

			<!-- Selected Calendars Summary -->
			{#if selectedCalendarIds.length > 0}
				<div class="mt-2 text-sm text-base-content/70">
					{selectedCalendarIds.length} calendar{selectedCalendarIds.length > 1 ? 's' : ''} selected
				</div>
			{/if}
		{:else}
			<div class="py-4 text-center text-base-content/60 {compact ? 'text-sm' : ''}">
				No calendars available. <a href="/calendar/manage" class="link">Create one</a>.
			</div>
		{/if}
	</div>

	<!-- Apply Changes Button -->
	<div class="flex items-center gap-3">
		<button
			class="btn btn-primary {compact ? 'btn-sm btn-block' : ''}"
			disabled={selectedCalendarIds.length === 0 || isProcessingChanges}
			onclick={handleApplyCalendarChanges}
		>
			{#if isProcessingChanges}
				<span class="loading loading-spinner {compact ? 'loading-sm' : ''}"></span>
				Applying changes to {selectedCalendarIds.length} calendar{selectedCalendarIds.length > 1
					? 's'
					: ''}...
			{:else}
				<PlusIcon class_="w-4 h-4 mr-2" />
				Apply Changes to {selectedCalendarIds.length || 'Selected'} Calendar{selectedCalendarIds.length !==
				1
					? 's'
					: ''}
			{/if}
		</button>
	</div>

	<!-- Success Message -->
	{#if calendarChangesSuccess}
		<div class="alert alert-success mt-3 {compact ? 'py-2' : ''}">
			<CheckIcon class_="{compact ? 'w-4 h-4' : 'w-5 h-5'}" />
			<span class="{compact ? 'text-sm' : ''}">Calendar changes applied successfully!</span>
		</div>
	{/if}

	<!-- Error Message -->
	{#if calendarChangesError}
		<div class="alert alert-error mt-3 {compact ? 'py-2' : ''}">
			<AlertIcon class_="{compact ? 'w-4 h-4' : 'w-5 h-5'}" />
			<span class="{compact ? 'text-sm' : ''}">{calendarChangesError}</span>
		</div>
	{/if}
</div>

<style>
	.personal-calendar-share.compact {
		/* Compact mode adjustments can be added here if needed */
	}
</style>
