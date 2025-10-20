<script>
	import { CalendarIcon } from '$lib/components/icons';
	import { communityCalendarTimelineLoader, targetedPublicationTimelineLoader } from '$lib/loaders/calendar.js';
	import { getCalendarEventMetadata } from '$lib/helpers/eventUtils.js';

	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEvent} CalendarEvent
	 */

	// Props
	let { communityId } = $props();

	// Local state - completely isolated
	/** @type {CalendarEvent[]} */
	let events = $state([]);
	let isLoading = $state(true);
	let error = $state(null);

	// Debug tracking
	let subscriptionStatus = $state('idle');
	let rawEventsReceived = $state(0);
	let parsedEventsCount = $state(0);
	let eoseReceived = $state(false);

	// Load calendar events
	$effect(() => {
		if (!communityId) {
			console.log('🔍 CalendarEventsStat: No communityId provided, skipping load');
			return;
		}
  
		// Reset state
		events = [];
		isLoading = true;
		error = null;
		subscriptionStatus = 'loading';
		rawEventsReceived = 0;
		parsedEventsCount = 0;
		eoseReceived = false;

		/** @type {CalendarEvent[]} */
		let accumulated = [];

    console.log(communityId)
		const sub = targetedPublicationTimelineLoader(communityId)().subscribe({
			next: (/** @type {any} */ response) => {
        console.log(response)
				if (response === 'EOSE') {
					console.log('🔍 CalendarEventsStat: ✅ EOSE received');
					console.log('🔍 CalendarEventsStat: Total accumulated events:', accumulated.length);
					console.log('🔍 CalendarEventsStat: Accumulated events:', accumulated);
					
					eoseReceived = true;
					events = accumulated;
					isLoading = false;
					subscriptionStatus = 'complete';

					console.log('🔍 CalendarEventsStat: Final events array assigned:', events);
					console.log('🔍 CalendarEventsStat: events.length:', events.length);
				} else if (response && (response.kind === 31922 || response.kind === 31923)) {
					rawEventsReceived++;
					console.log('🔍 CalendarEventsStat: 📥 Raw event received #' + rawEventsReceived + ':', {
						kind: response.kind,
						id: response.id,
						created_at: response.created_at,
						tags: response.tags,
						content_preview: response.content?.substring(0, 100)
					});

					try {
						const parsed = getCalendarEventMetadata(response);
						console.log('🔍 CalendarEventsStat: ✅ Parsed event #' + (parsedEventsCount + 1) + ':', {
							id: parsed.id,
							title: parsed.title,
							start: parsed.start,
							end: parsed.end,
							start_iso: parsed.start ? new Date(parsed.start * 1000).toISOString() : 'none',
							end_iso: parsed.end ? new Date(parsed.end * 1000).toISOString() : 'none',
							kind: parsed.kind
						});

						accumulated.push(parsed);
						parsedEventsCount++;
					} catch (parseError) {
						console.error('🔍 CalendarEventsStat: ❌ Failed to parse event:', parseError, response);
					}
				} else if (response) {
					console.log('🔍 CalendarEventsStat: ⚠️ Unexpected response type:', typeof response, response);
				}
			},
			error: (/** @type {any} */ err) => {
				console.error('🔍 CalendarEventsStat: ❌ Subscription error:', err);
				error = err.message || 'Failed to load calendar events';
				isLoading = false;
				subscriptionStatus = 'error';
			},
			complete: () => {
				console.log('🔍 CalendarEventsStat: Subscription completed (complete callback)');
			}
		});

		return () => {
			console.log('🔍 CalendarEventsStat: Cleaning up subscription');
			sub.unsubscribe();
		};
	});

	// Helper function to check if event is upcoming
	/**
	 * @param {CalendarEvent} event
	 */
	function isUpcoming(event) {
		if (!event || !event.start) {
			console.log('🔍 isUpcoming: Event missing or no start time:', event?.title || 'unknown');
			return false;
		}

		const now = Math.floor(Date.now() / 1000);
		let result;

		// Check end time first
		if (event.end && event.end > 0) {
			result = event.end >= now;
			console.log('🔍 isUpcoming (by end):', {
				title: event.title,
				end: event.end,
				end_iso: new Date(event.end * 1000).toISOString(),
				now,
				now_iso: new Date(now * 1000).toISOString(),
				result
			});
		} else if (event.start && event.start > 0) {
			// If no end time, check start time
			result = event.start >= now;
			console.log('🔍 isUpcoming (by start):', {
				title: event.title,
				start: event.start,
				start_iso: new Date(event.start * 1000).toISOString(),
				now,
				now_iso: new Date(now * 1000).toISOString(),
				result
			});
		} else {
			// Default to true for events without valid timestamps
			result = true;
			console.log('🔍 isUpcoming (default true):', event.title);
		}

		return result;
	}

	// Helper function to check if event is in the past
	/**
	 * @param {CalendarEvent} event
	 */
	function isPast(event) {
		if (!event || !event.start) {
			console.log('🔍 isPast: Event missing or no start time:', event?.title || 'unknown');
			return false;
		}

		const now = Math.floor(Date.now() / 1000);
		let result;

		// Check end time first
		if (event.end && event.end > 0) {
			result = event.end < now;
			console.log('🔍 isPast (by end):', {
				title: event.title,
				end: event.end,
				end_iso: new Date(event.end * 1000).toISOString(),
				now,
				now_iso: new Date(now * 1000).toISOString(),
				result
			});
		} else if (event.start && event.start > 0) {
			// If no end time, check start time
			result = event.start < now;
			console.log('🔍 isPast (by start):', {
				title: event.title,
				start: event.start,
				start_iso: new Date(event.start * 1000).toISOString(),
				now,
				now_iso: new Date(now * 1000).toISOString(),
				result
			});
		} else {
			// Default to false for events without valid timestamps
			result = false;
			console.log('🔍 isPast (default false):', event.title);
		}

		return result;
	}

	// Derived statistics with logging
	let stats = $derived.by(() => {
		console.log('🔍 CalendarEventsStat: Computing stats for', events.length, 'events');

		if (events.length === 0) {
			console.log('🔍 CalendarEventsStat: No events to compute stats for');
			return { upcoming: 0, total: 0, past: 0 };
		}

		console.log('🔍 CalendarEventsStat: Starting filtering...');
		const upcomingEvents = events.filter(isUpcoming);
		console.log('🔍 CalendarEventsStat: Upcoming events filtered:', upcomingEvents.length);

		const pastEvents = events.filter(isPast);
		console.log('🔍 CalendarEventsStat: Past events filtered:', pastEvents.length);

		const result = {
			upcoming: upcomingEvents.length,
			total: events.length,
			past: pastEvents.length
		};

		console.log('🔍 CalendarEventsStat: ✅ Final stats calculated:', result);
		return result;
	});
</script>

<div class="stat bg-base-200 rounded-lg shadow">
	<div class="stat-figure text-secondary">
		<CalendarIcon class_="w-8 h-8" />
	</div>
	<div class="stat-title">Events</div>
	{#if isLoading}
		<div class="stat-value text-secondary">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
		<div class="stat-desc text-xs opacity-70">Loading...</div>
	{:else if error}
		<div class="stat-value text-error text-sm">Error</div>
		<div class="stat-desc text-xs text-error">{error}</div>
	{:else}
		<div class="stat-value text-secondary">{stats.upcoming}</div>
		<div class="stat-desc">{stats.total} total • {stats.past} past</div>
	{/if}

	<!-- Debug info -->
	<div class="text-xs opacity-50 mt-2 space-y-0.5">
		<div>Status: {subscriptionStatus}</div>
		<div>Raw: {rawEventsReceived}, Parsed: {parsedEventsCount}</div>
		<div>EOSE: {eoseReceived ? '✓' : '✗'}</div>
	</div>
</div>
