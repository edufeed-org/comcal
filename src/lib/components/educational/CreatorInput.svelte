<!--
  CreatorInput Component
  Multi-entry form for managing creators/contributors with optional Nostr identity
-->

<script>
	import { CloseIcon, PlusIcon, UserIcon } from '$lib/components/icons';
	import { getProfilePicture } from 'applesauce-core/helpers';
	import { useUserProfile } from '$lib/stores/user-profile.svelte';
	import { fetchProfileData } from '$lib/helpers/profile.js';
	import { normalizeToHex } from '$lib/helpers/nostrUtils.js';
	import { contactsStore } from '$lib/stores/contacts.svelte.js';

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
	let isLoadingProfile = $state(false);

	// State for contact search dropdown
	let showDropdown = $state(false);
	let selectedDropdownIndex = $state(-1);
	/** @type {import('$lib/models/contacts-model.js').EnrichedContact[]} */
	let filteredContacts = $state([]);

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

	/**
	 * Handle pubkey field blur - normalize and auto-fill name from profile
	 */
	async function handlePubkeyBlur() {
		// Delay dropdown close to allow click on dropdown item
		setTimeout(() => {
			showDropdown = false;
		}, 200);

		const input = newCreator.pubkey?.trim();
		if (!input) return;

		// Validate and normalize to hex
		const hexPubkey = normalizeToHex(input);
		if (!hexPubkey) return; // Invalid input

		// Store normalized hex pubkey
		newCreator.pubkey = hexPubkey;

		// Only fetch profile if name is empty
		if (newCreator.name.trim()) return;

		isLoadingProfile = true;
		try {
			const profile = await fetchProfileData(hexPubkey);
			// @ts-ignore - profile has name property from fetchProfileData
			if (profile && typeof profile.name === 'string' && profile.name !== 'Anonymous') {
				// @ts-ignore
				newCreator.name = profile.name;
			}
		} catch (error) {
			console.warn('Failed to fetch profile:', error);
		} finally {
			isLoadingProfile = false;
		}
	}

	/**
	 * Search contacts as user types in pubkey field
	 * @param {string} searchTerm
	 */
	function searchContacts(searchTerm) {
		if (!searchTerm || searchTerm.trim().length < 2) {
			filteredContacts = [];
			showDropdown = false;
			return;
		}

		// Get matching contacts from store
		const matches = contactsStore.searchContacts(searchTerm, 10);

		// Filter out already added creators
		filteredContacts = matches.filter(
			(contact) => !creators.some((cr) => cr.pubkey === contact.pubkey)
		);

		showDropdown = filteredContacts.length > 0;
		selectedDropdownIndex = -1;
	}

	/**
	 * Handle keyboard navigation in dropdown
	 * @param {KeyboardEvent} event
	 */
	function handleKeydown(event) {
		if (showDropdown && filteredContacts.length > 0) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				selectedDropdownIndex = Math.min(selectedDropdownIndex + 1, filteredContacts.length - 1);
			} else if (event.key === 'ArrowUp') {
				event.preventDefault();
				selectedDropdownIndex = Math.max(selectedDropdownIndex - 1, -1);
			} else if (event.key === 'Enter' && selectedDropdownIndex >= 0) {
				event.preventDefault();
				selectContact(filteredContacts[selectedDropdownIndex]);
			} else if (event.key === 'Escape') {
				showDropdown = false;
				selectedDropdownIndex = -1;
			}
		}
	}

	/**
	 * Select a contact from the dropdown
	 * @param {import('$lib/models/contacts-model.js').EnrichedContact} contact
	 */
	function selectContact(contact) {
		newCreator.pubkey = contact.pubkey;
		newCreator.name = contact.display_name || contact.name || '';
		showDropdown = false;
		filteredContacts = [];
		selectedDropdownIndex = -1;
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
						<div class="w-10 h-10 rounded-full bg-neutral text-neutral-content flex items-center justify-center overflow-hidden">
							{#if creator.pubkey}
								{@const getProfile = useUserProfile(creator.pubkey)}
								{#if getProfile() && getProfilePicture(getProfile())}
									<img src={getProfilePicture(getProfile())} alt={creator.name} class="w-full h-full object-cover" />
								{:else if creator.type === 'Organization'}
									<span class="text-lg">🏢</span>
								{:else}
									<span class="text-lg">{creator.name[0]?.toUpperCase() || '?'}</span>
								{/if}
							{:else if creator.type === 'Organization'}
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

			<!-- Nostr Pubkey / Contact Search - First field for auto-fill -->
			<div class="form-control relative">
				<label class="label py-1">
					<span class="label-text text-sm">Nostr Identity (optional)</span>
				</label>
				<input
					type="text"
					class="input input-bordered input-sm w-full"
					bind:value={newCreator.pubkey}
					oninput={(e) => searchContacts(e.currentTarget.value)}
					onkeydown={handleKeydown}
					onblur={handlePubkeyBlur}
					placeholder="Search follows or enter npub..."
				/>

				<!-- Contact Search Dropdown -->
				{#if showDropdown && filteredContacts.length > 0}
					<div class="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto" style="top: 100%;">
						{#each filteredContacts as contact, index (contact.pubkey)}
							<button
								type="button"
								class="w-full px-3 py-2 flex items-center gap-2 hover:bg-base-200 text-left transition-colors"
								class:bg-base-200={index === selectedDropdownIndex}
								onclick={() => selectContact(contact)}
							>
								{#if contact.picture}
									<img src={contact.picture} alt="" class="w-8 h-8 rounded-full object-cover" />
								{:else}
									<div class="w-8 h-8 rounded-full bg-neutral flex items-center justify-center text-neutral-content text-sm">
										{(contact.display_name || contact.name || '?')[0]?.toUpperCase()}
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<div class="font-medium truncate text-sm">
										{contact.display_name || contact.name || 'Anonymous'}
									</div>
									{#if contact.nip05}
										<div class="text-xs text-base-content/60 truncate">{contact.nip05}</div>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				{/if}

				<!-- Status hint -->
				{#if contactsStore.isLoaded && contactsStore.contacts.length > 0}
					<label class="label py-0">
						<span class="label-text-alt text-xs text-base-content/60">
							Search {contactsStore.contacts.length} follows or enter npub
						</span>
					</label>
				{:else if contactsStore.isLoading}
					<label class="label py-0">
						<span class="label-text-alt text-xs text-base-content/60 flex items-center gap-1">
							<span class="loading loading-spinner loading-xs"></span>
							Loading contacts...
						</span>
					</label>
				{:else}
					<label class="label py-0">
						<span class="label-text-alt text-xs text-base-content/60">
							Enter npub to auto-fill from profile
						</span>
					</label>
				{/if}
			</div>

			<!-- Name -->
			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-sm flex items-center gap-2">
						Name <span class="text-error">*</span>
						{#if isLoadingProfile}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
					</span>
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
