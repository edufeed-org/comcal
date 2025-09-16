import { manager } from '$lib/accounts.svelte';

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
