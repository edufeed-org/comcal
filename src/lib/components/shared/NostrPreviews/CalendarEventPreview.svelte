<!--
  CalendarEventPreview Component
  Displays a rich preview card for calendar events (kinds 31922/31923)
  Fetches the event and renders key details with a link to the full event page
-->

<script>
	import { fetchEventById } from '$lib/helpers/nostrUtils.js';
	import { formatCalendarDate } from '$lib/helpers/calendar.js';
	import { CalendarIcon, ClockIcon } from '$lib/components/icons';
	import LocationLink from '../LocationLink.svelte';
	import { CopyIcon } from '$lib/components/icons';
	import { getCalendarEventStart, getCalendarEventEnd } from 'applesauce-core/helpers';
	import MarkdownRenderer from '../MarkdownRenderer.svelte';

	let { identifier, decoded, inline = false } = $props();

	/** @type {import('$lib/types/calendar.js').CalendarEvent | null} */
	let event = $state(null);
	let isLoading = $state(true);
	let error = $state('');

	$effect(() => {
		isLoading = true;
		error = '';

		fetchEventById(identifier)
			.then((rawEvent) => {
				if (rawEvent) {
					// Parse event tags to extract metadata
					const titleTag = rawEvent.tags.find(t => t[0] === 'name' || t[0] === 'title');
					const summaryTag = rawEvent.tags.find(t => t[0] === 'summary' || t[0] === 'description');
					const imageTag = rawEvent.tags.find(t => t[0] === 'image');
					const locationTags = rawEvent.tags.filter(t => t[0] === 'location');
					
					/** @type {import('$lib/types/calendar.js').CalendarEvent} */
					const parsedEvent = {
						id: rawEvent.id,
						pubkey: rawEvent.pubkey,
						kind: /** @type {import('$lib/types/calendar.js').CalendarEventKind} */ (rawEvent.kind),
						title: titleTag?.[1] || 'Untitled Event',
						summary: summaryTag?.[1] || '',
						image: imageTag?.[1] || '',
						start: getCalendarEventStart(rawEvent) || 0,
						end: getCalendarEventEnd(rawEvent) || 0,
						location: locationTags.map(t => t[1]).join(', '),
						participants: [],
						hashtags: [],
						references: [],
						eventReferences: [],
						communityPubkey: '',
						createdAt: rawEvent.created_at,
						originalEvent: rawEvent
					};
					event = parsedEvent;
				} else {
					error = 'Event not found';
				}
			})
			.catch((err) => {
				error = err.message || 'Failed to load event';
			})
			.finally(() => {
				isLoading = false;
			});
	});

	/** @type {string} */
	let eventUrl = $derived(`/calendar/event/${identifier}`);
	/** @type {Date | null} */
	let startDate = $derived(event?.start ? new Date(event.start * 1000) : null);
	/** @type {Date | null} */
	let endDate = $derived(event?.end ? new Date(event.end * 1000) : null);
	/** @type {boolean} */
	let isAllDay = $derived(event?.kind === 31922);
	/** @type {string} */
	let locationString = $derived(event?.location || '');

	function copyIdentifier() {
		navigator.clipboard.writeText(identifier);
	}
</script>

{#if isLoading}
	<div class="skeleton h-24 w-full rounded-lg my-2"></div>
{:else if error}
	<div class="alert alert-error text-sm my-2">
		<div class="flex items-center justify-between w-full">
			<span>⚠️ {error}</span>
			<button class="btn btn-xs btn-ghost" onclick={copyIdentifier} title="Copy identifier">
				<CopyIcon class_="w-3 h-3" />
			</button>
		</div>
	</div>
{:else if event}
	<a
		href={eventUrl}
		class="block card bg-base-200 hover:bg-base-300 shadow-md hover:shadow-lg transition-all border-l-4 border-l-primary my-2 no-underline"
	>
		<div class="card-body p-4">
			<div class="flex items-start gap-3">
				{#if event.image}
					<img
						src={event.image}
						alt={event.title}
						class="w-16 h-16 rounded-lg object-cover flex-shrink-0"
					/>
				{/if}

				<div class="flex-1 min-w-0">
					<h3 class="card-title text-base mb-2 text-base-content">{event.title}</h3>

					<div class="flex flex-col gap-1 text-sm text-base-content/70">
						{#if startDate}
							<div class="flex items-center gap-2">
								<CalendarIcon class_="w-4 h-4 flex-shrink-0" />
								<span>{formatCalendarDate(startDate, 'short')}</span>
							</div>
						{/if}

						{#if !isAllDay && startDate}
							<div class="flex items-center gap-2">
								<ClockIcon class_="w-4 h-4 flex-shrink-0" />
								<span>
									{formatCalendarDate(startDate, 'time')}
									{#if endDate}
										- {formatCalendarDate(endDate, 'time')}
									{/if}
								</span>
							</div>
						{/if}

						{#if locationString}
							<div class="flex items-center gap-2">
								<span>📍</span>
								<LocationLink location={locationString} />
							</div>
						{/if}
					</div>

					{#if event.summary}
						<MarkdownRenderer content={event.summary} class="text-sm text-base-content/60 mt-2 line-clamp-2" />
					{/if}
				</div>
			</div>

			<div class="card-actions justify-end mt-2">
				<div class="badge badge-primary badge-sm">Calendar Event</div>
			</div>
		</div>
	</a>
{/if}
