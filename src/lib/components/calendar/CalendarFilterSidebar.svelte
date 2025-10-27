<!--
  CalendarFilterSidebar Component
  Collapsible sidebar containing calendar filter components
  - Desktop: Fixed left sidebar with collapse/expand toggle
  - Mobile: Drawer overlay triggered by filter button
-->

<script>
	import RelaySelector from './RelaySelector.svelte';
	import FollowListSelector from './FollowListSelector.svelte';
	import SearchInput from './SearchInput.svelte';
	import TagSelector from './TagSelector.svelte';
	import { FilterIcon, CloseIcon } from '../icons';
	import { calendarFilters } from '$lib/stores/calendar-filters.svelte.js';

	// Props
	let {
		isExpanded = $bindable(true),
		isDrawerOpen = $bindable(false),
		validEvents = [],
		onRelayFilterChange = () => {},
		onFollowListFilterChange = () => {},
		onSearchQueryChange = () => {},
		onTagFilterChange = () => {}
	} = $props();

	/**
	 * Toggle sidebar expanded state (desktop)
	 */
	function toggleSidebar() {
		isExpanded = !isExpanded;
	}

	/**
	 * Close drawer (mobile)
	 */
	function closeDrawer() {
		isDrawerOpen = false;
	}

	// Derived state: Calculate active filter count
	let activeFilterCount = $derived.by(() => {
		let count = 0;
		count += calendarFilters.selectedRelays.length;
		count += calendarFilters.getSelectedAuthors().length;
		count += calendarFilters.searchQuery.trim() ? 1 : 0;
		count += calendarFilters.selectedTags.length;
		return count;
	});

	let hasActiveFilters = $derived(activeFilterCount > 0);
</script>

<!-- Desktop: Fixed collapsible sidebar -->
<div class="hidden lg:flex">
	{#if isExpanded}
		<!-- Expanded sidebar -->
		<aside
			class="flex h-[calc(100vh-4rem)] w-80 flex-col overflow-hidden border-r border-base-300 bg-base-300 transition-all duration-300"
		>
			<!-- Header with collapse button -->
			<div
				class="flex items-center justify-between border-b border-base-300 bg-base-200 px-4 py-4 shadow-sm"
			>
				<div class="flex items-center gap-3">
					<FilterIcon class_="h-5 w-5 text-primary" />
					<h2 class="text-base font-semibold text-base-content">Filters</h2>
					{#if hasActiveFilters}
						<span class="badge badge-primary badge-sm">{activeFilterCount}</span>
					{/if}
				</div>
				<button
					class="btn btn-circle btn-ghost btn-sm hover:bg-base-300"
					onclick={toggleSidebar}
					title="Collapse sidebar"
					aria-label="Collapse sidebar"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
						/>
					</svg>
				</button>
			</div>

			<!-- Filter content - scrollable -->
			<div class="flex-1 overflow-y-auto">
				<RelaySelector onApplyFilters={onRelayFilterChange} />
				<FollowListSelector onApplyFilters={onFollowListFilterChange} />
				<SearchInput {onSearchQueryChange} />
				<TagSelector events={validEvents} {onTagFilterChange} />
			</div>
		</aside>
	{:else}
		<!-- Collapsed sidebar - thin bar with expand button and badge -->
		<aside
			class="flex h-[calc(100vh-4rem)] w-12 flex-col items-center border-r border-base-300 bg-base-300 py-4 transition-all duration-300"
		>
			<div class="relative">
				<button
					class="btn btn-circle btn-ghost btn-sm hover:bg-base-200"
					onclick={toggleSidebar}
					title="Expand filters {hasActiveFilters ? `(${activeFilterCount} active)` : ''}"
					aria-label="Expand filters"
				>
					<FilterIcon class_="h-5 w-5 {hasActiveFilters ? 'text-primary' : 'text-base-content/70'}" />
				</button>
				{#if hasActiveFilters}
					<span
						class="badge badge-primary badge-xs absolute -right-1 -top-1 h-5 min-w-5 p-0 text-xs font-semibold"
					>
						{activeFilterCount}
					</span>
				{/if}
			</div>
		</aside>
	{/if}
</div>

<!-- Mobile: Drawer overlay -->
{#if isDrawerOpen}
	<div class="lg:hidden">
		<!-- Backdrop -->
		<div
			class="fixed inset-0 z-40 bg-black/50 transition-opacity"
			onclick={closeDrawer}
			role="button"
			tabindex="-1"
			aria-label="Close filters"
		></div>

		<!-- Drawer -->
		<aside
			class="fixed left-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col overflow-hidden bg-base-300 shadow-xl transition-transform"
		>
			<!-- Header with close button -->
			<div
				class="flex items-center justify-between border-b border-base-300 bg-base-200 px-4 py-4 shadow-sm"
			>
				<div class="flex items-center gap-3">
					<FilterIcon class_="h-5 w-5 text-primary" />
					<h2 class="text-base font-semibold text-base-content">Filters</h2>
					{#if hasActiveFilters}
						<span class="badge badge-primary badge-sm">{activeFilterCount}</span>
					{/if}
				</div>
				<button
					class="btn btn-circle btn-ghost btn-sm hover:bg-base-300"
					onclick={closeDrawer}
					aria-label="Close filters"
				>
					<CloseIcon class_="h-5 w-5" />
				</button>
			</div>

			<!-- Filter content - scrollable -->
			<div class="flex-1 overflow-y-auto">
				<RelaySelector onApplyFilters={onRelayFilterChange} />
				<FollowListSelector onApplyFilters={onFollowListFilterChange} />
				<SearchInput {onSearchQueryChange} />
				<TagSelector events={validEvents} {onTagFilterChange} />
			</div>

			<!-- Footer with close button -->
			<div class="border-t border-base-300 bg-base-200 p-4">
				<button class="btn btn-block" onclick={closeDrawer}> Close Filters </button>
			</div>
		</aside>
	</div>
{/if}
