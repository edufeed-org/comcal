<!--
  EventDebugInfo Component
  Collapsible debug information panel for calendar events
-->

<script>
	/**
	 * @typedef {import('../../types/calendar.js').CalendarEvent} CalendarEvent
	 */

	// Props using Svelte 5 runes syntax
	let { event } = $props();

	// Debug panel state
	let isDebugVisible = $state(false);
	let isJsonExpanded = $state(false);

	/**
	 * Toggle debug panel visibility
	 */
	function toggleDebugVisibility() {
		isDebugVisible = !isDebugVisible;
	}

	/**
	 * Toggle JSON expansion
	 */
	function toggleJsonExpansion() {
		isJsonExpanded = !isJsonExpanded;
	}

	/**
	 * Copy text to clipboard
	 * @param {string} text
	 * @param {string} label
	 */
	async function copyToClipboard(text, label) {
		try {
			await navigator.clipboard.writeText(text);
			console.log(`${label} copied to clipboard`);
			// Could add toast notification here if desired
		} catch (err) {
			console.error(`Failed to copy ${label}:`, err);
		}
	}

	/**
	 * Copy event ID to clipboard
	 */
	async function copyEventId() {
		if (event?.id) {
			await copyToClipboard(event.id, 'Event ID');
		}
	}

	/**
	 * Copy full JSON to clipboard
	 */
	async function copyFullJson() {
		if (event) {
			const jsonString = JSON.stringify(event, null, 2);
			await copyToClipboard(jsonString, 'Event JSON');
		}
	}

	/**
	 * Format timestamp for display
	 * @param {number} timestamp
	 * @returns {string}
	 */
	function formatTimestamp(timestamp) {
		if (!timestamp) return 'N/A';
		const date = new Date(timestamp * 1000);
		return `${date.toLocaleString()} (${timestamp})`;
	}

	/**
	 * Get formatted JSON string
	 * @param {any} obj
	 * @returns {string}
	 */
	function getFormattedJson(obj) {
		return JSON.stringify(obj, null, 2);
	}

	/**
	 * Get event kind description
	 * @param {number} kind
	 * @returns {string}
	 */
	function getKindDescription(kind) {
		const kindMap = /** @type {Record<number, string>} */ ({
			31922: 'Date-based Calendar Event',
			31923: 'Time-based Calendar Event',
			31924: 'Calendar',
			31925: 'Calendar Event RSVP'
		});
		return kindMap[kind] || `Unknown (${kind})`;
	}
</script>

<!-- Debug Information Panel -->
<div class="border-t border-base-300 pt-4">
	<!-- Debug Toggle Header -->
	<div class="flex items-center justify-between mb-3">
		<button
			class="flex items-center gap-2 text-sm font-medium text-base-content hover:text-primary transition-colors"
			onclick={toggleDebugVisibility}
		>
			<svg 
				class="w-4 h-4 transition-transform duration-200 {isDebugVisible ? 'rotate-90' : ''}" 
				fill="none" 
				stroke="currentColor" 
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
			<span class="flex items-center gap-1">
				🔧 Debug Information
				{#if isDebugVisible}
					<span class="badge badge-xs badge-primary">Active</span>
				{/if}
			</span>
		</button>
	</div>

	<!-- Debug Content (Collapsible) -->
	{#if isDebugVisible}
		<div class="bg-base-200 rounded-lg p-4 space-y-4">
			<!-- Basic Information -->
			<div>
				<h4 class="text-sm font-semibold text-base-content mb-2">Basic Information</h4>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
					<div class="flex items-center justify-between bg-base-100 rounded p-2">
						<span class="text-base-content/70">Event ID:</span>
						<div class="flex items-center gap-2">
							<code class="text-xs font-mono">{event.id.slice(0, 8)}...{event.id.slice(-4)}</code>
							<button
								class="btn btn-xs btn-ghost text-base-content/50 hover:text-base-content"
								onclick={copyEventId}
								title="Copy full event ID"
							>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							</button>
						</div>
					</div>
					<div class="flex items-center justify-between bg-base-100 rounded p-2">
						<span class="text-base-content/70">Kind:</span>
						<code class="text-xs font-mono" title={getKindDescription(event.kind)}>{event.kind}</code>
					</div>
					<div class="flex items-center justify-between bg-base-100 rounded p-2">
						<span class="text-base-content/70">Created by:</span>
						<code class="text-xs font-mono">{event.pubkey.slice(0, 8)}...{event.pubkey.slice(-4)}</code>
					</div>
					{#if event.dTag}
						<div class="flex items-center justify-between bg-base-100 rounded p-2">
							<span class="text-base-content/70">dTag:</span>
							<code class="text-xs font-mono">{event.dTag}</code>
						</div>
					{/if}
				</div>
			</div>

			<!-- Technical Details -->
			<div>
				<h4 class="text-sm font-semibold text-base-content mb-2">Technical Details</h4>
				<div class="space-y-2 text-xs">
					<div class="flex items-center justify-between bg-base-100 rounded p-2">
						<span class="text-base-content/70">Created:</span>
						<code class="text-xs font-mono">{formatTimestamp(event.createdAt)}</code>
					</div>
					{#if event.start}
						<div class="flex items-center justify-between bg-base-100 rounded p-2">
							<span class="text-base-content/70">Start (raw):</span>
							<code class="text-xs font-mono">{formatTimestamp(event.start)}</code>
						</div>
					{/if}
					{#if event.end}
						<div class="flex items-center justify-between bg-base-100 rounded p-2">
							<span class="text-base-content/70">End (raw):</span>
							<code class="text-xs font-mono">{formatTimestamp(event.end)}</code>
						</div>
					{/if}
					{#if event.geohash}
						<div class="flex items-center justify-between bg-base-100 rounded p-2">
							<span class="text-base-content/70">Geohash:</span>
							<code class="text-xs font-mono">{event.geohash}</code>
						</div>
					{/if}
					{#if (/** @type {any} */ (event)).signature}
						<div class="flex items-center justify-between bg-base-100 rounded p-2">
							<span class="text-base-content/70">Signature:</span>
							<code class="text-xs font-mono">{(/** @type {any} */ (event)).signature.slice(0, 8)}...{(/** @type {any} */ (event)).signature.slice(-4)}</code>
						</div>
					{/if}
				</div>
			</div>

			<!-- Tags Information -->
			{#if (/** @type {any} */ (event)).tags && (/** @type {any} */ (event)).tags.length > 0}
				<div>
					<h4 class="text-sm font-semibold text-base-content mb-2">Tags ({(/** @type {any} */ (event)).tags.length})</h4>
					<div class="bg-base-100 rounded p-2 max-h-32 overflow-y-auto">
						<pre class="text-xs font-mono text-base-content/80">{getFormattedJson((/** @type {any} */ (event)).tags)}</pre>
					</div>
				</div>
			{/if}

			<!-- Raw Content -->
			{#if (/** @type {any} */ (event)).content}
				<div>
					<h4 class="text-sm font-semibold text-base-content mb-2">Raw Content</h4>
					<div class="bg-base-100 rounded p-2 max-h-24 overflow-y-auto">
						<pre class="text-xs font-mono text-base-content/80 whitespace-pre-wrap">{(/** @type {any} */ (event)).content}</pre>
					</div>
				</div>
			{/if}

			<!-- Full Event JSON -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<h4 class="text-sm font-semibold text-base-content">Raw Event JSON</h4>
					<div class="flex items-center gap-2">
						<button
							class="btn btn-xs btn-ghost"
							onclick={copyFullJson}
							title="Copy full JSON"
						>
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
							Copy
						</button>
						<button
							class="btn btn-xs btn-ghost"
							onclick={toggleJsonExpansion}
						>
							{isJsonExpanded ? 'Collapse' : 'Expand'}
						</button>
					</div>
				</div>
				<div class="bg-base-100 rounded p-2 {isJsonExpanded ? 'max-h-96' : 'max-h-32'} overflow-y-auto transition-all duration-200">
					<pre class="text-xs font-mono text-base-content/80">{getFormattedJson(event)}</pre>
				</div>
			</div>
		</div>
	{/if}
</div>
