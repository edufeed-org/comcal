<!--
  LocationLink Component
  Detects and renders URLs within location text as clickable links
  Supports:
  - URL-only strings: "https://example.com"
  - URLs with prefix: "Zoom: https://example.com"
  - Multiple URLs: "Primary: https://one.com Secondary: https://two.com"
  - Plain text: "Meeting room 101"
-->

<script>
	import { extractUrls, normalizeUrl } from '$lib/helpers/text.js';
	import { ExternalLinkIcon } from '$lib/components/icons';

	let { location = '' } = $props();

	// Extract all URLs from the location string
	let urlMatches = $derived(extractUrls(location));
	let hasUrls = $derived(urlMatches.length > 0);

	/**
	 * Parse location string into segments of text and links
	 */
	function renderSegments() {
		if (!hasUrls) {
			return [{ type: 'text', content: location }];
		}

		const segments = [];
		let lastIndex = 0;

		for (const match of urlMatches) {
			// Add text before URL if any
			if (match.start > lastIndex) {
				segments.push({
					type: 'text',
					content: location.substring(lastIndex, match.start)
				});
			}

			// Add URL as link
			segments.push({
				type: 'link',
				content: match.url,
				href: normalizeUrl(match.url)
			});

			lastIndex = match.end;
		}

		// Add remaining text after last URL if any
		if (lastIndex < location.length) {
			segments.push({
				type: 'text',
				content: location.substring(lastIndex)
			});
		}

		return segments;
	}

	let segments = $derived(renderSegments());
</script>

<span class="break-words">
	{#each segments as segment, i (i)}
		{#if segment.type === 'link'}
			<a
				href={segment.href}
				target="_blank"
				rel="noopener noreferrer"
				class="link link-primary inline-flex items-center gap-1 break-all hover:link-hover"
			>
				{segment.content}
				<ExternalLinkIcon class_="w-4 h-4 flex-shrink-0" />
			</a>
		{:else}
			{segment.content}
		{/if}
	{/each}
</span>
