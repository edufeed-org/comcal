<script>
  import { appSettings } from '$lib/stores/app-settings.svelte.js';
  import * as m from '$lib/paraglide/messages';

  /** @type {Array<{value: 'default' | 'stil' | 'rpi', label: string, icon: string}>} */
  const themeFamilies = [
    { value: 'default', label: 'Default', icon: '🎨' },
    { value: 'stil', label: 'STIL', icon: '🧡' },
    { value: 'rpi', label: 'RPI', icon: '🔵' }
  ];

  /** @type {Array<{value: 'light' | 'dark' | 'system', label: string, icon: string}>} */
  const colorModes = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'system', label: 'System', icon: '💻' },
    { value: 'dark', label: 'Dark', icon: '🌙' }
  ];
</script>

<div class="form-control">
  <div class="label">
    <span class="label-text">{m.theme_switcher_family()}</span>
  </div>
  <div class="flex gap-2" role="group" aria-label={m.theme_switcher_family()}>
    {#each themeFamilies as family (family.value)}
      <button
        class="btn flex-1 btn-sm"
        class:btn-primary={appSettings.themeFamily === family.value}
        class:btn-ghost={appSettings.themeFamily !== family.value}
        onclick={() => (appSettings.themeFamily = family.value)}
      >
        <span class="text-lg">{family.icon}</span>
        <span class="hidden sm:inline">{family.label}</span>
      </button>
    {/each}
  </div>
</div>

<div class="form-control mt-2">
  <div class="label">
    <span class="label-text">{m.theme_switcher_color_mode()}</span>
  </div>
  <div class="flex gap-2" role="group" aria-label={m.theme_switcher_color_mode()}>
    {#each colorModes as mode (mode.value)}
      <button
        class="btn flex-1 btn-sm"
        class:btn-primary={appSettings.colorMode === mode.value}
        class:btn-ghost={appSettings.colorMode !== mode.value}
        onclick={() => (appSettings.colorMode = mode.value)}
      >
        <span class="text-lg">{mode.icon}</span>
        <span class="hidden sm:inline">{mode.label}</span>
      </button>
    {/each}
  </div>
  <div class="label">
    <span class="label-text-alt text-base-content/60">
      Current: {appSettings.effectiveTheme === 'light'
        ? '☀️ Light'
        : appSettings.effectiveTheme === 'dark'
          ? '🌙 Dark'
          : appSettings.effectiveTheme === 'stil'
            ? '🧡 STIL'
            : appSettings.effectiveTheme === 'stil-dark'
              ? '🖤 STIL Dark'
              : appSettings.effectiveTheme === 'rpi'
                ? '🔵 RPI'
                : appSettings.effectiveTheme === 'rpi-dark'
                  ? '🔷 RPI Dark'
                  : 'Unknown'}
    </span>
  </div>
</div>
