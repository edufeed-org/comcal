import { AccountManager } from "applesauce-accounts";
import { registerCommonAccountTypes } from "applesauce-accounts/accounts";


/**
 * @typedef {{ name?: string }} AccountMetadata
 */

/* Shared manager (keeps same instance across component mounts) */
export const manager = $state(new AccountManager());
registerCommonAccountTypes(manager);

// subscribe to the active account
manager.active$.subscribe((account) => {
  if (account) console.log(`${account.id} is now active`);
  else console.log("no account is active");

  // updateUI();
});

export const accounts = $state([])