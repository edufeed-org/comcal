<script>
  import CalendarView from '$lib/components/calendar/CalendarView.svelte';

  /** @type {import('./$types').PageProps} */
  let { data } = $props();
</script>

<svelte:head>
  <title>My Events - Communikey</title>
  <meta name="description" content="View your calendar events" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  {#if data.pubkey}
    <CalendarView authorPubkey={data.pubkey} globalMode={false} />
  {:else}
    <div class="alert alert-error">
      <span>Invalid user identifier</span>
    </div>
  {/if}
</div>
