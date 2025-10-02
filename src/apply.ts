import { Account, AccountUpdateOrCreate } from './types'

/**
 * Applies accounts specifications to Zodiac OS
 * @param accounts Accounts specifications (updates to existing accounts or new accounts)
 * @returns URL to the open in the browser to review & execute the account setup.
 */
export async function apply(
  api: ApiClient,
  accounts: AccountUpdateOrCreate[]
): Promise<URL> {}
