<script>
  import { resolve } from '$app/paths';
  import { runtimeConfig } from '$lib/stores/config.svelte.js';
</script>

<footer class="border-t border-base-300 bg-base-200 p-4 text-base-content">
  <div class="container mx-auto max-w-7xl">
    <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <!-- GitHub Link -->
      <div class="text-center sm:text-left">
        <p class="text-sm">
          <!-- eslint-disable svelte/no-navigation-without-resolve -- external: git repo link -->
          <a
            href={runtimeConfig.gitRepo}
            target="_blank"
            rel="noopener noreferrer"
            class="link font-medium link-primary"
          >
            {runtimeConfig.appName}
          </a>
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
          - Built with <span class="animate-pulse">💜</span> on the nostr protocol,
          <span>{runtimeConfig.footer.fundingText}</span>
        </p>
      </div>

      <!-- Imprint Link -->
      {#if runtimeConfig.imprint.enabled}
        <div class="text-center sm:text-right">
          <a href={resolve('/imprint')} class="link text-sm whitespace-nowrap link-hover">
            Imprint
          </a>
        </div>
      {/if}
    </div>
  </div>
</footer>
