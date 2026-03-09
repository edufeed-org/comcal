<script>
  import CalendarManagement from '$lib/components/calendar/CalendarManagement.svelte';
  import { runtimeConfig } from '$lib/stores/config.svelte.js';
</script>

<svelte:head>
  <title>Manage Calendars - {runtimeConfig.appName}</title>
  <meta name="description" content="Manage your personal calendars on Nostr" />
</svelte:head>

<CalendarManagement />
