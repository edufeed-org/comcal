<script>
	import { runtimeConfig } from '$lib/stores/config.svelte.js';

	let imprint = $derived(runtimeConfig.imprint);
</script>

<svelte:head>
	<title>Imprint - {runtimeConfig.appName}</title>
</svelte:head>

<div class="min-h-screen bg-base-100 py-8 px-4">
	<div class="max-w-3xl mx-auto">
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<h1 class="card-title text-3xl mb-6">Imprint</h1>

				{#if imprint.enabled}
					<!-- Organization -->
					<div class="mb-6">
						<p class="text-lg font-medium">{imprint.organization}</p>
					</div>

					{#if imprint.address.street || imprint.address.postalCode || imprint.address.city || imprint.address.country}
					<!-- Address -->
					<div class="mb-6">
						<h3 class="font-semibold mb-2">Address</h3>
						<p>{imprint.address.street}</p>
						<p>{imprint.address.postalCode} {imprint.address.city}</p>
						<p>{imprint.address.country}</p>
					</div>
					{/if}

					<!-- Contact -->
					<div class="mb-6">
						<h3 class="font-semibold mb-2">Contact</h3>
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
						<h3 class="font-semibold mb-2">Represented by</h3>
						<p>{imprint.representative}</p>
					</div>
					{/if}
					<!-- Funding Information -->
					<div class="mb-6">
						<h3 class="font-semibold mb-2">Funding</h3>
						<div class="flex flex-col gap-2">
							<img src="/BMBFSFJ.png" alt="BMBFSFJ Logo" class="h-auto w-auto" />
							<p class="text-sm">Förderkennzeichen: 01PZ24007</p>
						</div>
					</div>

					<!-- Optional fields -->
					{#if imprint.registrationNumber}
						<div class="mb-6">
							<h3 class="font-semibold mb-2">Registration Number</h3>
							<p>{imprint.registrationNumber}</p>
						</div>
					{/if}

					{#if imprint.vatId}
						<div class="mb-6">
							<h3 class="font-semibold mb-2">VAT ID</h3>
							<p>{imprint.vatId}</p>
						</div>
					{/if}

					{#if imprint.responsibleForContent}
						<div class="mb-6">
							<h3 class="font-semibold mb-2">Responsible for Content</h3>
							<p>{imprint.responsibleForContent}</p>
						</div>
					{/if}

					<!-- Disclaimer -->
					<div class="mt-8 pt-6 border-t border-base-300">
						<h3 class="font-semibold mb-2">Disclaimer</h3>
						<p class="text-sm opacity-70">
							Despite careful content control, we assume no liability for the content.
							The authors of the nostr events are solely responsible for their content.
						</p>
					</div>
				{:else}
					<p class="text-lg">Imprint information is not available at this time.</p>
				{/if}
			</div>
		</div>
	</div>
</div>
