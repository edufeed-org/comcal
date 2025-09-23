<script>
	let { userData, errors = $bindable({}) } = $props();

	function validateStep() {
		errors = {};

		if (!userData.name.trim()) {
			errors.name = 'Name is required';
			return false;
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
	<div class="form-control">
		<label class="label">
			<span class="label-text">Name *</span>
		</label>
		<input
			type="text"
			bind:value={userData.name}
			placeholder="Your name or nickname"
			class="input input-bordered w-full"
			class:input-error={errors.name}
		/>
		{#if errors.name}
			<label class="label">
				<span class="label-text-alt text-error">{errors.name}</span>
			</label>
		{/if}
	</div>

	<!-- About -->
	<div class="form-control">
		<label class="label">
			<span class="label-text">About</span>
		</label>
		<textarea
			bind:value={userData.about}
			placeholder="Tell us something about yourself"
			class="textarea textarea-bordered h-24"
		></textarea>
	</div>

	<!-- Website -->
	<div class="form-control">
		<label class="label">
			<span class="label-text">Website</span>
		</label>
		<input
			type="url"
			bind:value={userData.website}
			placeholder="https://your-website.com"
			class="input input-bordered w-full"
		/>
	</div>
</div>
