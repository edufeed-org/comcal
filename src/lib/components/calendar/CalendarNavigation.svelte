<!--
  CalendarNavigation Component
  Navigation controls for calendar view switching and date navigation
-->

<script>
	import { formatCalendarDate } from '../../helpers/calendar.js';

	/**
	 * @typedef {import('../../types/calendar.js').CalendarViewMode} CalendarViewMode
	 */

	// Props using Svelte 5 runes
	let { currentDate, viewMode, onPrevious, onNext, onToday, onViewModeChange } = $props();

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
</script>

<div class="flex items-center justify-between p-4 bg-base-100 border-b border-base-300 flex-wrap gap-4">
	<!-- Date Navigation -->
	<div class="flex items-center gap-4">
		<button
			class="btn btn-outline btn-sm"
			onclick={handlePreviousClick}
			aria-label="Previous {viewMode}"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
		</button>

		<div class="text-lg font-semibold text-base-content min-w-0 whitespace-nowrap">
			{displayDate}
		</div>

		<button
			class="btn btn-outline btn-sm"
			onclick={handleNextClick}
			aria-label="Next {viewMode}"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
		</button>
	</div>

	<!-- Today Button -->
	<button
		class="btn btn-primary btn-sm"
		onclick={handleTodayClick}
	>
		Today
	</button>

	<!-- View Mode Selector -->
	<div class="join">
		<button
			class="join-item btn btn-sm"
			class:btn-outline={viewMode !== 'month'}
			class:btn-primary={viewMode === 'month'}
			onclick={() => handleViewModeClick('month')}
		>
			Month
		</button>
		<button
			class="join-item btn btn-sm"
			class:btn-outline={viewMode !== 'week'}
			class:btn-primary={viewMode === 'week'}
			onclick={() => handleViewModeClick('week')}
		>
			Week
		</button>
		<button
			class="join-item btn btn-sm"
			class:btn-outline={viewMode !== 'day'}
			class:btn-primary={viewMode === 'day'}
			onclick={() => handleViewModeClick('day')}
		>
			Day
		</button>
	</div>
</div>
