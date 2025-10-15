<!--
  EventTags Component
  Displays clickable event tags that navigate to filtered calendar views
-->

<script>
	/**
	 * @typedef {Object} EventTagsProps
	 * @property {string[]} tags - Array of tag strings to display
	 * @property {'xs' | 'sm' | 'md' | 'lg'} [size='sm'] - Badge size
	 * @property {number} [maxDisplay] - Maximum number of tags to show before truncating
	 * @property {boolean} [showCount=true] - Show count of remaining tags if truncated
	 */

	let {
		tags = [],
		size = 'sm',
		maxDisplay = undefined,
		showCount = true
	} = $props();

	// Determine which tags to display
	let displayTags = $derived(maxDisplay && tags.length > maxDisplay 
		? tags.slice(0, maxDisplay) 
		: tags);
	
	let remainingCount = $derived(maxDisplay && tags.length > maxDisplay 
		? tags.length - maxDisplay 
		: 0);

	/**
	 * Handle tag click
	 * @param {MouseEvent} e
	 * @param {string} tag
	 */
	function handleTagClick(e, tag) {
		// Navigation is handled by the href, this is just for tracking
		console.log('Tag clicked:', tag);
	}
</script>

{#if tags.length > 0}
	<div class="flex flex-wrap gap-1">
		{#each displayTags as tag}
			<a
				href="/calendar?view=list&tags={encodeURIComponent(tag)}"
				class="badge badge-outline badge-{size} transition-colors hover:badge-primary focus:badge-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
				onclick={(e) => handleTagClick(e, tag)}
				title="View all events with #{tag}"
			>
				#{tag}
			</a>
		{/each}
		{#if showCount && remainingCount > 0}
			<span class="badge badge-ghost badge-{size} text-base-content/40">
				+{remainingCount} more
			</span>
		{/if}
	</div>
{/if}
