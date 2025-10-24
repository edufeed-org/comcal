<!--
  EditableList Component
  Reusable component for managing a list of items (relays, servers, etc.)
-->

<script>
	let {
		items = $bindable([]),
		label = 'Items',
		placeholder = 'Enter item',
		buttonText = 'Add',
		itemType = 'item',
		validator = null,
		minItems = 0,
		helpText = ''
	} = $props();

	let inputValue = $state('');
	let error = $state('');

	/**
	 * Add a new item to the list
	 */
	function addItem() {
		const trimmedValue = inputValue.trim();
		
		if (!trimmedValue) {
			error = `Please enter a ${itemType}`;
			return;
		}

		// Check for duplicates
		if (items.includes(trimmedValue)) {
			error = `This ${itemType} is already in the list`;
			return;
		}

		// Run custom validator if provided
		if (validator) {
			const validationError = validator(trimmedValue);
			if (validationError) {
				error = validationError;
				return;
			}
		}

		// Add item
		items = [...items, trimmedValue];
		inputValue = '';
		error = '';
	}

	/**
	 * Remove an item from the list
	 * @param {number} index
	 */
	function removeItem(index) {
		// Check minimum items constraint
		if (items.length <= minItems) {
			error = `At least ${minItems} ${itemType}${minItems !== 1 ? 's' : ''} required`;
			return;
		}

		items = items.filter((_, i) => i !== index);
		error = '';
	}

	/**
	 * Handle Enter key in input
	 * @param {KeyboardEvent} e
	 */
	function handleKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addItem();
		}
	}
</script>

<div class="form-control">
	<label class="label">
		<span class="label-text">{label}</span>
		{#if helpText}
			<span class="label-text-alt">{helpText}</span>
		{/if}
	</label>

	<!-- Input row -->
	<div class="flex gap-2 mb-3">
		<input
			type="text"
			bind:value={inputValue}
			{placeholder}
			onkeydown={handleKeydown}
			class="input input-bordered flex-1"
			class:input-error={error}
		/>
		<button
			type="button"
			class="btn btn-primary"
			onclick={addItem}
		>
			{buttonText}
		</button>
	</div>

	<!-- Error message -->
	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}

	<!-- Items list -->
	{#if items.length > 0}
		<div class="space-y-2 mt-2">
			{#each items as item, index}
				<div class="flex items-center gap-2 bg-base-200 rounded-lg p-3">
					<span class="flex-1 text-sm break-all">{item}</span>
					<button
						type="button"
						class="btn btn-sm btn-ghost btn-circle"
						onclick={() => removeItem(index)}
						disabled={items.length <= minItems}
						aria-label="Remove {itemType}"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-sm text-base-content/60 italic">
			No {itemType}s added yet
		</div>
	{/if}
</div>
