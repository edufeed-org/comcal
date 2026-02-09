<!--
  NotePreview Component
  Displays a compact badge for note/nevent identifiers
-->

<script>
  let { identifier } = $props();

  /** @type {string} */
  let displayId = $derived(identifier.slice(0, 12) + '...');
</script>

<span class="badge inline-flex items-center gap-1 badge-outline badge-info">
  📝 {displayId}
</span>
