/**
 * Kanban board loading for community views (kind 30301).
 */
import { getKanbanRelays } from '$lib/helpers/relay-helper.js';
import { createCommunityContentLoader } from './community-content-loader.js';

/** Hook: Load kanban boards for a specific community */
export const useKanbanCommunityLoader = createCommunityContentLoader([30301], getKanbanRelays);
