<!--
  ImageWithFallback Component
  Displays an image with automatic fallback on load errors
  Supports different fallback types and maintains aspect ratios
-->

<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} src - Primary image source URL
	 * @property {string} alt - Alt text for accessibility
	 * @property {'avatar' | 'event' | 'community' | 'banner' | 'generic'} fallbackType - Type of fallback image to use
	 * @property {string} [class] - Additional CSS classes
	 * @property {'lazy' | 'eager'} [loading] - Loading attribute
	 */

	let {
		src,
		alt,
		fallbackType = 'generic',
		class: className = '',
		loading = 'lazy'
	} = $props();

	// Track current image source (primary or fallback)
	let currentSrc = $state(src);

	// Track if we're showing fallback
	let showingFallback = $state(false);

	// Get fallback image path based on type
	let fallbackSrc = $derived.by(() => {
		switch (fallbackType) {
			case 'avatar':
				return `https://robohash.org/${src}`;
			case 'event':
				return `https://robohash.org/${src}`;
			case 'community':
				return `https://robohash.org/${src}`;
			case 'banner':
				return `https://robohash.org/${src}`;
			default:
				return `https://robohash.org/${src}`; // Generic fallback
		}
	});

	// Handle image load error
	function handleError() {
		if (!showingFallback && currentSrc !== fallbackSrc) {
			// Switch to fallback image
			currentSrc = fallbackSrc;
			showingFallback = true;
		}
	}

	// Reset when src changes
	$effect(() => {
		currentSrc = src;
		showingFallback = false;
	});
</script>

<img
	src={currentSrc}
	alt={alt}
	loading={loading}
	class={className}
	onerror={handleError}
/>
