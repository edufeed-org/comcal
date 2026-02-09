<script>
  import CalendarView from '$lib/components/calendar/CalendarView.svelte';

  /** @type {import('./$types').PageProps} */
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.calendar?.title || 'Calendar'} - Communikey</title>
  <meta name="description" content="View calendar events" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  {#if data.calendar}
    <CalendarView calendar={data.calendar} rawCalendar={data.rawCalendar} globalMode={false} />
  {:else}
    <div class="alert alert-error">
      <span>Calendar not found</span>
    </div>
  {/if}
</div>
