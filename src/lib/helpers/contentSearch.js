import { getTagValue } from 'applesauce-core/helpers';

/**
 * Check if a discover-page item matches a text search query.
 *
 * @param {{type: string, data: any}} item - Content item with type and data
 * @param {string} query - Lowercased search query
 * @param {Map<string, any>} profiles - Map of pubkey → profile metadata
 * @returns {boolean}
 */
export function matchesTextSearch(item, query, profiles) {
  const lowerQuery = query.toLowerCase();
  const pubkey = item.data.pubkey;
  const profile = profiles.get(pubkey);
  const name = profile?.name?.toLowerCase() || '';
  const displayName = profile?.display_name?.toLowerCase() || '';

  if (item.type === 'article') {
    const title = getTagValue(item.data, 'title')?.toLowerCase() || '';
    const summary = getTagValue(item.data, 'summary')?.toLowerCase() || '';
    return (
      title.includes(lowerQuery) ||
      summary.includes(lowerQuery) ||
      name.includes(lowerQuery) ||
      displayName.includes(lowerQuery)
    );
  } else if (item.type === 'amb') {
    const resourceName = item.data.name?.toLowerCase() || '';
    const description = item.data.description?.toLowerCase() || '';
    const keywords = item.data.keywords?.join(' ').toLowerCase() || '';
    const subjects =
      item.data.subjects
        ?.map((/** @type {{label: string}} */ s) => s.label)
        .join(' ')
        .toLowerCase() || '';
    const creatorNames = item.data.creatorNames?.join(' ').toLowerCase() || '';
    return (
      resourceName.includes(lowerQuery) ||
      description.includes(lowerQuery) ||
      keywords.includes(lowerQuery) ||
      subjects.includes(lowerQuery) ||
      creatorNames.includes(lowerQuery) ||
      name.includes(lowerQuery) ||
      displayName.includes(lowerQuery)
    );
  } else if (item.type === 'event') {
    const title = item.data.title?.toLowerCase() || '';
    const summary = item.data.summary?.toLowerCase() || '';
    const locations = item.data.locations?.join(' ').toLowerCase() || '';
    return (
      title.includes(lowerQuery) ||
      summary.includes(lowerQuery) ||
      locations.includes(lowerQuery) ||
      name.includes(lowerQuery) ||
      displayName.includes(lowerQuery)
    );
  } else if (item.type === 'board') {
    const title = getTagValue(item.data, 'title')?.toLowerCase() || '';
    const description = getTagValue(item.data, 'description')?.toLowerCase() || '';
    return (
      title.includes(lowerQuery) ||
      description.includes(lowerQuery) ||
      name.includes(lowerQuery) ||
      displayName.includes(lowerQuery)
    );
  }
  return false;
}
