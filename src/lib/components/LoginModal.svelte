<script>
	let {modalId} = $props()

	import { ExtensionSigner } from 'applesauce-signers';
	import { signer, userProfile, joinedCommunities } from '$lib/shared.svelte.js';
	import { loadRelationships, loadUserProfile, eventStore } from '$lib/store.svelte.js';

	import { manager } from '$lib/accounts.svelte';
	import { ExtensionAccount } from 'applesauce-accounts/accounts';
	import { getProfileContent, getProfilePicture } from 'applesauce-core/helpers';
	import AccountProfile from './AccountProfile.svelte';

	let accounts = $state([])
	manager.accounts$.subscribe((account) => {
		console.log("something in accounts changed", account)
		accounts = account
	})

	async function createSigner(selectedSigner) {
		switch (selectedSigner) {
			case 'Extension':
				signer.signer = new ExtensionSigner();
				const pk = await signer.signer.getPublicKey();
				const account = new ExtensionAccount(pk, signer.signer);
				manager.addAccount(account);
				console.log('Account added:', account);
				manager.setActive(account);
				console.log('Manager:', manager);

				// load user profile
				// TODO maybe put this in account manager?
				loadUserProfile(0, pk).subscribe((profile) => {
					if (profile) {
						// console.log('Profile loaded:', profile.name);
						userProfile.profile = profile;
					}
				});

				// FIXME this needs to happen somewhere else
				const communities = eventStore.getByFilters({ kinds: [10222] })
				const relationships = eventStore.getByFilters({ kinds: [30382], '#p': [pk] })
				console.log("Loaded communities:", communities);
				for (const community of communities) {
					// load community relationships
					console.log('Loading joined communities for:', pk, "and identifier", community.pubkey);
					loadRelationships(pk, community.pubkey).subscribe((relationship) => {
						if (relationship) {
							// console.log('relationship loaded:', relationship);
							joinedCommunities.push(relationship)
						}
					});
				}
				document.getElementById(modalId).close();
			case 'NSEC':
				return null;
			case 'Bunker':
				return null;
			default:
				throw new Error('Unknown signer');
		}
	}
</script>

<dialog id={modalId} class="modal">
	<div class="modal-box">
		<h1 class="text-lg font-bold">Add an Account</h1>
		<p class="py-4">Press ESC key or click the button below to close</p>
		<div class="flex flex-col join">
			<button onclick={() => createSigner('Extension')} class="btn join-item">Extension</button>
			<button disabled onclick={() => createSigner('NSEC')} class="btn join-item">NSEC</button>
			<button disabled onclick={() => createSigner('Bunker')} class="btn join-item">Bunker</button>
		</div>
		<h1 class="text-lg font-bold mt-4">Don't have an account yet?</h1>
		<button class="btn" disabled>Sign Up!</button>
		<h1>Available Accounts</h1>
		<ul>
			{#each accounts as account}
			<AccountProfile {account} />
			{/each}
		</ul>
		<div class="modal-action">
			<form method="dialog">
				<!-- if there is a button in form, it will close the modal -->
				<button class="btn">Close</button>
			</form>
		</div>
	</div>
</dialog>
