/**
 * Unified loader exports for convenience.
 * Import from here or from specific files based on your needs.
 * 
 * Usage examples:
 * import { calendarTimelineLoader, useCalendarEventLoader } from '$lib/loaders';
 * import { calendarTimelineLoader } from '$lib/loaders/calendar';
 */

// Base loaders (EventStore bootstrap)
export { addressLoader, eventLoader, userDeletionLoader } from './base.js';

// Calendar loaders
export {
	calendarTimelineLoader,
	calendarLoader,
	userCalendarLoader,
	createRelayFilteredCalendarLoader,
	communityCalendarTimelineLoader,
	targetedPublicationTimelineLoader
} from './calendar.js';

// Community loaders
export {
	communikeyTimelineLoader,
	relationshipTimelineLoader
} from './community.js';

// Profile utilities
export {
	profileLoader,
	loadUserProfile,
	kind1Loader
} from './profile.js';

// Calendar event loader composable
export { useCalendarEventLoader, useCalendarUrlSync } from './calendar-event-loader.svelte';
