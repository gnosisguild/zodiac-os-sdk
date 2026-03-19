/// <reference path="./zodiac-os-codegen.d.ts" />
import { ChainId } from '@zodiac-os/api-types'
import { createRequire } from 'module'
import type * as ZodiacOsCodegen from '.zodiac-os'

type User = {
  id: string
  fullName: string
  personalSafes: Record<number, { address: string; active: boolean }>
}

type Vault = {
  id: string
  label: string
  address: string
  chainId: number
  threshold: number
  owners: readonly string[]
  modules: readonly string[]
}

type WorkspaceVaults = {
  workspaceId: string
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
  chain: ChainId
}

type ConstellationInternalOpts<C extends CodegenData> = {
  codegen?: C
}

type NodeRef = Readonly<Record<string, any>>

// Extract vault entries for a specific workspace
type WorkspaceVaultEntries<
  C extends CodegenData,
  W extends keyof C['vaults'],
> = C['vaults'][W]['vaults']

type EntityAccessor<
  Type extends string,
  Entries extends Record<string, any>,
> = {
  readonly [K in keyof Entries & string]: <
    O extends Record<string, any> = {},
  >(
    overrides?: O
  ) => Readonly<Entries[K] & O & { type: Type; label: K; __chain: number }>
} & {
  new: <P extends Record<string, any>>(
    props: P
  ) => Readonly<P & { type: Type; __chain: number }>
}

type UserAccessor<Handles extends string> = {
  readonly [K in Handles]: string
}

type ConstellationResult<
  C extends CodegenData,
  W extends keyof C['vaults'] = keyof C['vaults'],
> = {
  safe: EntityAccessor<'SAFE', WorkspaceVaultEntries<C, W>>
  roles: EntityAccessor<'ROLES', WorkspaceVaultEntries<C, W>>
  user: UserAccessor<keyof C['users'] & string>
  _nodes: NodeRef[]
}

function loadCodegen(): CodegenData {
  const require = createRequire(import.meta.url)
  return require('.zodiac-os') as CodegenData
}

export function constellation<
  const C extends CodegenData = GeneratedCodegen,
  const W extends keyof C['vaults'] & string = keyof C['vaults'] & string,
>(
  opts: ConstellationOpts<C> & { workspace: W },
  internal?: ConstellationInternalOpts<C>
): ConstellationResult<C, W> {
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
    const ref = Object.freeze({ ...data, __chain: opts.chain })
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
          const personalSafe = user.personalSafes[opts.chain]
          if (!personalSafe) {
            throw new Error(
              `User ${name} has no personal safe on chain ${opts.chain}`
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
  } as ConstellationResult<C>
}
