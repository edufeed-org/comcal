<script>
	import CommunityCalendar from '$lib/components/calendar/CommunityCalendar.svelte';
	import SimpleCalendarView from '../calendar-simple/SimpleCalendarView.svelte';
	import { page } from '$app/stores';
	
	// Check URL parameter to determine which implementation to use
	let useSimple = $derived($page.url.searchParams.get('simple') === 'true');
</script>

<svelte:head>
	<title>Global Calendar - Communikey</title>
	<meta name="description" content="Global calendar showing NIP-52 calendar events from all communities" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Implementation Switcher -->
	<div class="mb-6 p-4 bg-base-200 rounded-lg">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-base-content">Calendar Implementation</h2>
				<p class="text-sm text-base-content/60">
					Currently using: <strong>{useSimple ? 'Simple' : 'Complex'}</strong> implementation
				</p>
			</div>
			<div class="flex gap-2">
				<a 
					href="/calendar" 
					class="btn btn-sm"
					class:btn-primary={!useSimple}
					class:btn-outline={useSimple}
				>
					Complex
				</a>
				<a 
					href="/calendar?simple=true" 
					class="btn btn-sm"
					class:btn-primary={useSimple}
					class:btn-outline={!useSimple}
				>
					Simple
				</a>
			</div>
		</div>
		
		{#if useSimple}
			<div class="mt-3 p-3 bg-success/10 border border-success/20 rounded">
				<p class="text-sm text-success-content">
					✅ Using simplified implementation with direct timeline loader approach (~150 lines vs ~400+ lines)
				</p>
			</div>
		{:else}
			<div class="mt-3 p-3 bg-warning/10 border border-warning/20 rounded">
				<p class="text-sm text-warning-content">
					⚠️ Using complex implementation with multiple stores and intricate subscription management
				</p>
			</div>
		{/if}
	</div>

	<!-- Render appropriate calendar implementation -->
	{#if useSimple}
		<SimpleCalendarView globalMode={true} />
	{:else}
		<CommunityCalendar globalMode={true} />
	{/if}
</div>
