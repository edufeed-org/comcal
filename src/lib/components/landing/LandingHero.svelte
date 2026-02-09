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
      <p class="mb-8 text-lg opacity-90 md:text-xl lg:text-2xl">
        {m.landing_hero_subtitle()}
      </p>

      <!-- Feature badges -->
      <div class="mb-10 flex flex-wrap justify-center gap-4">
        <div class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
          <span class="text-2xl">🏘️</span>
          <span class="font-medium">{m.landing_features_communities()}</span>
        </div>
        <div class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
          <span class="text-2xl">💬</span>
          <span class="font-medium">{m.landing_features_chat()}</span>
        </div>
        <a
          href={resolve('/calendar')}
          class="flex cursor-pointer items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm transition-opacity hover:opacity-80"
        >
          <span class="text-2xl">📅</span>
          <span class="font-medium">{m.landing_features_calendar()}</span>
        </a>
        <div class="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
          <span class="text-2xl">✨</span>
          <span class="font-medium">{m.landing_features_more_to_come()}</span>
        </div>
      </div>

      <!-- Call to action buttons -->
      <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a
          href={resolve('/calendar')}
          class="btn border-none bg-white text-primary shadow-lg btn-lg hover:bg-white/90"
        >
          {m.landing_hero_browse_calendar()}
        </a>
        <a
          href={resolve('/discover')}
          class="btn border-2 border-white text-white btn-outline btn-lg hover:bg-white hover:text-primary"
        >
          {m.landing_hero_explore_communities()}
        </a>
      </div>
    </div>
  </div>
</section>
