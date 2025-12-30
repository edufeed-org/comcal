<script>
	import { appSettings } from '$lib/stores/app-settings.svelte.js';

	/** @type {Array<{value: 'default' | 'stil', label: string, icon: string}>} */
	const themeFamilies = [
		{ value: 'default', label: 'Default', icon: '🎨' },
		{ value: 'stil', label: 'STIL', icon: '🧡' }
	];

	/** @type {Array<{value: 'light' | 'dark' | 'system', label: string, icon: string}>} */
	const colorModes = [
		{ value: 'light', label: 'Light', icon: '☀️' },
		{ value: 'system', label: 'System', icon: '💻' },
		{ value: 'dark', label: 'Dark', icon: '🌙' }
	];
</script>

<div class="form-control">
	<label class="label">
		<span class="label-text">Theme Family</span>
	</label>
	<div class="flex gap-2">
		{#each themeFamilies as family}
			<button
				class="btn btn-sm flex-1"
				class:btn-primary={appSettings.themeFamily === family.value}
				class:btn-ghost={appSettings.themeFamily !== family.value}
				onclick={() => (appSettings.themeFamily = family.value)}
			>
				<span class="text-lg">{family.icon}</span>
				<span class="hidden sm:inline">{family.label}</span>
			</button>
		{/each}
	</div>
</div>

<div class="form-control mt-2">
	<label class="label">
		<span class="label-text">Color Mode</span>
	</label>
	<div class="flex gap-2">
		{#each colorModes as mode}
			<button
				class="btn btn-sm flex-1"
				class:btn-primary={appSettings.colorMode === mode.value}
				class:btn-ghost={appSettings.colorMode !== mode.value}
				onclick={() => (appSettings.colorMode = mode.value)}
			>
				<span class="text-lg">{mode.icon}</span>
				<span class="hidden sm:inline">{mode.label}</span>
			</button>
		{/each}
	</div>
	<label class="label">
		<span class="label-text-alt text-base-content/60">
			Current: {
				appSettings.effectiveTheme === 'light' ? '☀️ Light' :
				appSettings.effectiveTheme === 'dark' ? '🌙 Dark' :
				appSettings.effectiveTheme === 'stil' ? '🧡 STIL' :
				appSettings.effectiveTheme === 'stil-dark' ? '🖤 STIL Dark' :
				'Unknown'
			}
		</span>
	</label>
</div>
