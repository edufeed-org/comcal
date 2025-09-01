<script>
	export let pubkey;
	import { profileLoader } from '$lib/store';
	import { get, writable } from 'svelte/store';
	import { getProfileContent } from 'applesauce-core/helpers';

	let profile = writable(null);

	profileLoader({
		kind: 0,
		pubkey
	}).subscribe({
		next: (event) => {
			console.log('found profile', event);
			profile.set(event);
		},
		complete: () => {
			console.log('complete');
		}
	});
</script>

<div class="card w-96 bg-base-100 shadow-sm">
	<figure class="px-10 pt-10">
		{#if $profile}
			<img
				src={getProfileContent($profile).picture || pubkey}
				alt="Shoes"
				class="rounded-xl"
			/>
		{/if}
	</figure>
	<div class="card-body items-center text-center">
		<h2 class="card-title">
			{#if $profile}
				{getProfileContent($profile).name || getProfileContent($profile).display_name || pubkey}
			{/if}
		</h2>
		<p>
			{#if $profile}
        {getProfileContent($profile).about || 'No bio available'}
      {/if}
		</p>
		<div class="card-actions">
			<button class="btn btn-primary">Visit</button>
		</div>
	</div>
</div>
