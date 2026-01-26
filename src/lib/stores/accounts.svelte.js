import { AccountManager } from 'applesauce-accounts';
import { registerCommonAccountTypes } from 'applesauce-accounts/accounts';

/**
 * @typedef {{ name?: string }} AccountMetadata
 */

/* Shared manager (keeps same instance across component mounts) */
export const manager = $state(new AccountManager());
registerCommonAccountTypes(manager);

// Initialize account persistence
async function initializeAccountPersistence() {
	if (typeof window === 'undefined') return; // Only run on client side

	try {
		// Step 1: Load existing accounts from localStorage
		const savedAccounts = localStorage.getItem('accounts');
		if (savedAccounts) {
			const json = JSON.parse(savedAccounts);
			await manager.fromJSON(json);
		}

		// Step 2: Load active account from storage
		const activeAccountId = localStorage.getItem('active');
		if (activeAccountId && manager.getAccount(activeAccountId)) {
			manager.setActive(activeAccountId);
		}
	} catch (error) {
		console.error('❌ Failed to load accounts from storage:', error);
	}

	// Step 3: Subscribe to account changes and persist to localStorage
	manager.accounts$.subscribe((accounts) => {
		try {
			const json = manager.toJSON();
			localStorage.setItem('accounts', JSON.stringify(json));
		} catch (error) {
			console.error('❌ Failed to save accounts to storage:', error);
		}
	});

	// Step 4: Subscribe to active account changes and persist
	manager.active$.subscribe((account) => {
		try {
			if (account) {
				localStorage.setItem('active', account.id);
			} else {
				localStorage.removeItem('active');
			}
		} catch (error) {
			console.error('❌ Failed to save active account:', error);
		}
	});

	// Step 5: Pre-warm relays when user logs in
	manager.active$.subscribe(async (account) => {
		if (account) {
			// Use dynamic import to avoid circular dependencies
			const { warmUserRelays, warmAppRelays, clearWarmStatus } = await import(
				'$lib/services/relay-warming-service.svelte.js'
			);

			// Warm user's write relays and app relays with authentication
			warmUserRelays(account.pubkey, account.signer);
			warmAppRelays(account.signer);
		} else {
			// User logged out - clear warm status
			const { clearWarmStatus } = await import(
				'$lib/services/relay-warming-service.svelte.js'
			);
			clearWarmStatus();
		}
	});

	// Step 6: Load contacts for follow list search when user logs in
	manager.active$.subscribe(async (account) => {
		// Use dynamic import to avoid circular dependencies
		const { contactsStore } = await import('./contacts.svelte.js');

		if (account) {
			contactsStore.loadContacts(account.pubkey);
		} else {
			contactsStore.clear();
		}
	});
}

// Initialize persistence when module loads (client-side only)
initializeAccountPersistence();

export const accounts = $state(/** @type {any[]} */ ([]));

// Authentication signer state (migrated from shared.svelte.js in Phase 1)
export let signer = $state({
	signer: null
});

/**
 * Custom hook for loading and managing accounts list from AccountManager
 * @returns {() => any[]} - Reactive getter function returning array of accounts
 */
export function useAccounts() {
	let accounts = $state(/** @type {any[]} */ ([]));

	$effect(() => {
		const subscription = manager.accounts$.subscribe((accountList) => {
			accounts = accountList;
		});
		return () => subscription.unsubscribe();
	});

	return () => accounts;
}

/**
 * Custom hook for loading and managing active user from AccountManager
 * @returns {() => any} - Reactive getter function returning active user
 */
export function useActiveUser() {
	let activeUser = $state(manager.active);

	$effect(() => {
		const subscription = manager.active$.subscribe((user) => {
			activeUser = user;
		});
		return () => subscription.unsubscribe();
	});

	return () => activeUser;
}
