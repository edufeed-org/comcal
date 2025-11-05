<script>
	import { eventStore, pool } from '$lib/stores/nostr-infrastructure.svelte';
	import { useActiveUser } from '$lib/stores/accounts.svelte';
	import { appConfig } from '$lib/config.js';
	import { formatCalendarDate } from '$lib/helpers/calendar.js';
	import { encodeEventToNaddr, hexToNpub } from '$lib/helpers/nostrUtils';
	import { EventFactory } from 'applesauce-factory';
	import { publishEvent } from '$lib/helpers/publisher.js';
	import { showToast } from '$lib/helpers/toast.js';
	import CommentList from '$lib/components/comments/CommentList.svelte';
	import ReactionBar from '$lib/components/reactions/ReactionBar.svelte';
import {
	CalendarIcon,
	ClockIcon,
	LocationIcon,
	UserIcon,
	EditIcon,
	TrashIcon,
	CopyIcon,
	ExternalLinkIcon
} from '$lib/components/icons';
	import AddToCalendarDropdown from '$lib/components/calendar/AddToCalendarDropdown.svelte';
	import EventTags from '$lib/components/calendar/EventTags.svelte';
	import CalendarEventModal from '$lib/components/calendar/CalendarEventModal.svelte';
	import LocationLink from '$lib/components/shared/LocationLink.svelte';
	import MarkdownRenderer from '$lib/components/shared/MarkdownRenderer.svelte';
	import EventLocationMap from '$lib/components/calendar/EventLocationMap.svelte';
	import ProfileCard from '$lib/components/shared/ProfileCard.svelte';
	import InlineRsvp from '$lib/components/calendar/InlineRsvp.svelte';
	import AttendeeIndicator from '$lib/components/calendar/AttendeeIndicator.svelte';
	import { useCalendarEventRsvps } from '$lib/stores/calendar-event-rsvps.svelte.js';
	import { manager } from '$lib/stores/accounts.svelte';
	import { transformRsvps } from '$lib/helpers/rsvpUtils.js';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	// Use the proper reactive hook for active user
	const getActiveUser = useActiveUser();
	let activeUser = $derived(getActiveUser());

	// Reactive state
	let featuredCalendars = $state(/** @type {any[]} */ ([]));
	let isLoadingCalendars = $state(true);
	let isEditModalOpen = $state(false);
	let isDeletingEvent = $state(false);
	let showDeleteConfirmation = $state(false);

	// Get event from data
	let event = $derived(data.event);
	let rawEvent = $derived(data.rawEvent);

	// Check if user owns this event
	let isUserEvent = $derived(event && activeUser && event.pubkey === activeUser.pubkey);

	// Format event data for display
	let startDate = $derived(event ? new Date(event.start * 1000) : null);
	let endDate = $derived(event && event.end ? new Date(event.end * 1000) : null);
	let isAllDay = $derived(event ? event.kind === 31922 : false);
	let isMultiDay = $derived(
		event && endDate && startDate ? startDate.toDateString() !== endDate.toDateString() : false
	);

	// Generate event address for featured calendars
	let eventAddress = $derived.by(() => {
		if (!event) return null;
		if (event.kind >= 30000 && event.kind < 40000) {
			return `${event.kind}:${event.pubkey}:${event.dTag}`;
		}
		return `${event.kind}:${event.pubkey}:${event.id}`;
	});

	// Load RSVPs for this event
	const rsvpData = $derived(rawEvent ? useCalendarEventRsvps(rawEvent) : { rsvps: [], loading: false });
	
	// Get current user pubkey
	const userPubkey = $derived(manager.active?.pubkey || null);
	
	// Transform raw RSVPs into grouped data using helper
	const transformedRsvps = $derived(transformRsvps(rsvpData.rsvps, userPubkey));

	// Subscribe to featured calendars
	$effect(() => {
		if (!eventAddress) return;

		isLoadingCalendars = true;

		// Query for calendars (kind 31924) that reference this event
		const subscription = pool
			.group(appConfig.calendar.defaultRelays)
			.subscription({
				kinds: [31924],
				'#a': [eventAddress]
			})
			.subscribe({
				next: (response) => {
					if (response === 'EOSE') {
						console.log('Calendars: End of stored events');
						isLoadingCalendars = false;
					} else if (response && typeof response === 'object' && response.kind === 31924) {
						console.log('Found calendar featuring this event:', response);

						// Add to eventStore
						eventStore.add(response);

						// Add to featured calendars if not already present
						const existingIndex = featuredCalendars.findIndex((c) => c.id === response.id);
						if (existingIndex === -1) {
							featuredCalendars = [...featuredCalendars, response];
						}
					}
				},
				error: (error) => {
					console.error('Calendar subscription error:', error);
					isLoadingCalendars = false;
				}
			});

		return () => subscription.unsubscribe();
	});

	/**
	 * Get calendar title
	 * @param {any} calendar
	 */
	function getCalendarTitle(calendar) {
		const titleTag = calendar.tags.find((/** @type {string[]} */ t) => t[0] === 'title');
		return titleTag?.[1] || 'Untitled Calendar';
	}

	/**
	 * Get calendar d-tag
	 * @param {any} calendar
	 */
	function getCalendarDTag(calendar) {
		const dTag = calendar.tags.find((/** @type {string[]} */ t) => t[0] === 'd');
		return dTag?.[1] || '';
	}

	/**
	 * Generate naddr for calendar
	 * @param {any} calendar
	 */
	function getCalendarNaddr(calendar) {
		return encodeEventToNaddr(calendar, []);
	}

	/**
	 * Copy event naddr to clipboard
	 */
	async function copyNaddr() {
		if (rawEvent) {
			try {
				const naddr = encodeEventToNaddr(rawEvent);
				await navigator.clipboard.writeText(naddr);
				console.log('Event naddr copied to clipboard:', naddr);
				showToast('Event link copied to clipboard!', 'success');
			} catch (err) {
				console.error('Failed to copy event naddr:', err);
				showToast('Failed to copy link', 'error');
			}
		}
	}

	/**
	 * Handle event deletion with NIP-09
	 */
	async function handleDeleteEvent() {
		if (!activeUser || !event || !rawEvent) return;

		isDeletingEvent = true;

		try {
			// Create EventFactory
			const factory = new EventFactory({
				signer: activeUser.signer
			});

			// Create NIP-09 deletion event (kind 5) manually for addressable events
			// According to NIP-09, use 'a' tag for addressable events (not 'e' tag)
			const deleteTemplate = await factory.build({
				kind: 5,
				content: 'Event deleted by author',
				tags: [
					['a', `${event.kind}:${event.pubkey}:${event.dTag}`],
					['k', event.kind.toString()]
				]
			});

			// Sign the deletion event
			const signedDelete = await factory.sign(deleteTemplate);

			console.log('📅 Deletion event created:', signedDelete);

			// Publish to relays
			const result = await publishEvent(signedDelete, {
				relays: appConfig.calendar.defaultRelays,
				logPrefix: 'EventDeletion'
			});

			if (result.success) {
				console.log('✅ Deletion event published successfully');

				// Add to EventStore - this automatically removes the referenced event!
				eventStore.add(signedDelete);

				// Navigate back to previous page
				window.history.back();
			} else {
				console.error('❌ Failed to publish deletion event');
				alert('Failed to delete event. Please try again.');
			}
		} catch (error) {
			console.error('Failed to delete event:', error);
			alert('An error occurred while deleting the event.');
		} finally {
			isDeletingEvent = false;
			showDeleteConfirmation = false;
		}
	}
</script>

<svelte:head>
	<title>{event?.title || 'Event'} - Communikey</title>
	<meta name="description" content="View calendar event details" />
</svelte:head>

{#if event}
	<div class="container mx-auto max-w-4xl px-4 py-8">
		<!-- Event Header with Image -->
		{#if event.image}
			<div class="mb-8">
				<img
					src={event.image}
					alt={event.title}
					class="h-64 w-full rounded-lg object-cover shadow-lg"
					loading="lazy"
				/>
			</div>
		{/if}

		<!-- Event Owner Badge -->
		{#if isUserEvent}
			<div class="mb-4 flex items-center gap-2">
				<div class="badge badge-primary gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-4 h-4 stroke-current">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					Your Event
				</div>
			</div>
		{/if}

		<!-- Title Row with Copy Icon, Add to Calendar, and Edit -->
		<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
			<!-- Event Title with Copy Icon -->
			<div class="flex flex-1 items-start gap-2">
				<h1 class="text-4xl font-bold text-base-content">
					{event.title}
				</h1>
				<button
					class="btn btn-ghost btn-sm btn-square"
					onclick={copyNaddr}
					title="Copy event link"
				>
					<CopyIcon />
				</button>
			</div>
			
			<!-- Actions (right side) -->
			<div class="flex flex-shrink-0 items-center gap-2">
				<AddToCalendarDropdown event={event} disabled={!activeUser} />
				{#if isUserEvent}
					<div class="dropdown dropdown-end">
						<button tabindex="0" class="btn btn-ghost btn-sm btn-square" role="button" title="Manage event">
							<EditIcon />
						</button>
					<ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-300">
						<li>
							<button onclick={() => isEditModalOpen = true} class="flex items-center gap-2">
								<EditIcon class="w-4 h-4" />
								<span>Edit Event</span>
							</button>
						</li>
						<li>
							<button onclick={() => showDeleteConfirmation = true} class="flex items-center gap-2 text-error hover:bg-error/10">
								<TrashIcon class="w-4 h-4" />
								<span>Delete Event</span>
							</button>
						</li>
					</ul>
					</div>
				{/if}
			</div>
		</div>

		<!-- Event Description -->
		{#if event.summary}
			<div class="mb-8">
				<MarkdownRenderer content={event.summary} />
			</div>
		{/if}

		<!-- Date and Time Card -->
		<div class="card mb-8 bg-base-200 shadow-lg">
			<div class="card-body">
				<h2 class="card-title text-2xl">
					<CalendarIcon class_="w-6 h-6" />
					Date & Time
				</h2>

				{#if isAllDay}
					<div class="mt-4 space-y-2">
						<div class="flex items-center gap-3">
							<CalendarIcon class_="w-5 h-5 text-info" />
							<span class="font-semibold">All Day Event</span>
						</div>
						<div class="ml-8 text-base-content/70">
							{#if isMultiDay && endDate && startDate}
								{formatCalendarDate(startDate, 'long')} - {formatCalendarDate(endDate, 'long')}
							{:else if startDate}
								{formatCalendarDate(startDate, 'long')}
							{/if}
						</div>
					</div>
				{:else}
					<div class="mt-4 space-y-3">
						{#if startDate}
							<div class="flex items-start gap-3">
								<ClockIcon class_="w-5 h-5 text-primary mt-0.5" />
								<div>
									<div class="font-semibold">Start</div>
									<div class="text-base-content/80">
										{formatCalendarDate(startDate, 'long')} at {formatCalendarDate(
											startDate,
											'time'
										)}
										{#if event.startTimezone}
											<span class="text-sm text-base-content/60">({event.startTimezone})</span>
										{/if}
									</div>
								</div>
							</div>
						{/if}
						{#if endDate}
							<div class="flex items-start gap-3">
								<ClockIcon class_="w-5 h-5 text-secondary mt-0.5" />
								<div>
									<div class="font-semibold">End</div>
									<div class="text-base-content/80">
										{formatCalendarDate(endDate, 'long')} at {formatCalendarDate(endDate, 'time')}
										{#if event.endTimezone}
											<span class="text-sm text-base-content/60">({event.endTimezone})</span>
										{/if}
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Event Author Card -->
		<div class="card mb-8 bg-base-200 shadow-lg">
			<div class="card-body">
				<h2 class="card-title text-2xl">
					<UserIcon class_="w-6 h-6" />
					Event Author
				</h2>
				<div class="mt-4">
					<ProfileCard pubkey={event.pubkey} size="lg" class="bg-base-100" />
				</div>
			</div>
		</div>

		<!-- Location Card -->
		{#if event.location}
			<div class="card mb-8 bg-base-200 shadow-lg">
				<div class="card-body">
					<h2 class="card-title text-2xl">
						<LocationIcon class_="w-6 h-6" />
						Location
					</h2>
					<div class="mt-4">
						<div class="flex items-start gap-3">
							<LocationIcon class_="w-5 h-5 mt-0.5" />
							<div class="text-base-content/80">
								<LocationLink location={event.location} />
							</div>
						</div>
						
						<!-- Map Preview -->
						<div class="mt-4">
							<EventLocationMap 
								location={event.location} 
								geohash={event.geohash}
								compact={true}
							/>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Event Tags -->
		{#if event.hashtags && event.hashtags.length > 0}
			<div class="card mb-8 bg-base-200 shadow-lg">
				<div class="card-body">
					<h2 class="card-title text-2xl">Tags</h2>
					<div class="mt-4">
						<EventTags tags={event.hashtags} size="lg" />
					</div>
				</div>
			</div>
		{/if}

		<!-- Further Links -->
		{#if event.references && event.references.length > 0}
			<div class="card mb-8 bg-base-200 shadow-lg">
				<div class="card-body">
					<h2 class="card-title text-2xl">Further Links</h2>
					<div class="mt-4 space-y-2">
						{#each event.references as reference}
							<a
								href={reference}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-2 rounded-lg bg-base-100 p-4 transition hover:bg-base-300"
							>
								<ExternalLinkIcon class_="w-5 h-5 text-base-content/60" />
								<span class="break-all text-base-content/80">{reference}</span>
							</a>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Featured in Calendars -->
		<div class="card mb-8 bg-base-200 shadow-lg">
			<div class="card-body">
				<h2 class="card-title text-2xl">Featured in Calendars</h2>
				{#if isLoadingCalendars}
					<div class="mt-4 flex items-center gap-2">
						<span class="loading loading-sm loading-spinner"></span>
						<span class="text-base-content/70">Loading calendars...</span>
					</div>
				{:else if featuredCalendars.length > 0}
					<div class="mt-4 space-y-2">
						{#each featuredCalendars as calendar}
							<a
								href="/calendar/{getCalendarNaddr(calendar)}"
								class="block rounded-lg bg-base-100 p-4 transition hover:bg-base-300"
							>
								<div class="font-semibold text-primary">{getCalendarTitle(calendar)}</div>
								{#if calendar.content}
									<div class="mt-1 text-sm text-base-content/70">{calendar.content}</div>
								{/if}
							</a>
						{/each}
					</div>
				{:else}
					<div class="mt-4 text-center text-base-content/60">
						This event is not featured in any calendars yet
					</div>
				{/if}
			</div>
		</div>

		<!-- Event Participants -->
		{#if event.participants && event.participants.length > 0}
			<div class="card mb-8 bg-base-200 shadow-lg">
				<div class="card-body">
					<h2 class="card-title text-2xl">
						<UserIcon class_="w-6 h-6" />
						Participant{#if event.participants.length > 1}s{/if}
					</h2>
					<div class="mt-4 space-y-2">
						{#each event.participants as participant}
							<div class="rounded-lg bg-base-100 p-3">
								<ProfileCard 
									pubkey={participant.pubkey}
									showNpub={false}
									class="bg-transparent p-0"
								/>
								{#if participant.role}
									<div class="mt-2 flex items-center gap-2">
										<span class="badge badge-primary badge-sm">{participant.role}</span>
									</div>
								{/if}
								{#if participant.relay}
									<div class="mt-1 text-xs text-base-content/50">
										Relay: {participant.relay}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- RSVP Section -->
		<div class="card mb-8 bg-base-200 shadow-lg">
			<div class="card-body">
				<h2 class="card-title text-2xl">
					<UserIcon class_="w-6 h-6" />
					RSVP to Event
				</h2>
				<div class="mt-4">
					<InlineRsvp
						calendarEvent={rawEvent || event}
						communityPubkey={event?.communityPubkey || ''}
						size="lg"
						showNote={false}
						compact={false}
					/>
					<p class="mt-3 text-sm text-base-content/60">
						Let the organizer and other attendees know if you're coming
					</p>
				</div>
			</div>
		</div>

		<!-- Attendees/RSVP Section (New) -->
		{#if transformedRsvps.totalCount > 0}
			<div class="card mb-8 bg-base-200 shadow-lg">
				<div class="card-body">
					<AttendeeIndicator
						accepted={transformedRsvps.accepted}
						tentative={transformedRsvps.tentative}
						declined={transformedRsvps.declined}
						totalCount={transformedRsvps.totalCount}
						compact={false}
					/>
				</div>
			</div>
		{/if}

		<!-- Reactions Section -->
		{#if rawEvent}
			<div class="card mb-8 bg-base-200 shadow-lg">
				<div class="card-body">
					<h2 class="card-title text-2xl">Reactions</h2>
					<div class="mt-4">
						<ReactionBar event={rawEvent} relays={appConfig.calendar.defaultRelays} />
					</div>
				</div>
			</div>
		{/if}

		<!-- Comments Section - New Component -->
		{#if rawEvent}
			<CommentList rootEvent={rawEvent} activeUser={activeUser} />
		{/if}
	</div>
{:else}
	<div class="container mx-auto px-4 py-8">
		<div class="alert alert-error">
			<span>Event not found</span>
		</div>
	</div>
{/if}

<!-- Edit Modal -->
{#if event && rawEvent}
	<CalendarEventModal
		isOpen={isEditModalOpen}
		mode="edit"
		existingEvent={event}
		existingRawEvent={rawEvent}
		communityPubkey={event.pubkey}
		onClose={() => isEditModalOpen = false}
		onEventCreated={() => {
			isEditModalOpen = false;
			// Reload page to show updated event
			window.location.reload();
		}}
	/>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirmation && event}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete Event?</h3>
			<p class="py-4">
				Are you sure you want to delete <strong>{event.title}</strong>?
				<br />
				This action cannot be undone.
			</p>
			<div class="modal-action">
				<button 
					class="btn" 
					onclick={() => showDeleteConfirmation = false}
					disabled={isDeletingEvent}
				>
					Cancel
				</button>
				<button 
					class="btn btn-error" 
					onclick={handleDeleteEvent}
					disabled={isDeletingEvent}
				>
					{#if isDeletingEvent}
						<span class="loading loading-spinner loading-sm"></span>
						Deleting...
					{:else}
						Delete Event
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
