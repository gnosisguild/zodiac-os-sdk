// Fallback ambient declaration for the .zodiac-os codegen module.
// When `pull-org` has been run, node_modules/.zodiac-os/index.d.ts
// provides narrow `as const` types that take precedence over this.
declare module '.zodiac-os' {
  export const users: Readonly<
    Record<
      string,
      {
        id: string
        fullName: string
        personalSafes: Record<
          number,
          { address: string; active: boolean }
        >
      }
    >
  >

  export const vaults: Readonly<
    Record<
      string,
      {
        workspaceId: string
        workspaceName: string
        vaults: Readonly<
          Record<
            string,
            {
              id: string
              label: string
              address: string
              chainId: number
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
