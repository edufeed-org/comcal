<!--
  TagSelector Component
  Displays popular tags from calendar events and allows filtering by tags
-->

<script>
	import { page } from '$app/stores';
	import { calendarFilters } from '$lib/stores/calendar-filters.svelte.js';
	import { updateQueryParams } from '$lib/helpers/urlParams.js';
	import { FilterIcon } from '../icons';

	// Props
	let { events = [], onTagFilterChange = () => {} } = $props();

	// Sync local state with store (which is synced from URL in CalendarView)
	let selectedTags = $derived(calendarFilters.selectedTags);

	/**
	 * Get all tag counts from events
	 * @param {import('$lib/types/calendar.js').CalendarEvent[]} events
	 * @returns {Map<string, number>}
	 */
	function getAllTagCounts(events) {
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

		return tagCounts;
	}

	/**
	 * Get tags to display: selected tags + popular tags
	 * @param {import('$lib/types/calendar.js').CalendarEvent[]} events
	 * @param {string[]} selectedTags
	 * @param {number} popularLimit
	 * @returns {{ tag: string, count: number, isSelected: boolean }[]}
	 */
	function getDisplayedTags(events, selectedTags, popularLimit = 15) {
		const tagCounts = getAllTagCounts(events);
		
		// Get top N popular tags
		const popularTags = Array.from(tagCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, popularLimit)
			.map(([tag, count]) => ({ 
				tag, 
				count,
				isSelected: selectedTags.includes(tag)
			}));
		
		// Find selected tags that aren't in the popular list
		const popularTagNames = new Set(popularTags.map(t => t.tag));
		const selectedNotPopular = selectedTags
			.filter(tag => !popularTagNames.has(tag))
			.map(tag => ({ 
				tag, 
				count: tagCounts.get(tag) || 0,
				isSelected: true 
			}));
		
		// Combine: selected (not popular) first, then popular tags
		return [...selectedNotPopular, ...popularTags];
	}

	/**
	 * Toggle tag selection
	 * @param {string} tag
	 */
	function toggleTag(tag) {
		const newTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];

		// Update store
		calendarFilters.setSelectedTags(newTags);
		
		// Update URL
		updateQueryParams($page.url.searchParams, { tags: newTags });
		
		// Notify parent
		onTagFilterChange(newTags);
		console.log('🏷️ Selected tags:', newTags);
	}

	/**
	 * Clear all selected tags
	 */
	function clearTags() {
		console.log('🏷️ Clearing tag filters');
		
		// Update store
		calendarFilters.clearSelectedTags();
		
		// Update URL (empty array removes the parameter)
		updateQueryParams($page.url.searchParams, { tags: [] });
		
		// Notify parent
		onTagFilterChange([]);
	}

	// Derived state
	let displayedTags = $derived(getDisplayedTags(events, selectedTags));
	let hasActiveTags = $derived(selectedTags.length > 0);
	let hasTags = $derived(displayedTags.length > 0);
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
			{#each displayedTags as { tag, count, isSelected }}
				<button
					class="btn btn-sm gap-1"
					class:btn-primary={isSelected}
					class:btn-ghost={!isSelected}
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
