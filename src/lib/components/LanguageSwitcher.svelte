<!--
  Language Switcher Component
  Allows users to switch between available languages
-->

<script>
  import { getLocale, setLocale, locales } from '$lib/paraglide/runtime';

  // Language display names
  const languageNames = {
    en: { native: 'English', english: 'English' },
    de: { native: 'Deutsch', english: 'German' }
  };

  // Track current locale reactively
  let currentLocale = $derived(getLocale());

  /**
   * Handle language selection
   * @param {string} locale
   */
  function handleLanguageChange(locale) {
    if (locale !== currentLocale) {
      setLocale(locale);
    }
  }
</script>

<div class="dropdown dropdown-end">
  <div tabindex="0" role="button" class="btn gap-2 btn-ghost btn-sm">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="h-5 w-5"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
      />
    </svg>
    <span class="uppercase">{currentLocale}</span>
  </div>
  <ul class="dropdown-content menu z-[1] mt-3 w-52 rounded-box bg-base-100 p-2 shadow">
    {#each locales as locale (locale)}
      <li>
        <button
          class:active={currentLocale === locale}
          onclick={() => handleLanguageChange(locale)}
        >
          <span class="font-semibold">{languageNames[locale]?.native || locale}</span>
          <span class="text-sm opacity-70">({languageNames[locale]?.english || locale})</span>
        </button>
      </li>
    {/each}
  </ul>
</div>
