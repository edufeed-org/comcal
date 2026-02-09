<script>
  import { runtimeConfig } from '$lib/stores/config.svelte.js';

  let imprint = $derived(runtimeConfig.imprint);
</script>

<svelte:head>
  <title>Imprint - {runtimeConfig.appName}</title>
</svelte:head>

<div class="min-h-screen bg-base-100 px-4 py-8">
  <div class="mx-auto max-w-3xl">
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h1 class="mb-6 card-title text-3xl">Imprint</h1>

        {#if imprint.enabled}
          <!-- Organization -->
          <div class="mb-6">
            <p class="text-lg font-medium">{imprint.organization}</p>
          </div>

          {#if imprint.address.street || imprint.address.postalCode || imprint.address.city || imprint.address.country}
            <!-- Address -->
            <div class="mb-6">
              <h3 class="mb-2 font-semibold">Address</h3>
              <p>{imprint.address.street}</p>
              <p>{imprint.address.postalCode} {imprint.address.city}</p>
              <p>{imprint.address.country}</p>
            </div>
          {/if}

          <!-- Contact -->
          <div class="mb-6">
            <h3 class="mb-2 font-semibold">Contact</h3>
            <p>
              Email:
              <a href="mailto:{imprint.contact.email}" class="link link-primary">
                {imprint.contact.email}
              </a>
            </p>
            {#if imprint.contact.phone}
              <p>Phone: {imprint.contact.phone}</p>
            {/if}
          </div>

          <!-- Representative -->
          {#if imprint.representative}
            <div class="mb-6">
              <h3 class="mb-2 font-semibold">Represented by</h3>
              <p>{imprint.representative}</p>
            </div>
          {/if}
          <!-- Funding Information -->
          <div class="mb-6">
            <h3 class="mb-2 font-semibold">Funding</h3>
            <div class="flex flex-col gap-2">
              <img src={imprint.funding.image} alt="Funding Logo" class="h-auto w-auto" />
              <p class="text-sm">{imprint.funding.text}</p>
            </div>
          </div>

          <!-- Optional fields -->
          {#if imprint.registrationNumber}
            <div class="mb-6">
              <h3 class="mb-2 font-semibold">Registration Number</h3>
              <p>{imprint.registrationNumber}</p>
            </div>
          {/if}

          {#if imprint.vatId}
            <div class="mb-6">
              <h3 class="mb-2 font-semibold">VAT ID</h3>
              <p>{imprint.vatId}</p>
            </div>
          {/if}

          {#if imprint.responsibleForContent}
            <div class="mb-6">
              <h3 class="mb-2 font-semibold">Responsible for Content</h3>
              <p>{imprint.responsibleForContent}</p>
            </div>
          {/if}

          <!-- Disclaimer -->
          <div class="mt-8 border-t border-base-300 pt-6">
            <h3 class="mb-2 font-semibold">Disclaimer</h3>
            <p class="text-sm opacity-70">
              Despite careful content control, we assume no liability for the content. The authors
              of the nostr events are solely responsible for their content.
            </p>
          </div>
        {:else}
          <p class="text-lg">Imprint information is not available at this time.</p>
        {/if}
      </div>
    </div>
  </div>
</div>
