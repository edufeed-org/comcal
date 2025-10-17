import { AccountManager } from 'applesauce-accounts';
import { registerCommonAccountTypes } from 'applesauce-accounts/accounts';

/**
 * @typedef {{ name?: string }} AccountMetadata
 */

/* Shared manager (keeps same instance across component mounts) */
export const manager = $state(new AccountManager());
registerCommonAccountTypes(manager);

// subscribe to the active account
manager.active$.subscribe((account) => {
	if (account) console.log(`${account.id} is now active`);
	else console.log('no account is active');

	// updateUI();
});

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
