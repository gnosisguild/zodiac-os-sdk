/// <reference path="./zodiac-os-codegen.d.ts" />
import { Address, ChainId } from '@zodiac-os/api-types'
import { createRequire } from 'module'
import type * as ZodiacOsCodegen from '.zodiac-os'
import { UUID } from 'crypto'

type User = {
  id: string
  fullName: string
  personalSafes: Record<number, { address: string; active: boolean }>
}

type Vault = {
  id: UUID
  label: string
  address: Lowercase<Address>
  chainId: ChainId
  threshold: number
  owners: readonly string[]
  modules: readonly string[]
}

type WorkspaceVaults = {
  workspaceId: UUID
  workspaceName: string
  vaults: Readonly<Record<string, Vault>>
}

export type CodegenData = {
  users: Readonly<Record<string, User>>
  vaults: Readonly<Record<string, WorkspaceVaults>>
}

type GeneratedCodegen = {
  users: typeof ZodiacOsCodegen.users
  vaults: typeof ZodiacOsCodegen.vaults
}

type ConstellationOpts<C extends CodegenData> = {
  workspace: keyof C['vaults'] & string
  label: string
  chainId: ChainId
}

type ConstellationInternalOpts<C extends CodegenData> = {
  codegen?: C
}

type Prettify<T> = { readonly [K in keyof T]: T[K] } & {}

// Extract vault entries for a specific workspace
type WorkspaceVaultEntries<
  C extends CodegenData,
  W extends keyof C['vaults'],
> = C['vaults'][W]['vaults']

type NewSafeProps = {
  nonce: bigint
  threshold: number
  owners: readonly any[]
  modules: readonly any[]
}

type NewRolesProps = {
  nonce: bigint
  target: any
  threshold: number
  owners: readonly any[]
  modules: readonly any[]
}

type EntityAccessor<
  Type extends string,
  Entries extends Record<string, any>,
  Ch extends ChainId = ChainId,
  NP extends Record<string, any> = Record<string, any>,
> = {
  readonly [K in
    | (keyof Entries & string)
    | (string & {})]: K extends keyof Entries & string
    ? Readonly<Prettify<Entries[K] & { type: Type; label: K; chainId: Ch }>> &
        (<O extends Record<string, any> = {}>(
          overrides?: {
            [P in Exclude<keyof Entries[K] & string, 'id' | 'label'>]?: any
          } & O
        ) => Readonly<
          Prettify<
            Omit<Entries[K], keyof O> &
              O & { type: Type; label: K; chainId: Ch }
          >
        >)
    : <P extends Record<string, any>>(
        props: NP & { [key: string & {}]: any } & P
      ) => Readonly<Prettify<P & { type: Type; label: string; chainId: Ch }>>
}

type UserAccessor<C extends CodegenData, Ch extends number> = {
  readonly [K in keyof C['users'] &
    string]: C['users'][K]['personalSafes'][Ch]['address']
}

type ConstellationResult<
  C extends CodegenData,
  W extends keyof C['vaults'] = keyof C['vaults'],
  Ch extends ChainId = ChainId,
> = {
  safe: EntityAccessor<'SAFE', WorkspaceVaultEntries<C, W>, Ch, NewSafeProps>
  roles: EntityAccessor<'ROLES', WorkspaceVaultEntries<C, W>, Ch, NewRolesProps>
  user: UserAccessor<C, Ch>
}

function loadCodegen(): CodegenData {
  const require = createRequire(import.meta.url)
  return require('.zodiac-os') as CodegenData
}

export function constellation<
  const C extends CodegenData = GeneratedCodegen,
  const W extends keyof C['vaults'] & string = keyof C['vaults'] & string,
  const Ch extends ChainId = ChainId,
>(
  opts: ConstellationOpts<C> & { workspace: W; chainId: Ch },
  internal?: ConstellationInternalOpts<C>
): ConstellationResult<C, W, Ch> {
  const codegen: CodegenData = internal?.codegen ?? loadCodegen()

  const ws = codegen.vaults[opts.workspace]
  const vaultsByLabel: Record<string, Vault> = {}
  if (ws) {
    for (const [label, vault] of Object.entries(ws.vaults)) {
      vaultsByLabel[label] = vault
    }
  }

  function makeNodeRef(
    data: Record<string, any>
  ): Readonly<Record<string, any>> {
    return Object.freeze({ ...data, chainId: opts.chainId })
  }

  function entityAccessor(
    registry: Record<string, Record<string, any>>,
    type: string
  ) {
    return new Proxy({} as Record<string, any>, {
      get(_target: any, name: string) {
        if (typeof name !== 'string') return undefined
        const existing = registry[name]
        const fn = (overrides?: Record<string, any>) => {
          return makeNodeRef({
            type,
            ...(existing || {}),
            ...overrides,
            label: name,
          })
        }
        if (existing) {
          Object.assign(fn, {
            type,
            ...existing,
            label: name,
            chainId: opts.chainId,
          })
        }
        return fn
      },
    })
  }

  function userAccessor() {
    return new Proxy(
      {},
      {
        get(_target: any, name: string) {
          const user = codegen.users[name]
          if (!user) throw new Error(`Unknown user: ${name}`)
          const personalSafe = user.personalSafes[opts.chainId]
          if (!personalSafe) {
            throw new Error(
              `User ${name} has no personal safe on chain ${opts.chainId}`
            )
          }
          return personalSafe.address
        },
      }
    )
  }

  return {
    safe: entityAccessor(vaultsByLabel, 'SAFE'),
    roles: entityAccessor(vaultsByLabel, 'ROLES'),
    user: userAccessor(),
  } as ConstellationResult<C, W, Ch>
}
