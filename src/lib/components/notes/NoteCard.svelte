<script>
	import { getProfilePicture } from 'applesauce-core/helpers';

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
		
		return date.toLocaleDateString();
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
			
			<!-- Actions -->
			<div class="flex items-center gap-6 text-gray-400 text-sm">
				<!-- Reply -->
				<button class="flex items-center gap-1 hover:text-blue-400 transition-colors">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
					</svg>
				</button>
				
				<!-- Repost -->
				<button class="flex items-center gap-1 hover:text-green-400 transition-colors">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
				</button>
				
				<!-- Like/Zap -->
				<button class="flex items-center gap-1 hover:text-yellow-400 transition-colors">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
				</button>
				
				<!-- Bookmark -->
				<button class="flex items-center gap-1 hover:text-gray-200 transition-colors">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
					</svg>
				</button>
			</div>
		</div>
	</div>
</div>
