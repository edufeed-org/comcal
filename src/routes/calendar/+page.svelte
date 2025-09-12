<script>
	import CommunityCalendar from '$lib/components/calendar/CommunityCalendar.svelte';

</script>

<svelte:head>
	<title>Global Calendar - Communikey</title>
	<meta name="description" content="Global calendar showing NIP-52 calendar events from all communities" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<CommunityCalendar globalMode={true} />
</div>
