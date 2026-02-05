<!--
  ContentCardSkeleton Component
  DaisyUI skeleton placeholder for content cards in discover feed
-->

<script>
	let { variant = 'card' } = $props();
</script>

{#if variant === 'list'}
	<!-- List variant skeleton -->
	<div class="flex items-center gap-3 p-3 border border-base-300 rounded-lg">
		<div class="skeleton w-16 h-16 shrink-0 rounded"></div>
		<div class="flex flex-col gap-2 flex-1 min-w-0">
			<div class="skeleton h-4 w-3/4"></div>
			<div class="skeleton h-3 w-1/2"></div>
			<div class="skeleton h-3 w-2/3"></div>
		</div>
	</div>
{:else}
	<!-- Card variant skeleton -->
	<div class="card bg-base-100 border border-base-300 rounded-lg p-4">
		<!-- Author Header Skeleton -->
		<div class="flex items-center gap-3 mb-3">
			<div class="skeleton h-10 w-10 shrink-0 rounded-full"></div>
			<div class="flex flex-col gap-2 flex-1">
				<div class="skeleton h-4 w-24"></div>
				<div class="skeleton h-3 w-16"></div>
			</div>
		</div>

		<!-- Image Skeleton -->
		<div class="skeleton h-32 w-full rounded-lg mb-3"></div>

		<!-- Title Skeleton -->
		<div class="skeleton h-6 w-3/4 mb-2"></div>

		<!-- Summary Skeleton -->
		<div class="flex flex-col gap-2 mb-3">
			<div class="skeleton h-3 w-full"></div>
			<div class="skeleton h-3 w-full"></div>
			<div class="skeleton h-3 w-2/3"></div>
		</div>

		<!-- Tags Skeleton -->
		<div class="flex gap-2 mb-3">
			<div class="skeleton h-5 w-16 rounded-full"></div>
			<div class="skeleton h-5 w-20 rounded-full"></div>
			<div class="skeleton h-5 w-14 rounded-full"></div>
		</div>

		<!-- Button Skeleton -->
		<div class="skeleton h-8 w-28 rounded-lg"></div>
	</div>
{/if}
