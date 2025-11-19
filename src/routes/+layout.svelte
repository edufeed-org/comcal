<script>
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import ModalManager from '$lib/components/ModalManager.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
</script>

<Navbar />
<ModalManager />
{@render children?.()}
<Footer />
