// Fallback ambient declarations for the .zodiac codegen module and for
// the AllowKit interface. When `pull-org` / `pull-contracts` have been run,
// the files under `<cwd>/.zodiac/` provide narrow types that take
// precedence over these empty fallbacks.
//
// This file is a script (no imports/exports), so the top-level interface is
// implicitly global and `declare module '.zodiac'` registers a new ambient
// module. Adding `export {}` would turn it into a module, which would
// silently drop the ambient module declaration.

// Augmented by `<cwd>/.zodiac/allow.d.ts` when `pull-contracts` runs.
interface AllowKit {}

declare module '.zodiac' {
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
