<script>
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import ModalManager from '$lib/components/ModalManager.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { initializeConfig } from '$lib/stores/config.svelte.js';
	import { appSettings, initializeAppSettings } from '$lib/stores/app-settings.svelte.js';
	import { browser } from '$app/environment';

	let { children, data } = $props();
	
	// Initialize runtime config on app load
	$effect(() => {
		initializeConfig(data.config);
		// Re-initialize app settings after config is loaded
		initializeAppSettings();
	});
	
	// Apply theme to document
	$effect(() => {
		if (browser) {
			document.documentElement.setAttribute('data-theme', appSettings.effectiveTheme);
		}
	});
</script>

<Navbar />
<ModalManager />
{@render children?.()}
<Footer />
