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

type NodeRef = Readonly<Record<string, any>>

// Extract vault entries for a specific workspace
type WorkspaceVaultEntries<
  C extends CodegenData,
  W extends keyof C['vaults'],
> = C['vaults'][W]['vaults']

type EntityAccessor<
  Type extends string,
  Entries extends Record<string, any>,
  Ch extends ChainId = ChainId,
> = {
  readonly [K in keyof Entries & string]: <O extends Record<string, any> = {}>(
    overrides?: { [P in Exclude<keyof Entries[K], 'id' | 'label'>]?: any } & {
      [key: string & {}]: any
    } & O
  ) => Readonly<
    Prettify<
      Omit<Entries[K], keyof O> & O & { type: Type; label: K; chainId: Ch }
    >
  >
} & {
  new: <P extends Record<string, any>>(
    props: P
  ) => Readonly<Prettify<P & { type: Type; chainId: Ch }>>
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
  safe: EntityAccessor<'SAFE', WorkspaceVaultEntries<C, W>, Ch>
  roles: EntityAccessor<'ROLES', WorkspaceVaultEntries<C, W>, Ch>
  user: UserAccessor<C, Ch>
  _nodes: NodeRef[]
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
  const nodes: NodeRef[] = []

  const ws = codegen.vaults[opts.workspace]
  const vaultsByLabel: Record<string, Vault> = {}
  if (ws) {
    for (const [label, vault] of Object.entries(ws.vaults)) {
      vaultsByLabel[label] = vault
    }
  }

  function makeNodeRef(data: Record<string, any>): NodeRef {
    const ref = Object.freeze({ ...data, chain: opts.chainId })
    nodes.push(ref)
    return ref
  }

  function entityAccessor(
    registry: Record<string, Record<string, any>>,
    type: string
  ) {
    const create = (props: Record<string, any>) => {
      return makeNodeRef({ type, ...props })
    }

    return new Proxy({} as Record<string, any>, {
      get(_target: any, name: string) {
        if (typeof name !== 'string') return undefined
        if (name === 'new') return create
        const existing = registry[name]
        return (overrides?: Record<string, any>) => {
          return makeNodeRef({
            type,
            ...(existing || {}),
            ...overrides,
            label: name,
          })
        }
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
    _nodes: nodes,
  } as ConstellationResult<C, W, Ch>
}
