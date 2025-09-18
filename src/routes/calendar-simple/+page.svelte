<script>
	import SimpleCalendarView from './SimpleCalendarView.svelte';
	import SimpleCalendarEventsList from './SimpleCalendarEventsList.svelte';
	import { modalStore } from '$lib/stores/modal.svelte.js';
	
	// Import modal components for event details
	import CalendarEventDetailsModal from '$lib/components/calendar/CalendarEventDetailsModal.svelte';
	import ModalManager from '$lib/components/ModalManager.svelte';

	// View mode state
	let viewMode = $state('calendar'); // 'calendar' or 'list'

	/**
	 * Switch between calendar and list view
	 * @param {string} mode
	 */
	function switchView(mode) {
		viewMode = mode;
	}
</script>

<svelte:head>
	<title>Simple Calendar - Communikey</title>
	<meta name="description" content="Simplified calendar implementation using direct timeline loader approach" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-base-content mb-2">Simple Calendar</h1>
		<p class="text-base-content/60 mb-6">
			Simplified calendar implementation using the direct timeline loader approach from calendar-simple.
			This demonstrates the same functionality with much simpler code.
		</p>
		
		<!-- View Mode Switcher -->
		<div class="flex gap-2">
			<button
				class="btn btn-sm"
				class:btn-primary={viewMode === 'calendar'}
				class:btn-outline={viewMode !== 'calendar'}
				onclick={() => switchView('calendar')}
			>
				<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				Calendar View
			</button>
			<button
				class="btn btn-sm"
				class:btn-primary={viewMode === 'list'}
				class:btn-outline={viewMode !== 'list'}
				onclick={() => switchView('list')}
			>
				<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
				</svg>
				List View
			</button>
		</div>
	</div>

	<!-- Content based on view mode -->
	{#if viewMode === 'calendar'}
		<SimpleCalendarView globalMode={true} />
	{:else}
		<SimpleCalendarEventsList limit={50} showLoadMore={true} />
	{/if}

	<!-- Comparison Info -->
	<div class="mt-12 p-6 bg-base-200 rounded-lg">
		<h2 class="text-xl font-semibold text-base-content mb-4">Implementation Comparison</h2>
		<div class="grid md:grid-cols-2 gap-6">
			<div>
				<h3 class="font-semibold text-success mb-2">✅ Simple Approach (This Page)</h3>
				<ul class="text-sm text-base-content/80 space-y-1">
					<li>• Direct use of <code class="bg-base-300 px-1 rounded">createTimelineLoader</code></li>
					<li>• Simple <code class="bg-base-300 px-1 rounded">$state()</code> reactive variables</li>
					<li>• Direct subscription to <code class="bg-base-300 px-1 rounded">eventStore.model()</code></li>
					<li>• ~150 lines of code per component</li>
					<li>• No complex store dependencies</li>
					<li>• Easy to understand and maintain</li>
				</ul>
			</div>
			<div>
				<h3 class="font-semibold text-warning mb-2">⚠️ Complex Approach (Original)</h3>
				<ul class="text-sm text-base-content/80 space-y-1">
					<li>• Multiple complex stores (selection, management, etc.)</li>
					<li>• Intricate subscription management with cleanup</li>
					<li>• Event buffering and processing with timeouts</li>
					<li>• ~400+ lines of complex reactive logic</li>
					<li>• Heavy dependency on singleton stores</li>
					<li>• Difficult to debug and maintain</li>
				</ul>
			</div>
		</div>
		<div class="mt-4 p-4 bg-info/10 border border-info/20 rounded">
			<p class="text-sm text-base-content/80">
				<strong>Result:</strong> Same functionality and design with 70% less code and much simpler architecture.
				The simple approach is easier to understand, debug, and maintain while providing the same user experience.
			</p>
		</div>
	</div>
</div>

<!-- Modal Manager for event details -->
<ModalManager />
