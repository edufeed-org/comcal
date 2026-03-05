<script>
  import { resolve } from '$app/paths';
  import * as m from '$lib/paraglide/messages';
  import { modalStore } from '$lib/stores/modal.svelte.js';

  // Note: These functions are kept for future CTA buttons
  function _handleGetStarted() {
    modalStore.openModal('signup');
  }

  function _scrollToCommunities() {
    const carousel = document.querySelector('#community-showcase');
    if (carousel) {
      carousel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
</script>

<section
  class="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary py-20 text-primary-content"
>
  <!-- Decorative elements -->
  <div class="absolute inset-0 opacity-10">
    <div class="absolute top-10 -left-4 h-72 w-72 rounded-full bg-white blur-3xl"></div>
    <div class="absolute -right-4 bottom-10 h-96 w-96 rounded-full bg-white blur-3xl"></div>
  </div>

  <div class="relative z-10 container mx-auto px-4">
    <!-- Main headline -->
    <div class="mx-auto max-w-4xl text-center">
      <h1 class="mb-6 text-4xl leading-tight font-bold md:text-5xl lg:text-6xl">
        {m.landing_hero_title()}
      </h1>
      <p class="mb-4 text-lg opacity-90 md:text-xl lg:text-2xl">
        {m.landing_hero_subtitle()}
      </p>

      <!-- Onboarding link -->
      <a
        href="https://onboarding.edufeed.org"
        target="_blank"
        rel="noopener noreferrer"
        class="group mb-8 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-5 py-2.5 text-sm font-medium backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/25 md:text-base"
      >
        <span class="text-lg">🚀</span>
        {m.landing_hero_onboarding()}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </a>

      <!-- Feature badges -->
      <div class="mb-10 flex flex-wrap justify-center gap-4">
        <a
          href={resolve('/discover?type=communities')}
          class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm transition-opacity hover:opacity-80"
        >
          <span class="text-2xl">🏘️</span>
          <span class="font-medium">{m.landing_features_communities()}</span>
        </a>
        <a
          href={resolve('/calendar')}
          class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm transition-opacity hover:opacity-80"
        >
          <span class="text-2xl">📅</span>
          <span class="font-medium">{m.landing_features_calendar()}</span>
        </a>
        <a
          href={resolve('/discover?type=boards')}
          class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm transition-opacity hover:opacity-80"
        >
          <span class="text-2xl">📋</span>
          <span class="font-medium">{m.landing_features_kanban()}</span>
        </a>
      </div>

      <!-- Call to action buttons -->
      <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a
          href={resolve('/calendar')}
          class="btn border-none bg-white text-primary shadow-lg btn-lg hover:bg-white/90"
        >
          📅 {m.landing_hero_browse_calendar()}
        </a>
        <a
          href={resolve('/discover')}
          class="btn border-2 border-white text-white btn-outline btn-lg hover:bg-white hover:text-primary"
        >
          🔭 {m.landing_hero_discover()}
        </a>
      </div>
    </div>
  </div>
</section>
