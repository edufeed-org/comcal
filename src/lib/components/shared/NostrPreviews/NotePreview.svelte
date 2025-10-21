<!--
  NotePreview Component
  Displays a compact badge for note/nevent identifiers
-->

<script>
	let { identifier } = $props();

	/** @type {string} */
	let displayId = $derived(identifier.slice(0, 12) + '...');
</script>

<span class="inline-flex items-center gap-1 badge badge-outline badge-info">
	📝 {displayId}
</span>
