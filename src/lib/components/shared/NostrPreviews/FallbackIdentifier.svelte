<!--
  FallbackIdentifier Component
  Displays a fallback badge for unrecognized or failed identifiers
-->

<script>
	import { CopyIcon } from '$lib/components/icons';

	let { identifier, decoded } = $props();

	function copyToClipboard() {
		navigator.clipboard.writeText(identifier);
	}
</script>

<div class="inline-flex items-center gap-2 badge badge-outline">
	<span class="truncate max-w-xs">{identifier.slice(0, 20)}...</span>
	<button
		class="btn btn-ghost btn-xs p-0 min-h-0 h-auto"
		onclick={copyToClipboard}
		title="Copy identifier"
	>
		<CopyIcon class_="w-3 h-3" />
	</button>
</div>
