<script>
	let {modalId} = $props()

	import { ExtensionSigner } from 'applesauce-signers';
	import { signer, userProfile, joinedCommunities, communities } from '$lib/shared.svelte.js';
	import { loadJoinedCommunities, loadUserProfile } from '$lib/store.js';

	import { manager } from '$lib/accounts.svelte';
	import { ExtensionAccount } from 'applesauce-accounts/accounts';
	import { getProfileContent, getProfilePicture } from 'applesauce-core/helpers';

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

				for (const community of communities) {
					// load community relationships
					// console.log('Loading joined communities for:', pk, "and identifier", community.pubkey);
					loadJoinedCommunities(pk, community.pubkey).subscribe((relationship) => {
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
		<h1>Logged In Accounts</h1>
		<ul>
			{#each accounts as account}
			{@const profile = loadUserProfile(0, account.pubkey)}
			<div class="w-full border border-purple-400 rounded-md p-2 flex items-center">
				<div tabindex="0" role="button" class="btn avatar btn-circle btn-ghost">
					<div class="w-10 rounded-full">
						<img alt="" src={getProfilePicture(userProfile.profile)} />
					</div>
				</div>
				<li>{#if profile?.name} {getProfileContent(profile).name} {/if} {#if account === manager.active} (active) {/if}</li>
			</div>
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
