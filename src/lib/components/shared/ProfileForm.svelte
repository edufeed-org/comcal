<script>
	let { userData, errors = $bindable({}) } = $props();

	function validateStep() {
		errors = {};

		if (!userData.name.trim()) {
			errors.name = 'Name is required';
			return false;
		}
		
		// Validate URLs if provided
		if (userData.website && userData.website.trim()) {
			try {
				new URL(userData.website);
			} catch {
				errors.website = 'Please enter a valid URL';
				return false;
			}
		}
		
		if (userData.picture && userData.picture.trim()) {
			try {
				new URL(userData.picture);
			} catch {
				errors.picture = 'Please enter a valid image URL';
				return false;
			}
		}
		
		if (userData.banner && userData.banner.trim()) {
			try {
				new URL(userData.banner);
			} catch {
				errors.banner = 'Please enter a valid image URL';
				return false;
			}
		}
		
		return true;
	}

	// Expose validation function for parent components
	// @ts-ignore
	$effect.root(() => {
		// This makes validateStep available to parent components
		if (typeof window !== 'undefined') {
			// @ts-ignore
			window.profileFormValidate = validateStep;
		}
	});
</script>

<div class="space-y-4">
	<!-- Name -->
	<div class="form-control flex flex-col">
		<label class="label" for="profile-name">
			<span class="label-text text-center w-full">Name *</span>
		</label>
		<input
			id="profile-name"
			type="text"
			bind:value={userData.name}
			placeholder="Your name or nickname"
			class="input input-bordered w-full"
			class:input-error={errors.name}
		/>
		{#if errors.name}
			<div class="label" aria-live="polite">
				<span class="label-text-alt text-center w-full text-error">{errors.name}</span>
			</div>
		{/if}
	</div>

	<!-- Display Name -->
	<div class="form-control flex flex-col">
		<label class="label" for="profile-display-name">
			<span class="label-text text-center w-full">Display Name</span>
		</label>
		<input
			id="profile-display-name"
			type="text"
			bind:value={userData.display_name}
			placeholder="@username"
			class="input input-bordered w-full"
		/>
	</div>

	<!-- About -->
	<div class="form-control flex flex-col">
		<label class="label" for="profile-about">
			<span class="label-text text-center w-full">About</span>
		</label>
		<textarea
			id="profile-about"
			bind:value={userData.about}
			placeholder="Tell us something about yourself"
			class="textarea textarea-bordered h-24 w-full"
		></textarea>
	</div>

	<!-- Profile Picture URL -->
	<div class="form-control flex flex-col">
		<label class="label" for="profile-picture">
			<span class="label-text text-center w-full">Profile Picture URL</span>
		</label>
		<input
			id="profile-picture"
			type="url"
			bind:value={userData.picture}
			placeholder="https://example.com/avatar.jpg"
			class="input input-bordered w-full"
			class:input-error={errors.picture}
		/>
		{#if errors.picture}
			<div class="label" aria-live="polite">
				<span class="label-text-alt text-center w-full text-error">{errors.picture}</span>
			</div>
		{/if}
	</div>

	<!-- Banner Image URL -->
	<div class="form-control flex flex-col">
		<label class="label" for="profile-banner">
			<span class="label-text text-center w-full">Banner Image URL</span>
		</label>
		<input
			id="profile-banner"
			type="url"
			bind:value={userData.banner}
			placeholder="https://example.com/banner.jpg"
			class="input input-bordered w-full"
			class:input-error={errors.banner}
		/>
		{#if errors.banner}
			<div class="label" aria-live="polite">
				<span class="label-text-alt text-center w-full text-error">{errors.banner}</span>
			</div>
		{/if}
	</div>

	<!-- Website -->
	<div class="form-control flex flex-col">
		<label class="label" for="profile-website">
			<span class="label-text text-center w-full">Website</span>
		</label>
		<input
			id="profile-website"
			type="url"
			bind:value={userData.website}
			placeholder="https://your-website.com"
			class="input input-bordered w-full"
			class:input-error={errors.website}
		/>
		{#if errors.website}
			<div class="label" aria-live="polite">
				<span class="label-text-alt text-center w-full text-error">{errors.website}</span>
			</div>
		{/if}
	</div>

	<!-- NIP-05 Identifier -->
	<div class="form-control flex flex-col">
		<label class="label" for="profile-nip05">
			<span class="label-text text-center w-full">NIP-05 Identifier</span>
		</label>
		<input
			id="profile-nip05"
			type="text"
			bind:value={userData.nip05}
			placeholder="name@domain.com"
			class="input input-bordered w-full"
		/>
		<div class="label">
			<span class="label-text-alt text-center w-full text-gray-400">Verified identity</span>
		</div>
	</div>

	<!-- Lightning Address (LUD16) -->
	<div class="form-control flex flex-col">
		<label class="label" for="profile-lud16">
			<span class="label-text text-center w-full">Lightning Address</span>
		</label>
		<input
			id="profile-lud16"
			type="text"
			bind:value={userData.lud16}
			placeholder="name@getalby.com"
			class="input input-bordered w-full"
		/>
	</div>
</div>
