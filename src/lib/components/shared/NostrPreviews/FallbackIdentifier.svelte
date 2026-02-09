<!--
  FallbackIdentifier Component
  Displays a fallback badge for unrecognized or failed identifiers
-->

<script>
  import { CopyIcon } from '$lib/components/icons';

  let { identifier, decoded: _decoded } = $props();

  function copyToClipboard() {
    navigator.clipboard.writeText(identifier);
  }
</script>

<div class="badge inline-flex items-center gap-2 badge-outline">
  <span class="max-w-xs truncate">{identifier.slice(0, 20)}...</span>
  <button
    class="btn h-auto min-h-0 p-0 btn-ghost btn-xs"
    onclick={copyToClipboard}
    title="Copy identifier"
  >
    <CopyIcon class_="w-3 h-3" />
  </button>
</div>
