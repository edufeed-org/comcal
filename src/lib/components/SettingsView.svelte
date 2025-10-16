<script>
	import { getDisplayName, getProfilePicture } from 'applesauce-core/helpers';
	import { SettingsIcon } from '$lib/components/icons';

	let { communityId, communikeyEvent, profileEvent } = $props();
</script>

<div class="min-h-screen bg-base-100 p-6">
	<div class="container mx-auto max-w-4xl">
		<div class="flex items-center gap-3 mb-6">
			<SettingsIcon class_="w-6 h-6 text-primary" />
			<h1 class="text-2xl font-bold">Community Settings</h1>
		</div>

		{#if profileEvent && communikeyEvent}
			<!-- Community Information -->
			<div class="card bg-base-200 shadow-xl mb-6">
				<div class="card-body">
					<h2 class="card-title mb-4">Community Information</h2>
					
					<div class="space-y-4">
						<div class="flex items-center gap-4">
							<div class="avatar">
								<div class="w-16 h-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
									<img
										src={getProfilePicture(profileEvent) || `https://robohash.org/${communityId}`}
										alt={getDisplayName(profileEvent)}
									/>
								</div>
							</div>
							<div>
								<h3 class="font-semibold text-lg">{getDisplayName(profileEvent)}</h3>
								<p class="text-sm text-base-content/60">Community ID: {communityId.slice(0, 16)}...</p>
							</div>
						</div>

						{#if communikeyEvent?.content}
							<div>
								<h4 class="font-medium mb-2">Description</h4>
								<p class="text-base-content/80">{communikeyEvent.content}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Community Actions -->
			<div class="card bg-base-200 shadow-xl">
				<div class="card-body">
					<h2 class="card-title mb-4">Actions</h2>
					
					<div class="space-y-3">
						<button class="btn btn-outline btn-error w-full">
							Leave Community
						</button>
						<p class="text-xs text-base-content/60 text-center">
							You can rejoin this community later if you change your mind.
						</p>
					</div>
				</div>
			</div>

			<!-- Admin Settings (Future) -->
			<!-- This section would show admin controls if user is community admin -->
		{:else}
			<div class="flex items-center justify-center py-12">
				<div class="loading loading-spinner loading-lg text-primary"></div>
			</div>
		{/if}
	</div>
</div>
