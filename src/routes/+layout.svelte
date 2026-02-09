<script>
  import '../app.css';
  import Navbar from '$lib/components/Navbar.svelte';
  import ModalManager from '$lib/components/ModalManager.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import PublishStatusToast from '$lib/components/shared/PublishStatusToast.svelte';
  import { initializeConfig, runtimeConfig } from '$lib/stores/config.svelte.js';
  import { appSettings, initializeAppSettings } from '$lib/stores/app-settings.svelte.js';
  import { browser } from '$app/environment';

  let { children, data } = $props();

  // Initialize runtime config synchronously on app load.
  // Use $effect.pre to run before child components mount while staying reactive.
  let configInitialized = false;
  $effect.pre(() => {
    if (!configInitialized && data.config) {
      initializeConfig(data.config);
      configInitialized = true;
    }
  });

  // Re-initialize app settings after config is loaded
  $effect(() => {
    initializeAppSettings();
  });

  // Apply theme to document
  $effect(() => {
    if (browser) {
      document.documentElement.setAttribute('data-theme', appSettings.effectiveTheme);
    }
  });

  // Pre-warm app relays on app init (fire-and-forget)
  $effect(() => {
    if (browser) {
      import('$lib/services/relay-warming-service.svelte.js').then(
        ({ warmAppRelays, startHealthCheck }) => {
          warmAppRelays();
          startHealthCheck();
        }
      );
    }
  });
</script>

<svelte:head>
  <link rel="icon" type="image/x-icon" href={runtimeConfig.favicon?.ico || '/favicon.ico'} />
  <link rel="icon" type="image/svg+xml" href={runtimeConfig.favicon?.svg || '/favicon.svg'} />
  <link
    rel="icon"
    type="image/png"
    sizes="32x32"
    href={runtimeConfig.favicon?.png32 || '/favicon-32x32.png'}
  />
  <link
    rel="icon"
    type="image/png"
    sizes="16x16"
    href={runtimeConfig.favicon?.png16 || '/favicon-16x16.png'}
  />
</svelte:head>

<Navbar />
<ModalManager />
{@render children?.()}
<Footer />
<PublishStatusToast />
