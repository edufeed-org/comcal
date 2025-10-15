<!--
  CalendarNavigation Component
  Navigation controls for calendar view switching and date navigation
-->

<script>
	import { page } from '$app/stores';
	import { formatCalendarDate } from '../../helpers/calendar.js';
	import { updateQueryParams } from '../../helpers/urlParams.js';
	import AddToCalendarButton from './AddToCalendarButton.svelte';

	import {
		ChevronLeftIcon,
		ChevronRightIcon,
		CalendarIcon,
		MenuIcon,
		LocationIcon
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
		onPrevious,
		onNext,
		onToday,
		onViewModeChange,
		onPresentationViewModeChange = () => {}
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
				return 'All Events';
			case 'month':
				return date.toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long'
				});
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
		onViewModeChange(mode);
		console.log('✅ onViewModeChange callback completed');
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
		
		// Update URL with new view mode
		updateQueryParams($page.url.searchParams, { 
			view: mode === 'calendar' ? null : mode // Don't include 'calendar' as it's the default
		});
		
		onPresentationViewModeChange(mode);
		console.log('✅ onPresentationViewModeChange callback completed');
	}
</script>

<div class="flex items-center justify-between gap-4 border-b border-base-300 bg-base-100 p-4">
	<!-- Date Navigation -->
	<div class="flex items-center gap-4">
		<button
			class="btn btn-outline btn-sm"
			onclick={handlePreviousClick}
			aria-label="Previous {viewMode}"
		>
			<ChevronLeftIcon class_="w-5 h-5" />
		</button>

		<!-- Today Button -->
		<button class="btn btn-sm btn-primary" onclick={handleTodayClick}> Today </button>

		<button class="btn btn-outline btn-sm" onclick={handleNextClick} aria-label="Next {viewMode}">
			<ChevronRightIcon class_="w-5 h-5" />
		</button>

		<div class="min-w-0 text-lg font-semibold whitespace-nowrap text-base-content">
			{displayDate}
		</div>
	</div>

	<!-- Center Controls -->
	<div class="flex items-center gap-4">
		<!-- Presentation View Selector -->
		<div class="join">
			<button
				class="btn join-item btn-sm"
				class:btn-outline={presentationViewMode !== 'calendar'}
				class:btn-primary={presentationViewMode === 'calendar'}
				onclick={() => handlePresentationViewModeClick('calendar')}
				title="Calendar Grid View"
			>
				<CalendarIcon class_="w-4 h-4" />
			</button>
			<button
				class="btn join-item btn-sm"
				class:btn-outline={presentationViewMode !== 'list'}
				class:btn-primary={presentationViewMode === 'list'}
				onclick={() => handlePresentationViewModeClick('list')}
				title="List View"
			>
				<MenuIcon class_="w-4 h-4" />
			</button>
			<button
				class="btn join-item btn-sm"
				class:btn-outline={presentationViewMode !== 'map'}
				class:btn-primary={presentationViewMode === 'map'}
				onclick={() => handlePresentationViewModeClick('map')}
				title="Map View (Coming Soon)"
				disabled
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
	<AddToCalendarButton />
</div>
