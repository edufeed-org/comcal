<!--
  TagSelector Component
  Displays popular tags from calendar events and allows filtering by tags
-->

<script>
	import { calendarStore } from '$lib/stores/calendar-events.svelte.js';
	import { FilterIcon } from '../icons';

	// Props
	let { events = [], onTagFilterChange = () => {} } = $props();

	// Local state
	let selectedTags = $state(/** @type {string[]} */ ([]));

	/**
	 * Extract and count popular tags from events
	 * @param {import('$lib/types/calendar.js').CalendarEvent[]} events
	 * @param {number} limit
	 * @returns {{ tag: string, count: number }[]}
	 */
	function getPopularTags(events, limit = 15) {
		const tagCounts = new Map();

		// Count all hashtags
		events.forEach((event) => {
			event.hashtags?.forEach((tag) => {
				if (tag && tag.trim()) {
					// Normalize: lowercase and trim
					const normalized = tag.toLowerCase().trim();
					tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
				}
			});
		});

		// Sort by popularity and return top N
		return Array.from(tagCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
			.map(([tag, count]) => ({ tag, count }));
	}

	/**
	 * Toggle tag selection
	 * @param {string} tag
	 */
	function toggleTag(tag) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter((t) => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}

		// Update store and notify parent
		calendarStore.setSelectedTags(selectedTags);
		onTagFilterChange(selectedTags);
		console.log('🏷️ Selected tags:', selectedTags);
	}

	/**
	 * Clear all selected tags
	 */
	function clearTags() {
		console.log('🏷️ Clearing tag filters');
		selectedTags = [];
		calendarStore.clearSelectedTags();
		onTagFilterChange([]);
	}

	// Derived state
	let popularTags = $derived(getPopularTags(events));
	let hasActiveTags = $derived(selectedTags.length > 0);
	let hasTags = $derived(popularTags.length > 0);
</script>

<div class="border-b border-base-300 bg-base-100 px-6 py-4">
	<!-- Header -->
	<div class="mb-3 flex items-center gap-3">
		<FilterIcon class_="h-5 w-5 text-base-content/70" />
		<span class="font-medium text-base-content">Filter by Tags</span>
		{#if hasActiveTags}
			<span class="badge badge-primary badge-sm">{selectedTags.length}</span>
		{/if}
	</div>

	{#if hasTags}
		<!-- Tag buttons grid -->
		<div class="flex flex-wrap gap-2">
			{#each popularTags as { tag, count }}
				<button
					class="btn btn-sm gap-1"
					class:btn-primary={selectedTags.includes(tag)}
					class:btn-ghost={!selectedTags.includes(tag)}
					onclick={() => toggleTag(tag)}
					title="Show events with #{tag} tag"
				>
					<span class="text-xs opacity-70">#</span>{tag}
					<span class="badge badge-sm">{count}</span>
				</button>
			{/each}
		</div>

		<!-- Clear button -->
		{#if hasActiveTags}
			<div class="mt-3 flex items-center gap-3">
				<button class="btn btn-ghost btn-sm" onclick={clearTags}> Clear All </button>
				<p class="text-xs text-base-content/60">
					Showing events with {selectedTags.length === 1 ? 'tag' : 'any of these tags'}
				</p>
			</div>
		{:else}
			<p class="mt-3 text-xs text-base-content/60">
				Click tags to filter events. Multiple tags will show events matching any tag (OR logic).
			</p>
		{/if}
	{:else}
		<!-- Empty state -->
		<div class="text-center text-sm text-base-content/50">
			<p>No tags found in current events</p>
		</div>
	{/if}
</div>
