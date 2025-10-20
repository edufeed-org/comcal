<script>
	import { HomeIcon, ChatIcon, CalendarIcon, BellIcon, SettingsIcon } from '$lib/components/icons';

	let { selectedContentType = $bindable(), onContentTypeSelect } = $props();

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
	function handleTabClick(type) {
		if (onContentTypeSelect) {
			onContentTypeSelect(type);
		}
	}
</script>

<!-- Mobile: Bottom Tab Bar -->
<div class="btm-nav lg:hidden bg-base-100 border-t border-base-300 z-50">
	{#each contentTypes as type}
		{@const isActive = selectedContentType === type.id}
		<button
			class:active={isActive}
			onclick={() => handleTabClick(type.id)}
		>
			<svelte:component this={type.icon} class_="w-5 h-5" />
			<span class="btm-nav-label text-xs">{type.label}</span>
		</button>
	{/each}
</div>
