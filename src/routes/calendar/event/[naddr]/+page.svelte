<script>
	import { eventStore, pool } from '$lib/stores/nostr-infrastructure.svelte';
	import { manager } from '$lib/stores/accounts.svelte';
	import { appConfig } from '$lib/config.js';
	import { formatCalendarDate } from '$lib/helpers/calendar.js';
	import { encodeEventToNaddr } from '$lib/helpers/nostrUtils';
	import { useUserProfile } from '$lib/stores/user-profile.svelte.js';
	import { EventFactory } from 'applesauce-factory';
	import { publishEvent } from '$lib/helpers/publisher.js';
	import { getDisplayName, getProfilePicture } from 'applesauce-core/helpers';
	import {
		CalendarIcon,
		ClockIcon,
		LocationIcon,
		UserIcon,
		EditIcon
	} from '$lib/components/icons';
	import AddToCalendarDropdown from '$lib/components/calendar/AddToCalendarDropdown.svelte';
	import EventTags from '$lib/components/calendar/EventTags.svelte';
	import CalendarEventModal from '$lib/components/calendar/CalendarEventModal.svelte';
	import LocationLink from '$lib/components/shared/LocationLink.svelte';
	import MarkdownRenderer from '$lib/components/shared/MarkdownRenderer.svelte';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	// Reactive state
	let activeUser = $state(manager.active);
	let comments = $state(/** @type {any[]} */ ([]));
	let newComment = $state('');
	let isLoadingComments = $state(true);
	let isPostingComment = $state(false);
	let featuredCalendars = $state(/** @type {any[]} */ ([]));
	let isLoadingCalendars = $state(true);
	let isEditModalOpen = $state(false);

	// Subscribe to active user
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

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

	// Generate event address for comments
	let eventAddress = $derived(
		event && event.dTag ? `${event.kind}:${event.pubkey}:${event.dTag}` : null
	);

	// Subscribe to comments with real-time updates
	$effect(() => {
		if (!eventAddress) return;

		isLoadingComments = true;
		let initialLoadComplete = false;

		// Create persistent subscription for comments
		const subscription = pool
			.group(appConfig.calendar.defaultRelays)
			.subscription({
				kinds: [1111],
				'#A': [eventAddress]
			})
			.subscribe({
				next: (response) => {
					if (response === 'EOSE') {
						console.log('Comments: End of stored events');
						initialLoadComplete = true;
						isLoadingComments = false;
					} else if (response && typeof response === 'object' && response.kind === 1111) {
						console.log('Received comment event:', response);

						// Add to eventStore for persistence
						eventStore.add(response);

						// Add comment to list if not already present
						const existingIndex = comments.findIndex((c) => c.id === response.id);
						if (existingIndex === -1) {
							comments = [...comments, response].sort((a, b) => b.created_at - a.created_at); // Newest first
						}

						if (initialLoadComplete && isLoadingComments) {
							isLoadingComments = false;
						}
					}
				},
				error: (error) => {
					console.error('Comment subscription error:', error);
					isLoadingComments = false;
				}
			});

		return () => subscription.unsubscribe();
	});

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
	 * Post a new comment
	 * @param {Event} e
	 */
	async function handlePostComment(e) {
		e.preventDefault();

		if (!activeUser || !newComment.trim() || !event || !eventAddress) return;

		isPostingComment = true;

		try {
			// Create EventFactory for the user
			const factory = new EventFactory({
				signer: activeUser.signer
			});

			// Create the comment event with NIP-22 structure
			const commentEvent = await factory.build({
				kind: 1111,
				content: newComment.trim(),
				tags: [
					// Root scope
					['A', eventAddress, appConfig.calendar.defaultRelays[0] || ''],
					['K', event.kind.toString()],
					['P', event.pubkey, appConfig.calendar.defaultRelays[0] || ''],
					// Parent (same as root for top-level comments)
					['a', eventAddress, appConfig.calendar.defaultRelays[0] || ''],
					['e', event.id, appConfig.calendar.defaultRelays[0] || ''],
					['k', event.kind.toString()],
					['p', event.pubkey, appConfig.calendar.defaultRelays[0] || '']
				]
			});

			// Sign the event
			const signedEvent = await factory.sign(commentEvent);

			// Add immediately to local comments for instant UI feedback
			comments = [signedEvent, ...comments];

			console.log('Comment event created:', signedEvent);

			// Publish to relays
			const result = await publishEvent(signedEvent, {
				relays: appConfig.calendar.defaultRelays,
				logPrefix: 'EventComment'
			});

			if (result.success) {
				console.log('Comment published successfully');
				eventStore.add(signedEvent);
			} else {
				console.error('Failed to publish comment');
			}

			// Clear input
			newComment = '';
		} catch (error) {
			console.error('Failed to post comment:', error);
		} finally {
			isPostingComment = false;
		}
	}

	/**
	 * Format timestamp
	 * @param {number} timestamp
	 */
	function formatTimestamp(timestamp) {
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		if (diff < 60000) return 'just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
		return date.toLocaleDateString();
	}

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

		<!-- Action Buttons and User Badge -->
		<div class="mb-6 flex items-center justify-between gap-4">
			<!-- Your Event Badge -->
			{#if isUserEvent}
				<div class="badge badge-primary badge-lg gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-4 h-4 stroke-current">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					Your Event
				</div>
			{:else}
				<div></div>
			{/if}

			<!-- Action Buttons -->
			<div class="flex gap-2">
				{#if isUserEvent}
					<button
						class="btn btn-secondary gap-2"
						onclick={() => isEditModalOpen = true}
					>
						<EditIcon class_="w-5 h-5" />
						Edit Event
					</button>
				{/if}
				<AddToCalendarDropdown event={event} disabled={!activeUser} />
			</div>
		</div>

		<!-- Event Title -->
		<h1 class="mb-6 text-4xl font-bold text-base-content">
			{event.title}
		</h1>

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

		<!-- Attendees/RSVP Section -->
		{#if event.rsvps && event.rsvps.length > 0}
			<div class="card mb-8 bg-base-200 shadow-lg">
				<div class="card-body">
					<h2 class="card-title text-2xl">
						<UserIcon class_="w-6 h-6" />
						Attendees
					</h2>

					<!-- RSVP Counts -->
					<div class="mt-4 flex gap-4">
						<div class="stat bg-success/10 rounded-lg">
							<div class="stat-title">Accepted</div>
							<div class="stat-value text-success">
								{event.rsvps.filter((/** @type {any} */ r) => r.status === 'accepted').length}
							</div>
						</div>
						<div class="stat bg-warning/10 rounded-lg">
							<div class="stat-title">Tentative</div>
							<div class="stat-value text-warning">
								{event.rsvps.filter((/** @type {any} */ r) => r.status === 'tentative').length}
							</div>
						</div>
						<div class="stat bg-error/10 rounded-lg">
							<div class="stat-title">Declined</div>
							<div class="stat-value text-error">
								{event.rsvps.filter((/** @type {any} */ r) => r.status === 'declined').length}
							</div>
						</div>
					</div>

					<!-- Attendee List -->
					<div class="mt-6 space-y-2">
						{#each event.rsvps as rsvp}
							{@const getUserProfile = useUserProfile(rsvp.pubkey)}
							{@const profile = getUserProfile()}
							{@const status = /** @type {any} */ (rsvp).status}
							<a
								href="/p/{rsvp.pubkey}"
								class="flex items-center gap-3 rounded-lg bg-base-100 p-3 transition hover:bg-base-300"
							>
								<div class="avatar">
									<div class="w-10 rounded-full">
										{#if getProfilePicture(profile)}
											<img src={getProfilePicture(profile)} alt={getDisplayName(profile)} />
										{:else}
											<div
												class="flex h-full w-full items-center justify-center bg-primary text-sm font-semibold text-primary-content"
											>
												{getDisplayName(profile)?.charAt(0).toUpperCase() || '?'}
											</div>
										{/if}
									</div>
								</div>
								<div class="flex-1">
									<div class="font-medium">
										{getDisplayName(profile) || `${rsvp.pubkey.slice(0, 8)}...${rsvp.pubkey.slice(-4)}`}
									</div>
									<div class="text-sm text-base-content/60">
										{#if status === 'accepted'}
											<span class="text-success">✓ Accepted</span>
										{:else if status === 'tentative'}
											<span class="text-warning">? Maybe</span>
										{:else if status === 'declined'}
											<span class="text-error">✗ Declined</span>
										{/if}
									</div>
								</div>
							</a>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Comments Section -->
		<div class="card bg-base-200 shadow-lg">
			<div class="card-body">
				<h2 class="card-title text-2xl">Comments</h2>

				<!-- Comment Input Form -->
				{#if activeUser}
					<form onsubmit={handlePostComment} class="mt-4">
						<textarea
							bind:value={newComment}
							placeholder="Write a comment..."
							class="textarea textarea-bordered w-full"
							rows="3"
							disabled={isPostingComment}
							required
						></textarea>
						<div class="mt-2 flex justify-end">
							<button
								type="submit"
								class="btn btn-primary"
								disabled={!newComment.trim() || isPostingComment}
							>
								{#if isPostingComment}
									<span class="loading loading-sm loading-spinner"></span>
									Posting...
								{:else}
									Post Comment
								{/if}
							</button>
						</div>
					</form>
				{:else}
					<div class="mt-4 rounded-lg bg-base-300 p-4 text-center">
						<p class="text-base-content/70">Sign in to post a comment</p>
					</div>
				{/if}

				<!-- Comments List -->
				<div class="mt-6 space-y-4">
					{#if isLoadingComments}
						<div class="flex items-center justify-center py-8">
							<span class="loading loading-lg loading-spinner"></span>
						</div>
					{:else if comments.length === 0}
						<div class="py-8 text-center text-base-content/60">
							No comments yet. Be the first to comment!
						</div>
					{:else}
						{#each comments as comment (comment.id)}
							{@const getCommentAuthorProfile = useUserProfile(comment.pubkey)}
							{@const authorProfile = getCommentAuthorProfile()}
							<div class="rounded-lg bg-base-100 p-4">
								<div class="mb-3 flex items-start gap-3">
									<a href="/p/{comment.pubkey}" class="avatar">
										<div class="w-10 rounded-full">
											{#if getProfilePicture(authorProfile)}
												<img
													src={getProfilePicture(authorProfile)}
													alt={getDisplayName(authorProfile)}
												/>
											{:else}
												<div
													class="flex h-full w-full items-center justify-center bg-primary text-sm font-semibold text-primary-content"
												>
													{getDisplayName(authorProfile)?.charAt(0).toUpperCase() || '?'}
												</div>
											{/if}
										</div>
									</a>
									<div class="flex-1">
										<div class="flex items-baseline gap-2">
											<a href="/p/{comment.pubkey}" class="font-semibold hover:underline">
												{getDisplayName(authorProfile) ||
													`${comment.pubkey.slice(0, 8)}...${comment.pubkey.slice(-4)}`}
											</a>
											<span class="text-xs text-base-content/50">
												{formatTimestamp(comment.created_at)}
											</span>
										</div>
										<p class="mt-2 whitespace-pre-wrap text-base-content/80">{comment.content}</p>
									</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
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
