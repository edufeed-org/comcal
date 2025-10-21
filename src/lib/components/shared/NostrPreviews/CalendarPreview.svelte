<!--
  CalendarPreview Component
  Displays a rich preview card for calendars (kind 31924)
  Fetches the calendar and renders key details with a link to the full calendar page
-->

<script>
	import { fetchEventById } from '$lib/helpers/nostrUtils.js';
	import { CalendarIcon } from '$lib/components/icons';
	import { CopyIcon } from '$lib/components/icons';

	let { identifier, decoded, inline = false } = $props();

	/** @type {{name: string, description: string, image: string | null, eventCount: number} | null} */
	let calendar = $state(null);
	let isLoading = $state(true);
	let error = $state('');

	$effect(() => {
		isLoading = true;
		error = '';

		fetchEventById(identifier)
			.then((rawEvent) => {
				if (rawEvent && rawEvent.kind === 31924) {
					// Parse calendar metadata from tags
					const dTag = rawEvent.tags.find(t => t[0] === 'd')?.[1] || 'untitled';
					const descriptionTag = rawEvent.tags.find(t => t[0] === 'description');
					const imageTag = rawEvent.tags.find(t => t[0] === 'image');
					const eventRefs = rawEvent.tags.filter(t => t[0] === 'a');

					calendar = {
						name: dTag,
						description: descriptionTag?.[1] || '',
						image: imageTag?.[1] || null,
						eventCount: eventRefs.length
					};
				} else {
					error = 'Calendar not found';
				}
			})
			.catch((err) => {
				error = err.message || 'Failed to load calendar';
			})
			.finally(() => {
				isLoading = false;
			});
	});

	/** @type {string} */
	let calendarUrl = $derived(`/calendar/${identifier}`);

	function copyIdentifier() {
		navigator.clipboard.writeText(identifier);
	}
</script>

{#if isLoading}
	<div class="skeleton h-20 w-full rounded-lg my-2"></div>
{:else if error}
	<div class="alert alert-error text-sm my-2">
		<div class="flex items-center justify-between w-full">
			<span>⚠️ {error}</span>
			<button class="btn btn-xs btn-ghost" onclick={copyIdentifier} title="Copy identifier">
				<CopyIcon class_="w-3 h-3" />
			</button>
		</div>
	</div>
{:else if calendar}
	<a
		href={calendarUrl}
		class="block card bg-base-200 hover:bg-base-300 shadow-md hover:shadow-lg transition-all my-2 no-underline"
	>
		<div class="card-body p-4">
			<div class="flex items-center gap-3">
				{#if calendar.image}
					<img
						src={calendar.image}
						alt={calendar.name}
						class="w-12 h-12 rounded-lg object-cover"
					/>
				{:else}
					<div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
						<CalendarIcon class_="w-6 h-6 text-primary" />
					</div>
				{/if}

				<div class="flex-1 min-w-0">
					<h3 class="font-semibold text-base-content">{calendar.name}</h3>
					{#if calendar.description}
						<p class="text-sm text-base-content/60 line-clamp-1">
							{calendar.description}
						</p>
					{/if}
					<p class="text-xs text-base-content/50 mt-1">
						{calendar.eventCount} event{calendar.eventCount !== 1 ? 's' : ''}
					</p>
				</div>
			</div>

			<div class="card-actions justify-end">
				<div class="badge badge-secondary badge-sm">Calendar</div>
			</div>
		</div>
	</a>
{/if}
