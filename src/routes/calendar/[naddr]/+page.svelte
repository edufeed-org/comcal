<script>
	import CalendarView from '$lib/components/calendar/CalendarView.svelte';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();
</script>

<p>{JSON.stringify(data.event)}</p>
<svelte:head>
	<title>Global Calendar - Communikey</title>
	<meta
		name="description"
		content="Global calendar showing NIP-52 calendar events from all communities"
	/>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<CalendarView globalMode={true} />
</div>
