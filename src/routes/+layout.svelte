<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/Navbar.svelte';
	import ModalManager from '$lib/components/ModalManager.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { page } from '$app/stores';

	let { children } = $props();

	// Show footer only on simple pages, hide on full-height app pages
	const showFooter = $derived(() => {
		const pathname = $page.url.pathname;
		
		// Hide footer on these routes
		const hideOnRoutes = [
			'/c/',           // Community pages
			'/calendar',     // Calendar pages (all sub-routes)
			'/feed',         // Feed pages
			'/accounts'      // Account management
		];
		
		return !hideOnRoutes.some(route => pathname.startsWith(route));
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Navbar />
<ModalManager />
{@render children?.()}
{#if showFooter()}
	<Footer />
{/if}
