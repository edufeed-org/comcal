<script>
  import { CalendarIcon, PeopleIcon } from '$lib/components/icons';
  import * as m from '$lib/paraglide/messages';
</script>

<section class="bg-base-200 py-16">
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
      <!-- Communities Feature -->
      <div class="card bg-base-100 shadow-lg transition-all duration-300 hover:shadow-xl">
        <div class="card-body items-center text-center">
          <div class="mb-4 rounded-full bg-primary/10 p-4">
            <PeopleIcon class_="h-12 w-12 text-primary" />
          </div>
          <h3 class="card-title text-2xl font-bold text-base-content">
            {m.landing_features_communities()}
          </h3>
          <p class="text-base-content/70">
            {m.landing_features_communities_description()}
          </p>
        </div>
      </div>

      <!-- Calendar Feature -->
      <div class="card bg-base-100 shadow-lg transition-all duration-300 hover:shadow-xl">
        <div class="card-body items-center text-center">
          <div class="mb-4 rounded-full bg-secondary/10 p-4">
            <CalendarIcon class_="h-12 w-12 text-secondary" />
          </div>
          <h3 class="card-title text-2xl font-bold text-base-content">
            {m.landing_features_calendar()}
          </h3>
          <p class="text-base-content/70">
            {m.landing_features_calendar_description()}
          </p>
        </div>
      </div>

      <!-- Decentralized Feature -->
      <div class="card bg-base-100 shadow-lg transition-all duration-300 hover:shadow-xl">
        <div class="card-body items-center text-center">
          <div class="mb-4 rounded-full bg-accent/10 p-4">
            <img
              src="/running_nostr.gif"
              alt="Nostr protocol decentralized network visualization"
              class="h-12 w-12"
            />
          </div>
          <h3 class="card-title text-2xl font-bold text-base-content">
            {m.landing_features_decentralized()}
          </h3>
          <p class="text-base-content/70">
            {m.landing_features_decentralized_description()}
          </p>
        </div>
      </div>
    </div>
  </div>
</section>
