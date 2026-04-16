// Fallback ambient declarations for the .zodiac-os codegen module and for
// the AllowKit interface. When `pull-org` / `pull-contracts` have been run,
// the files under node_modules/.zodiac-os/ provide narrow types that take
// precedence over these empty fallbacks.

declare global {
  // Augmented by node_modules/.zodiac-os/allow.d.ts when `pull-contracts` runs.
  interface AllowKit {}
}

declare module '.zodiac-os' {
  import { Address, ChainId } from '@zodiac-os/api-types'
  import { UUID } from 'crypto'

  export const users: Readonly<
    Record<
      string,
      {
        id: UUID
        fullName: string
        personalSafes: Record<
          number,
          { address: Lowercase<Address>; active: boolean }
        >
      }
    >
  >

  export const vaults: Readonly<
    Record<
      string,
      {
        workspaceId: UUID
        workspaceName: string
        vaults: Readonly<
          Record<
            string,
            {
              id: UUID
              label: string
              address: Lowercase<Address>
              chain: ChainId
              threshold: number
              owners: readonly string[]
              modules: readonly string[]
            }
          >
        >
      }
    >
  >
}
