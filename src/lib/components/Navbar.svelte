<script>
	import { getProfilePicture } from 'applesauce-core/helpers';
	import LoginModal from './LoginModal.svelte';
	import { userProfile } from '$lib/shared.svelte';

	const loginModalRef = 'loginModal';
</script>

<div class="navbar bg-base-100 shadow-sm">
	<div class="flex-1">
		<a href="/" class="btn text-xl btn-ghost">Communikey</a>
	</div>
	<div class="flex gap-2">
		{#if userProfile.profile}
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn avatar btn-circle btn-ghost">
					<div class="w-10 rounded-full">
						<img alt="Tailwind CSS Navbar component" src={getProfilePicture(userProfile.profile)} />
					</div>
				</div>
				<ul class="dropdown-content menu z-1 mt-3 w-52 menu-sm rounded-box bg-base-100 p-2 shadow">
					<li>
						<a href="#" class="justify-between">
							Profile
							<span class="badge">New</span>
						</a>
					</li>
					<li>
						<button
							onclick={() => {
								const modal = document.getElementById(loginModalRef);
								if (modal) modal.showModal();
							}}>Switch Account</button
						>
					</li>
					<li><a href="#">Settings</a></li>
					<li><a href="#">Logout</a></li>
				</ul>
			</div>
		{:else}
			<button
				onclick={() => {
					const modal = document.getElementById(loginModalRef);
					if (modal) modal.showModal();
				}}
				class="btn btn-ghost">Login</button
			>
		{/if}
	</div>
</div>

<LoginModal modalId={loginModalRef} />
