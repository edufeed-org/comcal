<script>
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { formatCalendarDate } from '$lib/helpers/calendar.js';
	import { ChatIcon, RepostIcon, LightningIcon, BookmarkIcon } from '$lib/components/icons';
	import ReactionBar from '$lib/components/reactions/ReactionBar.svelte';

	/** @type {any} */
	let { note, profileEvent = null } = $props();

	/**
	 * Format timestamp for display
	 * @param {number} timestamp
	 */
	function formatTimestamp(timestamp) {
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffMinutes = Math.floor(diffMs / (1000 * 60));

		if (diffMinutes < 1) return 'now';
		if (diffMinutes < 60) return `${diffMinutes}m`;
		if (diffHours < 24) return `${diffHours}h`;
		if (diffDays < 7) return `${diffDays}d`;
		
		return formatCalendarDate(date, 'short');
	}

	/**
	 * Get display name from profile
	 * @param {any} profile
	 */
	function getDisplayName(profile) {
		if (!profile) return 'Anonymous';
		return profile.name || profile.display_name || 'Anonymous';
	}

	/**
	 * Get username from profile
	 * @param {any} profile
	 */
	function getUsername(profile) {
		if (!profile) return 'anonymous';
		return profile.display_name || profile.name || 'anonymous';
	}

</script>

<div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
	<div class="flex items-start gap-3">
		<!-- Profile Picture -->
		<div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
			<img
				src={getProfilePicture(profileEvent) || `https://robohash.org/${note.pubkey}`}
				alt="Profile"
				class="w-full h-full object-cover"
			/>
		</div>
		
		<!-- Note Content -->
		<div class="flex-1">
			<!-- Header -->
			<div class="flex items-center gap-2 mb-2">
				<span class="font-medium text-white">{getDisplayName(profileEvent)}</span>
				<span class="text-gray-400 text-sm">@{getUsername(profileEvent)}</span>
				<span class="text-gray-500 text-sm">• {formatTimestamp(note.created_at)}</span>
			</div>
			
			<!-- Note Text -->
			<p class="text-gray-200 mb-3 whitespace-pre-wrap break-words">{note.content}</p>
			
			<!-- Reactions -->
			<div class="mb-3">
				<ReactionBar event={note} />
			</div>
			
			<!-- Actions -->
			<div class="flex items-center gap-6 text-gray-400 text-sm">
				<!-- Reply -->
				<button class="flex items-center gap-1 hover:text-blue-400 transition-colors">
					<ChatIcon class_="w-4 h-4" />
				</button>
				
				<!-- Repost -->
				<button class="flex items-center gap-1 hover:text-green-400 transition-colors">
					<RepostIcon class_="w-4 h-4" />
				</button>
				
				<!-- Like/Zap -->
				<button class="flex items-center gap-1 hover:text-yellow-400 transition-colors">
					<LightningIcon class_="w-4 h-4" />
				</button>
				
				<!-- Bookmark -->
				<button class="flex items-center gap-1 hover:text-gray-200 transition-colors">
					<BookmarkIcon class_="w-4 h-4" />
				</button>
			</div>
		</div>
	</div>
</div>
