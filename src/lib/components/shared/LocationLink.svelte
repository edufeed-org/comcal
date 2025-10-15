<!--
  LocationLink Component
  Displays a location as a clickable link if it's a URL, otherwise as plain text
-->

<script>
	import { isUrl, normalizeUrl } from '$lib/helpers/text.js';
	import { ExternalLinkIcon } from '$lib/components/icons';

	let { location = '' } = $props();

	let isLink = $derived(isUrl(location));
	let href = $derived(isLink ? normalizeUrl(location) : '');
</script>

{#if isLink}
	<a
		{href}
		target="_blank"
		rel="noopener noreferrer"
		class="link link-primary inline-flex items-center gap-1 break-all hover:link-hover"
	>
		{location}
		<ExternalLinkIcon class_="w-4 h-4 flex-shrink-0" />
	</a>
{:else}
	<span class="break-words">{location}</span>
{/if}
