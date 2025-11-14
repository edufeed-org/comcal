<script>
	import { appConfig } from '$lib/config.js';
</script>

<footer class="footer footer-center bg-base-200 text-base-content border-t border-base-300 p-4">
	<div>
		<p class="text-sm">
			<a href={appConfig.gitRepo} target="_blank" rel="noopener noreferrer" class="link link-primary font-medium">
			{appConfig.name}	
			</a>
			 - Built with <span class="animate-pulse">💜</span> on the nostr protocol
		</p>
	</div>
</footer>
