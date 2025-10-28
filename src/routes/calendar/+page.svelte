<script>
	import CalendarView from '$lib/components/calendar/CalendarView.svelte';
</script>

<svelte:head>
	<title>Global Calendar - Communikey</title>
	<meta name="description" content="Global calendar showing NIP-52 calendar events from all communities" />
</svelte:head>

<div class="container mx-auto px-4 py-8 w-full max-w-full overflow-hidden">
	<CalendarView globalMode={true} />
</div>
