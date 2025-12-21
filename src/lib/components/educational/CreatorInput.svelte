<!--
  CreatorInput Component
  Multi-entry form for managing creators/contributors with optional Nostr identity
-->

<script>
	import { CloseIcon, PlusIcon, UserIcon } from '$lib/components/icons';

	/**
	 * @typedef {Object} Creator
	 * @property {string} name - Creator name
	 * @property {'Person' | 'Organization'} type - Creator type
	 * @property {string} [pubkey] - Optional Nostr pubkey (hex)
	 * @property {string} [affiliationName] - Optional affiliation name
	 * @property {string} [honorificPrefix] - Optional title (Dr., Prof., etc.)
	 */

	/** @type {{ creators?: Creator[], label?: string, required?: boolean, helpText?: string, onchange?: (creators: Creator[]) => void }} */
	let {
		creators = $bindable([]),
		label = 'Creators',
		required = false,
		helpText = '',
		onchange = () => {}
	} = $props();

	// State for new creator form
	let showAddForm = $state(false);
	let newCreator = $state(createEmptyCreator());
	let editingIndex = $state(/** @type {number | null} */ (null));

	/**
	 * Create an empty creator object
	 * @returns {Creator}
	 */
	function createEmptyCreator() {
		return {
			name: '',
			type: 'Person',
			pubkey: '',
			affiliationName: '',
			honorificPrefix: ''
		};
	}

	/**
	 * Add a new creator
	 */
	function addCreator() {
		if (!newCreator.name.trim()) return;

		const creatorToAdd = { ...newCreator };
		// Clean up empty optional fields
		if (!creatorToAdd.pubkey?.trim()) delete creatorToAdd.pubkey;
		if (!creatorToAdd.affiliationName?.trim()) delete creatorToAdd.affiliationName;
		if (!creatorToAdd.honorificPrefix?.trim()) delete creatorToAdd.honorificPrefix;

		if (editingIndex !== null) {
			// Update existing
			creators = creators.map((c, i) => (i === editingIndex ? creatorToAdd : c));
			editingIndex = null;
		} else {
			// Add new
			creators = [...creators, creatorToAdd];
		}

		newCreator = createEmptyCreator();
		showAddForm = false;
		onchange(creators);
	}

	/**
	 * Remove a creator
	 * @param {number} index
	 */
	function removeCreator(index) {
		creators = creators.filter((_, i) => i !== index);
		onchange(creators);
	}

	/**
	 * Edit a creator
	 * @param {number} index
	 */
	function editCreator(index) {
		newCreator = { ...creators[index] };
		editingIndex = index;
		showAddForm = true;
	}

	/**
	 * Cancel adding/editing
	 */
	function cancelAdd() {
		newCreator = createEmptyCreator();
		editingIndex = null;
		showAddForm = false;
	}

	/**
	 * Handle form submission
	 * @param {Event} e
	 */
	function handleSubmit(e) {
		e.preventDefault();
		addCreator();
	}

	/**
	 * Get display text for creator type
	 * @param {'Person' | 'Organization'} type
	 * @returns {string}
	 */
	function getTypeLabel(type) {
		return type === 'Person' ? '👤 Person' : '🏢 Organization';
	}
</script>

<div class="creator-input form-control w-full">
	<!-- Label -->
	{#if label}
		<label class="label">
			<span class="label-text font-medium">
				{label}
				{#if required}
					<span class="text-error">*</span>
				{/if}
			</span>
		</label>
	{/if}

	<!-- Existing Creators List -->
	{#if creators.length > 0}
		<div class="space-y-2 mb-3">
			{#each creators as creator, index}
				<div class="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
					<div class="avatar placeholder">
						<div class="w-10 h-10 rounded-full bg-neutral text-neutral-content">
							{#if creator.type === 'Organization'}
								<span class="text-lg">🏢</span>
							{:else}
								<span class="text-lg">{creator.name[0]?.toUpperCase() || '?'}</span>
							{/if}
						</div>
					</div>
					<div class="flex-1 min-w-0">
						<div class="font-medium text-base-content truncate">
							{#if creator.honorificPrefix}
								{creator.honorificPrefix}
							{/if}
							{creator.name}
						</div>
						<div class="text-xs text-base-content/60 flex items-center gap-2">
							<span>{creator.type}</span>
							{#if creator.affiliationName}
								<span>• {creator.affiliationName}</span>
							{/if}
							{#if creator.pubkey}
								<span class="badge badge-xs badge-primary">Nostr</span>
							{/if}
						</div>
					</div>
					<button
						type="button"
						class="btn btn-ghost btn-xs"
						onclick={() => editCreator(index)}
						aria-label="Edit creator"
					>
						Edit
					</button>
					<button
						type="button"
						class="btn btn-ghost btn-xs text-error"
						onclick={() => removeCreator(index)}
						aria-label="Remove creator"
					>
						<CloseIcon class_="w-4 h-4" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Add Creator Form -->
	{#if showAddForm}
		<form onsubmit={handleSubmit} class="p-4 bg-base-200 rounded-lg space-y-3">
			<div class="flex items-center justify-between mb-2">
				<span class="font-medium text-sm">
					{editingIndex !== null ? 'Edit Creator' : 'Add Creator'}
				</span>
				<button type="button" class="btn btn-ghost btn-xs" onclick={cancelAdd}>
					Cancel
				</button>
			</div>

			<!-- Name -->
			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-sm">Name <span class="text-error">*</span></span>
				</label>
				<input
					type="text"
					class="input input-bordered input-sm w-full"
					bind:value={newCreator.name}
					placeholder="Enter name"
					required
				/>
			</div>

			<!-- Type -->
			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-sm">Type</span>
				</label>
				<select class="select select-bordered select-sm w-full" bind:value={newCreator.type}>
					<option value="Person">👤 Person</option>
					<option value="Organization">🏢 Organization</option>
				</select>
			</div>

			<!-- Honorific Prefix (for persons) -->
			{#if newCreator.type === 'Person'}
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-sm">Title (optional)</span>
					</label>
					<input
						type="text"
						class="input input-bordered input-sm w-full"
						bind:value={newCreator.honorificPrefix}
						placeholder="Dr., Prof., etc."
					/>
				</div>
			{/if}

			<!-- Affiliation -->
			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-sm">Affiliation (optional)</span>
				</label>
				<input
					type="text"
					class="input input-bordered input-sm w-full"
					bind:value={newCreator.affiliationName}
					placeholder="University, Company, etc."
				/>
			</div>

			<!-- Nostr Pubkey -->
			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-sm">Nostr Pubkey (optional)</span>
				</label>
				<input
					type="text"
					class="input input-bordered input-sm w-full font-mono text-xs"
					bind:value={newCreator.pubkey}
					placeholder="npub1... or hex pubkey"
				/>
				<label class="label py-0">
					<span class="label-text-alt text-xs text-base-content/60">
						If the creator has a Nostr identity
					</span>
				</label>
			</div>

			<!-- Submit Button -->
			<button
				type="submit"
				class="btn btn-primary btn-sm w-full"
				disabled={!newCreator.name.trim()}
			>
				{editingIndex !== null ? 'Update Creator' : 'Add Creator'}
			</button>
		</form>
	{:else}
		<!-- Add Button -->
		<button
			type="button"
			class="btn btn-outline btn-sm w-full"
			onclick={() => (showAddForm = true)}
		>
			<PlusIcon class_="w-4 h-4" />
			Add Creator
		</button>
	{/if}

	<!-- Help Text -->
	{#if helpText}
		<label class="label">
			<span class="label-text-alt text-base-content/60">{helpText}</span>
		</label>
	{/if}
</div>
