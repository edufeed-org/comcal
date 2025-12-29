<script>
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import ModalManager from '$lib/components/ModalManager.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { initializeConfig } from '$lib/stores/config.svelte.js';

	let { children, data } = $props();
	
	// Initialize runtime config on app load
	$effect(() => {
		initializeConfig(data.config);
	});
</script>

<Navbar />
<ModalManager />
{@render children?.()}
<Footer />
