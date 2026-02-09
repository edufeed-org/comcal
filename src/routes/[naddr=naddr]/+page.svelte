<script>
  import CalendarView from '$lib/components/calendar/CalendarView.svelte';
  import ArticleView from '$lib/components/article/ArticleView.svelte';
  import AMBResourceView from '$lib/components/educational/AMBResourceView.svelte';
  import { getCalendarEventMetadata } from '$lib/helpers/eventUtils';
  import { formatAMBResource } from '$lib/helpers/educational';

  /** @type {{ data: any }} */
  let { data } = $props();

  // Transform event data based on kind
  const displayData = $derived.by(() => {
    if (!data.event) return null;

    // Calendar events (kinds 31922, 31923)
    if (data.kind === 31922 || data.kind === 31923) {
      return {
        type: 'calendar',
        calendar: getCalendarEventMetadata(data.event),
        rawCalendar: data.event
      };
    }

    // Long-form articles (kind 30023)
    if (data.kind === 30023) {
      return {
        type: 'article',
        event: data.event
      };
    }

    // AMB educational resource (kind 30142)
    if (data.kind === 30142) {
      return {
        type: 'amb',
        event: data.event,
        resource: formatAMBResource(data.event)
      };
    }

    // Unsupported kind
    return {
      type: 'unsupported',
      kind: data.kind
    };
  });

  // Derive page title based on content type
  const pageTitle = $derived.by(() => {
    if (displayData?.type === 'calendar') {
      return `${displayData.calendar?.title || 'Calendar Event'} - Communikey`;
    } else if (displayData?.type === 'article') {
      const titleTag = data.event?.tags?.find((/** @type {any} */ t) => t[0] === 'title');
      return `${titleTag?.[1] || 'Article'} - Communikey`;
    } else if (displayData?.type === 'amb') {
      return `${displayData.resource?.name || 'Educational Resource'} - Communikey`;
    }
    return 'Content - Communikey';
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content="View content on Communikey" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  {#if displayData?.type === 'calendar'}
    <!-- Calendar Event Display -->
    <CalendarView
      calendar={displayData.calendar}
      rawCalendar={displayData.rawCalendar}
      globalMode={false}
    />
  {:else if displayData?.type === 'article'}
    <!-- Article Display -->
    <ArticleView event={displayData.event} />
  {:else if displayData?.type === 'amb'}
    <!-- AMB Resource Display -->
    <AMBResourceView event={displayData.event} resource={displayData.resource} />
  {:else if displayData?.type === 'unsupported'}
    <!-- Unsupported Content Type -->
    <div class="alert alert-warning">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <div>
        <h3 class="font-bold">Unsupported Content Type</h3>
        <p class="text-sm">
          Content kind {displayData.kind} is not yet supported for display.
        </p>
      </div>
    </div>
  {:else}
    <!-- Loading or Error State -->
    <div class="alert alert-error">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>Failed to load content</span>
    </div>
  {/if}
</div>
