<script>
  import CalendarView from '$lib/components/calendar/CalendarView.svelte';
  import { runtimeConfig } from '$lib/stores/config.svelte.js';
</script>

<svelte:head>
  <title>Global Calendar - {runtimeConfig.appName}</title>
  <meta
    name="description"
    content="Global calendar showing NIP-52 calendar events from all communities"
  />
</svelte:head>

<div class="container mx-auto w-full max-w-full overflow-hidden px-4 py-8">
  <CalendarView globalMode={true} />
</div>
