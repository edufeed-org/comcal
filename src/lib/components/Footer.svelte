<script>
	import { runtimeConfig } from '$lib/stores/config.svelte.js';
</script>

<footer class="bg-base-200 text-base-content border-t border-base-300 p-4">
	<div class="container mx-auto max-w-7xl">
		<div class="flex flex-col sm:flex-row items-center justify-between gap-4">
			<!-- GitHub Link -->
			<div class="text-center sm:text-left">
			<p class="text-sm">
				<a href={runtimeConfig.gitRepo} target="_blank" rel="noopener noreferrer" class="link link-primary font-medium">
					{runtimeConfig.appName}
				</a>
					- Built with <span class="animate-pulse">💜</span> on the nostr protocol,
					<span>gefördert vom BMBFSFJ (FKZ01PZ24007)</span>
				</p>
			</div>

		<!-- Imprint Link -->
		{#if runtimeConfig.imprint.enabled}
				<div class="text-center sm:text-right">
					<a href="/imprint" class="link link-hover text-sm whitespace-nowrap">
						Imprint
					</a>
				</div>
			{/if}
		</div>
	</div>
</footer>
