// Fallback ambient declaration for the .zodiac-os codegen module.
// When `pull-org` has been run, node_modules/.zodiac-os/index.d.ts
// provides narrow `as const` types that take precedence over this.
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
              chainId: ChainId
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
