/// <reference path="./zodiac-os-codegen.d.ts" />
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

type ConstellationOpts = {
  workspace: string
  label: string
  chain: number
}

type ConstellationInternalOpts<C extends CodegenData> = {
  codegen?: C
}

type NodeRef = Readonly<Record<string, any>>

// Extract all vault labels across all workspaces
type AllVaultLabels<C extends CodegenData> = {
  [K in keyof C['vaults']]: keyof C['vaults'][K]['vaults']
}[keyof C['vaults']] &
  string

type EntityAccessor<Labels extends string> = ((
  props: Record<string, any>
) => NodeRef) & {
  readonly [K in Labels]: (overrides?: Record<string, any>) => NodeRef
}

type UserAccessor<Handles extends string> = {
  readonly [K in Handles]: string
}

type ConstellationResult<C extends CodegenData> = {
  safe: EntityAccessor<AllVaultLabels<C>>
  roles: EntityAccessor<AllVaultLabels<C>>
  user: UserAccessor<keyof C['users'] & string>
  _nodes: NodeRef[]
}

function loadCodegen(): CodegenData {
  const require = createRequire(import.meta.url)
  return require('.zodiac-os') as CodegenData
}

export function constellation<const C extends CodegenData = GeneratedCodegen>(
  opts: ConstellationOpts,
  internal?: ConstellationInternalOpts<C>
): ConstellationResult<C> {
  const codegen: CodegenData = internal?.codegen ?? loadCodegen()
  const nodes: NodeRef[] = []

  const vaultsByLabel: Record<string, Vault> = {}
  for (const ws of Object.values(codegen.vaults)) {
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
    return new Proxy(
      function create(props: Record<string, any>) {
        return makeNodeRef({ type, ...props })
      },
      {
        get(_target: any, name: string) {
          if (typeof name !== 'string') return undefined
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
      }
    )
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
