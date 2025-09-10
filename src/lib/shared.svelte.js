import { getTagValue } from "applesauce-core/helpers";
import { loadUserProfile } from "./store.svelte";
import { eventStore } from "./store.svelte";

export let signer = $state({
  signer: null
});

export let userProfile = $state({
  profile: null
});

export let joinedCommunities = $state([])

export function communityProfile(pubkey) {
  let profile = null;
  loadUserProfile(0, pubkey).subscribe((event) => {
			if (event) {
				// console.log('Profile loaded:', event);
				profile = event;
        // console.log("got profile for ", getProfileContent(event).name);
			}
		});
    return profile;
}

// FIXME
export function userJoinedCommunity(pubkey, relationship) {
  let joined = false;
  let relationships = eventStore.getReplaceable(30382, pubkey, communityPubkey);

  

  console.log("relationships", relationships);
  relationships.find((c) => {
    const community = getTagValue(c, "d");
    const relationship = getTagValue(c, "n");
    console.log("community", community);
    console.log("relationship", relationship);
    if (
      pubkey === community &&
      relationship === "follow"
    ) {
      joined = true;
    }
  });
  console.log("userJoinedCommunity", pubkey, joined);
  return joined;
}

export function userJoined(pubkey, communities) {
  const joined = $derived.by(() => {
		return userJoinedCommunity(pubkey, communities);
	})
  return joined;
}
