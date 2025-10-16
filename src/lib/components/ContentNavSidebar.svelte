<script>
	import { HomeIcon, ChatIcon, CalendarIcon, BellIcon, SettingsIcon } from '$lib/components/icons';

	let { selectedContentType = $bindable(), onContentTypeSelect, communitySelected = true } = $props();

	const contentTypes = [
		{ id: 'home', label: 'Home', icon: HomeIcon },
		{ id: 'chat', label: 'Chat', icon: ChatIcon },
		{ id: 'calendar', label: 'Calendar', icon: CalendarIcon },
		{ id: 'activity', label: 'Activity', icon: BellIcon },
		{ id: 'settings', label: 'Settings', icon: SettingsIcon }
	];

	/**
	 * Handle content type selection
	 * @param {string} type
	 */
	function handleContentTypeClick(type) {
		if (onContentTypeSelect) {
			onContentTypeSelect(type);
		}
	}
</script>

<!-- Desktop: Fixed right sidebar -->
<div class="hidden lg:flex flex-col w-60 bg-base-100 border-r border-base-300 h-[calc(100vh-4rem)] fixed left-16 top-16 overflow-y-auto">
	{#if !communitySelected}
		<div class="flex flex-col items-center justify-center h-full text-center p-6 text-base-content/60">
			<p class="text-sm">Select a community to view content</p>
		</div>
	{:else}
		<nav class="menu p-4 space-y-1">
			{#each contentTypes as type}
				{@const isActive = selectedContentType === type.id}
				<button
					onclick={() => handleContentTypeClick(type.id)}
					class="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 {isActive ? 'bg-primary text-primary-content' : 'hover:bg-base-200'}"
				>
					<svelte:component this={type.icon} class_="w-5 h-5" />
					<span class="text-sm font-medium">{type.label}</span>
				</button>
			{/each}
		</nav>
	{/if}
</div>
