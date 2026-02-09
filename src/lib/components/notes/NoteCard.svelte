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

<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
  <div class="flex items-start gap-3">
    <!-- Profile Picture -->
    <div class="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
      <img
        src={getProfilePicture(profileEvent) || `https://robohash.org/${note.pubkey}`}
        alt="Profile"
        class="h-full w-full object-cover"
      />
    </div>

    <!-- Note Content -->
    <div class="flex-1">
      <!-- Header -->
      <div class="mb-2 flex items-center gap-2">
        <span class="font-medium text-white">{getDisplayName(profileEvent)}</span>
        <span class="text-sm text-gray-400">@{getUsername(profileEvent)}</span>
        <span class="text-sm text-gray-500">• {formatTimestamp(note.created_at)}</span>
      </div>

      <!-- Note Text -->
      <p class="mb-3 break-words whitespace-pre-wrap text-gray-200">{note.content}</p>

      <!-- Reactions -->
      <div class="mb-3">
        <ReactionBar event={note} />
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-6 text-sm text-gray-400">
        <!-- Reply -->
        <button class="flex items-center gap-1 transition-colors hover:text-blue-400">
          <ChatIcon class_="w-4 h-4" />
        </button>

        <!-- Repost -->
        <button class="flex items-center gap-1 transition-colors hover:text-green-400">
          <RepostIcon class_="w-4 h-4" />
        </button>

        <!-- Like/Zap -->
        <button class="flex items-center gap-1 transition-colors hover:text-yellow-400">
          <LightningIcon class_="w-4 h-4" />
        </button>

        <!-- Bookmark -->
        <button class="flex items-center gap-1 transition-colors hover:text-gray-200">
          <BookmarkIcon class_="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</div>
