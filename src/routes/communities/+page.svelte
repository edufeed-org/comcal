<script>
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { useJoinedCommunitiesList } from '$lib/stores/joined-communities-list.svelte.js';
  import { getTagValue } from 'applesauce-core/helpers';
  import { hexToNpub } from '$lib/helpers/nostrUtils.js';

  const getJoinedCommunities = useJoinedCommunitiesList();

  $effect(() => {
    const communities = getJoinedCommunities();
    if (communities.length > 0) {
      const firstCommunity = communities.sort()[0];
      const pubkey = getTagValue(firstCommunity, 'd');
      if (pubkey) {
        const npub = hexToNpub(pubkey);
        if (npub) {
          goto(resolve(`/c/${npub}`), { replaceState: true });
          return;
        }
      }
    }
    // No communities or not logged in - go to discover communities tab
    goto(resolve('/discover?type=communities'), { replaceState: true });
  });
</script>
