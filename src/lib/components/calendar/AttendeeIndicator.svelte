<script>
	/**
	 * AttendeeIndicator Component
	 * Displays RSVP attendee counts and avatars
	 * Supports compact mode (for cards) and expanded mode (for detail pages)
	 */
	import ProfileAvatar from '../shared/ProfileAvatar.svelte';

	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEventRSVP} CalendarEventRSVP
	 */

	let {
		accepted = [],
		tentative = [],
		declined = [],
		totalCount = 0,
		compact = false
	} = $props();

	// Determine how many avatars to show (max 5 in avatar group)
	const maxAvatars = 5;
	const showAcceptedAvatars = $derived(accepted.slice(0, maxAvatars));
	const remainingAccepted = $derived(Math.max(0, accepted.length - maxAvatars));
</script>

{#if totalCount > 0}
	{#if compact}
		<!-- Compact Mode: For event cards -->
		<div class="flex items-center gap-3 text-sm">
			<div class="flex items-center gap-1 text-base-content/70">
				<span class="text-lg">👥</span>
				<span class="font-medium">Attendees ({totalCount})</span>
			</div>

			<div class="flex items-center gap-2">
				<!-- Accepted count with avatar group -->
				{#if accepted.length > 0}
					<div class="flex items-center gap-1">
						<div class="avatar-group -space-x-3">
							{#each showAcceptedAvatars as attendee}
								<div class="avatar w-7 h-7">
									<div class="w-full rounded-full ring ring-success ring-offset-2 ring-offset-base-100">
										<ProfileAvatar
											pubkey={attendee.pubkey}
											profile={attendee.profile}
											size="xs"
										/>
									</div>
								</div>
							{/each}
							{#if remainingAccepted > 0}
								<div class="avatar placeholder w-7 h-7">
									<div
										class="w-full rounded-full bg-success text-success-content ring ring-success ring-offset-2 ring-offset-base-100"
									>
										<span class="text-xs">+{remainingAccepted}</span>
									</div>
								</div>
							{/if}
						</div>
						<span class="badge badge-success badge-sm">{accepted.length}</span>
					</div>
				{/if}

				<!-- Maybe count -->
				{#if tentative.length > 0}
					<span class="badge badge-warning badge-sm">{tentative.length}</span>
				{/if}

				<!-- Declined count -->
				{#if declined.length > 0}
					<span class="badge badge-error badge-sm">{declined.length}</span>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Expanded Mode: For detail pages -->
		<div class="space-y-4">
			<h3 class="text-lg font-semibold text-base-content">Attendees ({totalCount})</h3>

			<!-- Accepted Attendees -->
			{#if accepted.length > 0}
				<div class="space-y-2">
					<div class="flex items-center gap-2">
						<span class="text-success">✓</span>
						<h4 class="font-medium text-base-content">Accepted ({accepted.length})</h4>
					</div>
					<div class="avatar-group -space-x-4">
						{#each showAcceptedAvatars as attendee}
							<div class="avatar w-10 h-10" title={attendee.profile?.name || attendee.pubkey.slice(0, 8)}>
								<div class="w-full rounded-full ring ring-success ring-offset-2 ring-offset-base-100">
									<ProfileAvatar
										pubkey={attendee.pubkey}
										profile={attendee.profile}
										size="sm"
									/>
								</div>
							</div>
						{/each}
						{#if remainingAccepted > 0}
							<div class="avatar placeholder w-10 h-10">
								<div
									class="w-full rounded-full bg-success text-success-content ring ring-success ring-offset-2 ring-offset-base-100"
								>
									<span class="text-sm font-medium">+{remainingAccepted}</span>
								</div>
							</div>
						{/if}
					</div>
					{#if accepted.length > 0}
						<div class="text-sm text-base-content/70 ml-6">
							{#each accepted.slice(0, 3) as attendee, i}
								{#if i > 0}, {/if}
								{attendee.profile?.name || attendee.pubkey.slice(0, 8)}
							{/each}
							{#if accepted.length > 3}
								and {accepted.length - 3} more
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Tentative Attendees -->
			{#if tentative.length > 0}
				<div class="space-y-2">
					<div class="flex items-center gap-2">
						<span class="text-warning">?</span>
						<h4 class="font-medium text-base-content">Maybe ({tentative.length})</h4>
					</div>
					<div class="text-sm text-base-content/70 ml-6">
						{#each tentative.slice(0, 3) as attendee, i}
							{#if i > 0}, {/if}
							{attendee.profile?.name || attendee.pubkey.slice(0, 8)}
						{/each}
						{#if tentative.length > 3}
							and {tentative.length - 3} more
						{/if}
					</div>
				</div>
			{/if}

			<!-- Declined Attendees -->
			{#if declined.length > 0}
				<div class="space-y-2">
					<div class="flex items-center gap-2">
						<span class="text-error">✗</span>
						<h4 class="font-medium text-base-content">Declined ({declined.length})</h4>
					</div>
					<div class="text-sm text-base-content/70 ml-6">
						{#each declined.slice(0, 3) as attendee, i}
							{#if i > 0}, {/if}
							{attendee.profile?.name || attendee.pubkey.slice(0, 8)}
						{/each}
						{#if declined.length > 3}
							and {declined.length - 3} more
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/if}
