<script>
	import FloatingActionButton from '$lib/components/calendar/FloatingActionButton.svelte';
	import { manager } from '$lib/accounts.svelte.js';

	// Track active user for conditional FAB display
	let activeUser = $state(manager.active);

	// Subscribe to account changes
	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});

		return () => {
			subscription.unsubscribe();
		};
	});
</script>

<!-- Child page content (calendar pages) -->
<slot />



{#if activeUser}

	<FloatingActionButton />
{/if}
