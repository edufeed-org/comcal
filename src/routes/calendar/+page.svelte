<script>
	import SimpleCalendarView from '$lib/components/calendar/SimpleCalendarView.svelte';
</script>

<svelte:head>
	<title>Global Calendar - Communikey</title>
	<meta name="description" content="Global calendar showing NIP-52 calendar events from all communities" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<SimpleCalendarView globalMode={true} />
</div>
