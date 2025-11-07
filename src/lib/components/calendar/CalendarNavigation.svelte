<!--
  CalendarNavigation Component
  Navigation controls for calendar view switching and date navigation
-->

<script>
	import * as m from '$lib/paraglide/messages';
	import { page } from '$app/stores';
	import { formatCalendarDate } from '../../helpers/calendar.js';
	import { updateQueryParams } from '../../helpers/urlParams.js';
	import AddToCalendarButton from './AddToCalendarButton.svelte';

	import {
		ChevronLeftIcon,
		ChevronRightIcon,
		CalendarIcon,
		MenuIcon,
		LocationIcon,
		FilterIcon
	} from '../icons';

	/**
	 * @typedef {import('../../types/calendar.js').CalendarViewMode} CalendarViewMode
	 * @typedef {'calendar' | 'list' | 'map'} PresentationViewMode
	 */

	// Props using Svelte 5 runes
	let {
		currentDate,
		viewMode,
		presentationViewMode = 'calendar',
		communityMode = false,
		onPrevious,
		onNext,
		onToday,
		onViewModeChange,
		onPresentationViewModeChange = () => {},
		onFilterButtonClick = () => {}
	} = $props();

	// Debug: Inspect prop changes
	$inspect(currentDate);
	$inspect(viewMode);

	// Format current date for display based on view mode
	let displayDate = $derived(getDisplayDate(currentDate, viewMode));

	/**
	 * Get formatted date string for current view
	 * @param {Date} date
	 * @param {CalendarViewMode} mode
	 * @returns {string}
	 */
	function getDisplayDate(date, mode) {
		switch (mode) {
			case 'all':
				return m.calendar_navigation_all_events();
			case 'month':
				return formatCalendarDate(date, 'long');
			case 'week':
				// Show week range
				const startOfWeek = new Date(date);
				startOfWeek.setDate(date.getDate() - date.getDay());
				const endOfWeek = new Date(startOfWeek);
				endOfWeek.setDate(startOfWeek.getDate() + 6);

				if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
					return `${formatCalendarDate(startOfWeek, 'short')} - ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
				} else {
					return `${formatCalendarDate(startOfWeek, 'short')} - ${formatCalendarDate(endOfWeek, 'short')}`;
				}
			case 'day':
				return formatCalendarDate(date, 'full');
			default:
				return formatCalendarDate(date, 'full');
		}
	}

	/**
	 * Handle view mode button click
	 * @param {CalendarViewMode} mode
	 */
	function handleViewModeClick(mode) {
		console.log('🔄 handleViewModeClick called with mode:', mode);
		
		// Update URL with new period - let useCalendarUrlSync handle state updates
		updateQueryParams($page.url.searchParams, { 
			period: mode === 'month' ? null : mode // Don't include 'month' as it's the default
		});
		
		// NOTE: Don't call onViewModeChange here - let URL sync effect handle it
		// This prevents race conditions between async URL updates and sync callbacks
		console.log('✅ URL updated, waiting for sync effect');
	}

	/**
	 * Handle previous button click
	 */
	function handlePreviousClick() {
		console.log('🔄 Previous button clicked');
		onPrevious();
		console.log('✅ onPrevious callback completed');
	}

	/**
	 * Handle next button click
	 */
	function handleNextClick() {
		console.log('🔄 Next button clicked');
		onNext();
		console.log('✅ onNext callback completed');
	}

	/**
	 * Handle today button click
	 */
	function handleTodayClick() {
		console.log('🔄 Today button clicked');
		onToday();
		console.log('✅ onToday callback completed');
	}

	/**
	 * Handle presentation view mode button click
	 * @param {PresentationViewMode} mode
	 */
	function handlePresentationViewModeClick(mode) {
		console.log('🔄 handlePresentationViewModeClick called with mode:', mode);
		
		// Update URL with new view mode - let useCalendarUrlSync handle state updates
		updateQueryParams($page.url.searchParams, { 
			view: mode === 'calendar' ? null : mode // Don't include 'calendar' as it's the default
		});
		
		// NOTE: Don't call onPresentationViewModeChange here - let URL sync effect handle it
		// This prevents race conditions between async URL updates and sync callbacks
		console.log('✅ URL updated, waiting for sync effect');
	}
</script>

<div class="border-b border-base-300 bg-base-100">
	<!-- Mobile Layout (< lg) -->
	<div class="flex flex-col gap-3 p-3 lg:hidden">
		<!-- Row 1: Filter button, Date navigation and current date -->
		<div class="flex items-center gap-2">
			<!-- Mobile Filter Button (hidden in community mode) -->
			{#if !communityMode}
				<button
					class="btn btn-square"
					onclick={onFilterButtonClick}
					title="Open filters"
					aria-label="Open filters"
				>
					<FilterIcon class_="h-5 w-5" />
				</button>
			{/if}

			<!-- Date Navigation - Hidden in 'all' mode -->
			{#if viewMode !== 'all'}
				<div class="flex flex-1 items-center justify-between gap-2">
					<button
						class="btn btn-outline btn-sm"
						onclick={handlePreviousClick}
						aria-label="Previous {viewMode}"
					>
						<ChevronLeftIcon class_="w-5 h-5" />
					</button>

					<button class="btn btn-sm btn-primary" onclick={handleTodayClick}>{m.common_today()}</button>

					<button
						class="btn btn-outline btn-sm"
						onclick={handleNextClick}
						aria-label="Next {viewMode}"
					>
						<ChevronRightIcon class_="w-5 h-5" />
					</button>
				</div>
			{:else}
				<div class="flex-1 text-center text-lg font-semibold text-base-content">{m.calendar_navigation_all_events()}</div>
			{/if}

			<!-- Add Calendar Button -->
			{#if !communityMode && !$page.url.pathname.endsWith('/calendar')}
				<AddToCalendarButton />
			{/if}
		</div>

		<!-- Row 2: Current Date Display (only if not in 'all' mode) -->
		{#if viewMode !== 'all'}
			<div class="text-center text-base font-semibold text-base-content">
				{displayDate}
			</div>
		{/if}

		<!-- Row 3: View Mode Selectors -->
		<div class="flex items-center justify-center gap-2">
			<!-- Presentation View Selector -->
			<div class="join join-horizontal">
				<button
					class="btn join-item btn-sm"
					class:btn-outline={presentationViewMode !== 'calendar'}
					class:btn-primary={presentationViewMode === 'calendar'}
					onclick={(e) => handlePresentationViewModeClick('calendar')}
					title="Calendar Grid View"
				>
					<CalendarIcon class_="w-4 h-4" />
				</button>
				<button
					class="btn join-item btn-sm"
					class:btn-outline={presentationViewMode !== 'list'}
					class:btn-primary={presentationViewMode === 'list'}
					onclick={(e) => handlePresentationViewModeClick('list')}
					title="List View"
				>
					<MenuIcon class_="w-4 h-4" />
				</button>
				<button
					class="btn join-item btn-sm"
					class:btn-outline={presentationViewMode !== 'map'}
					class:btn-primary={presentationViewMode === 'map'}
					onclick={(e) => handlePresentationViewModeClick('map')}
					title="Map View"
				>
					<LocationIcon class_="w-4 h-4" />
				</button>
			</div>

			<!-- Calendar View Mode Selector -->
			<div class="join join-horizontal">
				{#if presentationViewMode === 'list'}
					<button
						class="btn join-item btn-sm"
						class:btn-outline={viewMode !== 'all'}
						class:btn-primary={viewMode === 'all'}
						onclick={() => handleViewModeClick('all')}
					>
						All
					</button>
				{/if}
				<button
					class="btn join-item btn-sm"
					class:btn-outline={viewMode !== 'month'}
					class:btn-primary={viewMode === 'month'}
					onclick={() => handleViewModeClick('month')}
				>
					Month
				</button>
				<button
					class="btn join-item btn-sm"
					class:btn-outline={viewMode !== 'week'}
					class:btn-primary={viewMode === 'week'}
					onclick={() => handleViewModeClick('week')}
				>
					Week
				</button>
				<button
					class="btn join-item btn-sm"
					class:btn-outline={viewMode !== 'day'}
					class:btn-primary={viewMode === 'day'}
					onclick={() => handleViewModeClick('day')}
				>
					Day
				</button>
			</div>
		</div>
	</div>

	<!-- Desktop Layout (>= lg) -->
	<div class="hidden items-center justify-between gap-4 p-4 lg:flex">
		<!-- Mobile Filter Button (visible only on mobile, hidden in community mode) -->
		{#if !communityMode}
			<button
				class="btn btn-square btn-sm lg:hidden"
				onclick={onFilterButtonClick}
				title="Open filters"
				aria-label="Open filters"
			>
				<FilterIcon class_="h-5 w-5" />
			</button>
		{/if}

		<!-- Date Navigation - Hidden in 'all' mode -->
		{#if viewMode !== 'all'}
			<div class="flex items-center gap-4">
				<button
					class="btn btn-outline btn-sm"
					onclick={handlePreviousClick}
					aria-label="Previous {viewMode}"
				>
					<ChevronLeftIcon class_="w-5 h-5" />
				</button>

				<!-- Today Button -->
				<button class="btn btn-sm btn-primary" onclick={handleTodayClick}>{m.common_today()}</button>

				<button
					class="btn btn-outline btn-sm"
					onclick={handleNextClick}
					aria-label="Next {viewMode}"
				>
					<ChevronRightIcon class_="w-5 h-5" />
				</button>

				<div class="min-w-0 whitespace-nowrap text-lg font-semibold text-base-content">
					{displayDate}
				</div>
			</div>
		{:else}
			<!-- In 'all' mode, show a simple heading instead -->
			<div class="flex items-center gap-4">
				<div class="text-lg font-semibold text-base-content">{m.calendar_navigation_all_events()}</div>
			</div>
		{/if}

		<!-- Center Controls -->
		<div class="flex items-center gap-4">
			<!-- Presentation View Selector -->
			<div class="join">
				<button
					class="btn join-item btn-sm"
					class:btn-outline={presentationViewMode !== 'calendar'}
					class:btn-primary={presentationViewMode === 'calendar'}
					onclick={(e) => handlePresentationViewModeClick('calendar')}
					title="Calendar Grid View"
				>
					<CalendarIcon class_="w-4 h-4" />
				</button>
				<button
					class="btn join-item btn-sm"
					class:btn-outline={presentationViewMode !== 'list'}
					class:btn-primary={presentationViewMode === 'list'}
					onclick={(e) => handlePresentationViewModeClick('list')}
					title="List View"
				>
					<MenuIcon class_="w-4 h-4" />
				</button>
				<button
					class="btn join-item btn-sm"
					class:btn-outline={presentationViewMode !== 'map'}
					class:btn-primary={presentationViewMode === 'map'}
					onclick={(e) => handlePresentationViewModeClick('map')}
					title="Map View"
				>
					<LocationIcon class_="w-4 h-4" />
				</button>
			</div>
		</div>

		<!-- Calendar View Mode Selector -->
		<div class="join">
			{#if presentationViewMode === 'list'}
				<button
					class="btn join-item btn-sm"
					class:btn-outline={viewMode !== 'all'}
					class:btn-primary={viewMode === 'all'}
					onclick={() => handleViewModeClick('all')}
				>
					{m.common_all()}
				</button>
			{/if}
			<button
				class="btn join-item btn-sm"
				class:btn-outline={viewMode !== 'month'}
				class:btn-primary={viewMode === 'month'}
					onclick={() => handleViewModeClick('month')}
				>
					{m.common_month()}
				</button>
				<button
					class="btn join-item btn-sm"
					class:btn-outline={viewMode !== 'week'}
					class:btn-primary={viewMode === 'week'}
					onclick={() => handleViewModeClick('week')}
				>
					{m.common_week()}
				</button>
				<button
					class="btn join-item btn-sm"
					class:btn-outline={viewMode !== 'day'}
					class:btn-primary={viewMode === 'day'}
					onclick={() => handleViewModeClick('day')}
				>
					{m.common_day()}
				</button>
		</div>
		{#if !communityMode && !$page.url.pathname.endsWith('/calendar')}
			<AddToCalendarButton />
		{/if}
	</div>
</div>
