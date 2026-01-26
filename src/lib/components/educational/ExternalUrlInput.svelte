<!--
  ExternalUrlInput Component
  Multi-entry input for managing external reference URLs (r-tags)
-->

<script>
	import { CloseIcon, PlusIcon } from '$lib/components/icons';

	/** @type {{ urls?: string[], label?: string, helpText?: string, onchange?: (urls: string[]) => void }} */
	let {
		urls = $bindable([]),
		label = 'External References',
		helpText = '',
		onchange = () => {}
	} = $props();

	let newUrl = $state('');

	/**
	 * Check if URL is valid
	 * @param {string} url
	 * @returns {boolean}
	 */
	function isValidUrl(url) {
		if (!url?.trim()) return false;
		try {
			const parsed = new URL(url.trim());
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	}

	/**
	 * Add a new URL
	 */
	function addUrl() {
		const trimmed = newUrl.trim();
		if (!isValidUrl(trimmed)) return;
		if (urls.includes(trimmed)) return; // No duplicates

		urls = [...urls, trimmed];
		newUrl = '';
		onchange(urls);
	}

	/**
	 * Remove a URL
	 * @param {number} index
	 */
	function removeUrl(index) {
		urls = urls.filter((_, i) => i !== index);
		onchange(urls);
	}

	/**
	 * Handle enter key in input
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addUrl();
		}
	}

	/**
	 * Handle blur - auto-add valid URL when input loses focus
	 */
	function handleBlur() {
		if (isValidUrl(newUrl)) {
			addUrl();
		}
	}

	const canAdd = $derived(isValidUrl(newUrl));
</script>

<div class="external-url-input form-control w-full">
	<!-- Label -->
	{#if label}
		<label class="label">
			<span class="label-text font-medium">{label}</span>
		</label>
	{/if}

	<!-- Existing URLs List -->
	{#if urls.length > 0}
		<div class="space-y-2 mb-3">
			{#each urls as url, index}
				<div class="flex items-center gap-2 p-2 bg-base-200 rounded-lg">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-4 h-4 text-base-content/60 shrink-0"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
						/>
					</svg>
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex-1 text-sm link link-primary truncate"
					>
						{url}
					</a>
					<button
						type="button"
						class="btn btn-ghost btn-xs text-error"
						onclick={() => removeUrl(index)}
						aria-label="Remove URL"
					>
						<CloseIcon class_="w-4 h-4" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Add URL Input -->
	<div class="flex gap-2">
		<input
			type="url"
			class="input input-bordered input-sm flex-1"
			bind:value={newUrl}
			onkeydown={handleKeydown}
			onblur={handleBlur}
			placeholder="https://youtube.com/... or other URL"
		/>
		<button
			type="button"
			class="btn btn-outline btn-sm"
			onclick={addUrl}
			disabled={!canAdd}
		>
			<PlusIcon class_="w-4 h-4" />
			Add
		</button>
	</div>

	<!-- Help Text -->
	{#if helpText}
		<label class="label">
			<span class="label-text-alt text-base-content/60">{helpText}</span>
		</label>
	{/if}
</div>
