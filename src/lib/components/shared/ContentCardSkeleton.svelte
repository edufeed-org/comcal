<!--
  ContentCardSkeleton Component
  DaisyUI skeleton placeholder for content cards in discover feed
-->

<script>
  let { variant = 'card' } = $props();
</script>

{#if variant === 'list'}
  <!-- List variant skeleton -->
  <div class="flex items-center gap-3 rounded-lg border border-base-300 p-3">
    <div class="h-16 w-16 shrink-0 skeleton rounded"></div>
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <div class="h-4 w-3/4 skeleton"></div>
      <div class="h-3 w-1/2 skeleton"></div>
      <div class="h-3 w-2/3 skeleton"></div>
    </div>
  </div>
{:else}
  <!-- Card variant skeleton -->
  <div class="card rounded-lg border border-base-300 bg-base-100 p-4">
    <!-- Author Header Skeleton -->
    <div class="mb-3 flex items-center gap-3">
      <div class="h-10 w-10 shrink-0 skeleton rounded-full"></div>
      <div class="flex flex-1 flex-col gap-2">
        <div class="h-4 w-24 skeleton"></div>
        <div class="h-3 w-16 skeleton"></div>
      </div>
    </div>

    <!-- Image Skeleton -->
    <div class="mb-3 h-32 w-full skeleton rounded-lg"></div>

    <!-- Title Skeleton -->
    <div class="mb-2 h-6 w-3/4 skeleton"></div>

    <!-- Summary Skeleton -->
    <div class="mb-3 flex flex-col gap-2">
      <div class="h-3 w-full skeleton"></div>
      <div class="h-3 w-full skeleton"></div>
      <div class="h-3 w-2/3 skeleton"></div>
    </div>

    <!-- Tags Skeleton -->
    <div class="mb-3 flex gap-2">
      <div class="h-5 w-16 skeleton rounded-full"></div>
      <div class="h-5 w-20 skeleton rounded-full"></div>
      <div class="h-5 w-14 skeleton rounded-full"></div>
    </div>

    <!-- Button Skeleton -->
    <div class="h-8 w-28 skeleton rounded-lg"></div>
  </div>
{/if}
