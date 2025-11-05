<script>
	/**
	 * AttendeeIndicator Component
	 * Displays RSVP attendee counts and avatars
	 * Supports compact mode (for cards) and expanded mode (for detail pages)
	 */
	import ProfileAvatar from '../shared/ProfileAvatar.svelte';
	import ProfileCard from '../shared/ProfileCard.svelte';
	import { getDisplayName } from 'applesauce-core/helpers';

	/**
	 * @typedef {import('$lib/types/calendar.js').CalendarEventRSVP} CalendarEventRSVP
	 */

	let {
		accepted = [],
		tentative = [],
		declined = [],
		totalCount = 0,
		compact = false,
		showViewAll = false
	} = $props();

	// State for view all modal
	let isViewAllOpen = $state(false);

	// Determine how many avatars to show (max 5 in avatar group)
	const maxAvatars = 5;
	const showAcceptedAvatars = $derived(accepted.slice(0, maxAvatars));
	const remainingAccepted = $derived(Math.max(0, accepted.length - maxAvatars));

	/**
	 * Get display name for an attendee
	 * @param {any} attendee
	 * @returns {string}
	 */
	function getAttendeeName(attendee) {
		return getDisplayName(attendee.profile) || `${attendee.pubkey.slice(0, 8)}...`;
	}
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
								<div class="tooltip" data-tip={getAttendeeName(attendee)}>
									<a 
										href="/p/{attendee.pubkey}" 
										class="avatar w-7 h-7 hover:scale-110 transition-transform cursor-pointer"
									>
										<div class="w-full rounded-full ring ring-success ring-offset-2 ring-offset-base-100">
											<ProfileAvatar
												pubkey={attendee.pubkey}
												profile={attendee.profile}
												size="xs"
											/>
										</div>
									</a>
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
				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<span class="text-success text-xl">✓</span>
						<h4 class="font-medium text-base-content">Accepted ({accepted.length})</h4>
					</div>
					<div class="space-y-2 ml-6">
						{#each accepted.slice(0, 5) as attendee}
							{#key attendee.pubkey}
								<ProfileCard 
									pubkey={attendee.pubkey}
									profile={attendee.profile}
									size="sm"
									showNpub={false}
									class="hover:bg-base-300"
								/>
							{/key}
						{/each}
						{#if accepted.length > 5}
							<button 
								onclick={() => isViewAllOpen = true}
								class="btn btn-sm btn-ghost w-full text-base-content/60 hover:text-base-content"
							>
								Show all {accepted.length} attendees
							</button>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Tentative Attendees -->
			{#if tentative.length > 0}
				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<span class="text-warning text-xl">?</span>
						<h4 class="font-medium text-base-content">Maybe ({tentative.length})</h4>
					</div>
					<div class="space-y-2 ml-6">
						{#each tentative.slice(0, 5) as attendee}
							{#key attendee.pubkey}
								<ProfileCard 
									pubkey={attendee.pubkey}
									profile={attendee.profile}
									size="sm"
									showNpub={false}
									class="hover:bg-base-300"
								/>
							{/key}
						{/each}
						{#if tentative.length > 5}
							<button 
								onclick={() => isViewAllOpen = true}
								class="btn btn-sm btn-ghost w-full text-base-content/60 hover:text-base-content"
							>
								Show all {tentative.length} attendees
							</button>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Declined Attendees -->
			{#if declined.length > 0}
				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<span class="text-error text-xl">✗</span>
						<h4 class="font-medium text-base-content">Declined ({declined.length})</h4>
					</div>
					<div class="space-y-2 ml-6">
						{#each declined.slice(0, 3) as attendee}
							{#key attendee.pubkey}
								<ProfileCard 
									pubkey={attendee.pubkey}
									profile={attendee.profile}
									size="sm"
									showNpub={false}
									class="hover:bg-base-300"
								/>
							{/key}
						{/each}
						{#if declined.length > 3}
							<button 
								onclick={() => isViewAllOpen = true}
								class="btn btn-sm btn-ghost w-full text-base-content/60 hover:text-base-content"
							>
								Show all {declined.length} attendees
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/if}

<!-- View All Attendees Modal -->
{#if isViewAllOpen}
	<div class="modal modal-open">
		<div class="modal-box max-w-2xl">
			<h3 class="text-lg font-bold mb-4">All Attendees ({totalCount})</h3>
			
			<!-- Tabbed view for different RSVP statuses -->
			<div role="tablist" class="tabs tabs-boxed mb-4">
				<button role="tab" class="tab tab-active">Accepted ({accepted.length})</button>
				{#if tentative.length > 0}
					<button role="tab" class="tab">Maybe ({tentative.length})</button>
				{/if}
				{#if declined.length > 0}
					<button role="tab" class="tab">Declined ({declined.length})</button>
				{/if}
			</div>

			<!-- Scrollable attendee list -->
			<div class="max-h-96 overflow-y-auto space-y-2">
				{#if accepted.length > 0}
					<div class="space-y-2">
						<h4 class="font-semibold text-success flex items-center gap-2 sticky top-0 bg-base-100 py-2 z-10">
							<span class="text-xl">✓</span>
							Accepted ({accepted.length})
						</h4>
						{#each accepted as attendee}
							{#key attendee.pubkey}
								<ProfileCard 
									pubkey={attendee.pubkey}
									profile={attendee.profile}
									size="sm"
									showNpub={false}
									class="hover:bg-base-300"
								/>
							{/key}
						{/each}
					</div>
				{/if}

				{#if tentative.length > 0}
					<div class="space-y-2 mt-4">
						<h4 class="font-semibold text-warning flex items-center gap-2 sticky top-0 bg-base-100 py-2 z-10">
							<span class="text-xl">?</span>
							Maybe ({tentative.length})
						</h4>
						{#each tentative as attendee}
							{#key attendee.pubkey}
								<ProfileCard 
									pubkey={attendee.pubkey}
									profile={attendee.profile}
									size="sm"
									showNpub={false}
									class="hover:bg-base-300"
								/>
							{/key}
						{/each}
					</div>
				{/if}

				{#if declined.length > 0}
					<div class="space-y-2 mt-4">
						<h4 class="font-semibold text-error flex items-center gap-2 sticky top-0 bg-base-100 py-2 z-10">
							<span class="text-xl">✗</span>
							Declined ({declined.length})
						</h4>
						{#each declined as attendee}
							{#key attendee.pubkey}
								<ProfileCard 
									pubkey={attendee.pubkey}
									profile={attendee.profile}
									size="sm"
									showNpub={false}
									class="hover:bg-base-300"
								/>
							{/key}
						{/each}
					</div>
				{/if}
			</div>

			<div class="modal-action">
				<button class="btn" onclick={() => isViewAllOpen = false}>Close</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => isViewAllOpen = false}></div>
	</div>
{/if}
