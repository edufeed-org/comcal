import { getProfileContent, getTagValue } from "applesauce-core/helpers";
import { loadUserProfile } from "./store";

export let signer = $state({
  signer: null
});

export let userProfile = $state({
  profile: null
});

export let communities = $state([]);

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

export function userJoinedCommunity(pubkey, communities) {
  let joined = false;
  joinedCommunities.find((c) => {
    const community = getTagValue(c, "d");
    const relationship = getTagValue(c, "n");
    // console.log("community", community);
    // console.log("relationship", relationship);
    if (
      pubkey === community &&
      relationship === "follow"
    ) {
      joined = true;
    }
  });
  return joined;
}

export function userJoined(pubkey, communities) {
  const joined = $derived.by(() => {
		return userJoinedCommunity(pubkey, communities);
	})
  return joined;
}
