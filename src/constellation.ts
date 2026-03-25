/// <reference path="./zodiac-os-codegen.d.ts" />
import { Address, ChainId } from '@zodiac-os/api-types'
import { createRequire } from 'module'
import type * as ZodiacOsCodegen from '.zodiac-os'
import { UUID } from 'crypto'

type User = {
  id: UUID
  fullName: string
  personalSafes: Record<
    number,
    { address: Lowercase<Address>; active: boolean }
  >
}

type Vault = {
  id: UUID
  label: string
  address: Lowercase<Address>
  chain: ChainId
  threshold: number
  owners: readonly string[]
  modules: readonly string[]
}

type WorkspaceVaults = {
  workspaceId: UUID
  workspaceName: string
  vaults: Readonly<Record<string, Vault>>
}

/** Shape of the codegen data produced by `zodiac-os pull-org`. */
export type CodegenData = {
  users: Readonly<Record<string, User>>
  vaults: Readonly<Record<string, WorkspaceVaults>>
}

type GeneratedCodegen = {
  users: typeof ZodiacOsCodegen.users
  vaults: typeof ZodiacOsCodegen.vaults
}

type ConstellationOpts<C extends CodegenData> = {
  /** Workspace to scope vaults and roles to. */
  workspace: keyof C['vaults'] & string
  /** Human-readable label for this constellation. */
  label: string
  /** Target chain for all nodes in this constellation. */
  chain: ChainId
}

type ConstellationInternalOpts<C extends CodegenData> = {
  /** Injected codegen data (used for testing). */
  codegen?: C
}

type Prettify<T> = { readonly [K in keyof T]: T[K] } & {}

type WorkspaceVaultEntries<
  C extends CodegenData,
  W extends keyof C['vaults'],
> = C['vaults'][W]['vaults']

type NodeType = 'SAFE' | 'ROLES' | 'DELAY'

/** A frozen reference to a node in the constellation. */
type NodeRef = Readonly<{ type: NodeType; label: string; chain: ChainId }>

/** An blockchain address or a reference to another node in the constellation. */
type AddressOrRef = Lowercase<Address> | NodeRef

type NewSafeProps = {
  /** Deployment nonce for CREATE2 address derivation. */
  nonce: bigint
  /** Number of owner signatures required to execute a transaction. */
  threshold: number
  /** Safe owner addresses or node references. */
  owners: readonly AddressOrRef[]
  /** Module addresses or node references to enable on the safe. */
  modules: readonly AddressOrRef[]
  /** Whether this safe is a workspace vault. @default false */
  vault?: boolean
}

type NewRolesProps = {
  /** Deployment nonce for CREATE2 address derivation. */
  nonce: bigint
  /** The safe that this roles modifier controls. */
  target: AddressOrRef
  /** The account that calls will be executed from. Defaults to `target` value */
  avatar?: AddressOrRef
  /** The account that is allowed to update the configuration of the Roles Mod. Defaults to `target` value */
  owner?: AddressOrRef
  /** MultiSend contract addresses for batched transactions. Defaults to `['0x38869bf66a61cf6bdb996a6ae40d5853fd43b526', '0x9641d764fc13c8b624c04430c7356c1c7c8102e2']` */
  multisend?: readonly Lowercase<Address>[]
  /** Role definitions to configure on this modifier. */
  roles?: readonly Record<string, any>[]
  /** Spending allowances to configure on this modifier. */
  allowances?: readonly Record<string, any>[]
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
    ? Readonly<Prettify<Entries[K] & { type: Type; label: K; chain: Ch }>> &
        (<
          O extends {
            [P in Exclude<keyof Entries[K] & string, 'id' | 'label'>]?: any
          } = {},
        >(
          overrides?: {
            [P in Exclude<keyof Entries[K] & string, 'id' | 'label'>]?: any
          } & O
        ) => Readonly<
          Prettify<
            Omit<Entries[K], keyof O> &
              O & { type: Type; label: K; chain: Ch }
          >
        >)
    : <P extends Record<string, any>>(
        props: NP & { [key: string & {}]: any } & P
      ) => Readonly<Prettify<P & { type: Type; label: string; chain: Ch }>>
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
  /** Access existing safes by label or create new ones with a new label. */
  safe: EntityAccessor<'SAFE', WorkspaceVaultEntries<C, W>, Ch, NewSafeProps>
  /** Access existing roles modifiers by label or create new ones with a new label. */
  roles: EntityAccessor<'ROLES', WorkspaceVaultEntries<C, W>, Ch, NewRolesProps>
  /** Resolve a user's personal safe address on the constellation's chain. */
  user: UserAccessor<C, Ch>
}

function loadCodegen(): CodegenData {
  const require = createRequire(import.meta.url)
  return require('.zodiac-os') as CodegenData
}

/**
 * Creates a constellation scoped to a workspace and chain.
 *
 * Use bracket access to reference existing vaults or define new nodes:
 * ```ts
 * const eth = constellation({ workspace: 'GG', label: 'my constellation', chain: 1 })
 *
 * const dao = eth.safe['GG DAO']              // existing vault ref
 * const roles = eth.roles['GG DAO']           // existing roles ref
 * const newSafe = eth.safe['New Safe']({ nonce: 0n, threshold: 2, owners: [...], modules: [...] })
 * ```
 */
export function constellation<
  const C extends CodegenData = GeneratedCodegen,
  const W extends keyof C['vaults'] & string = keyof C['vaults'] & string,
  const Ch extends ChainId = ChainId,
>(
  opts: ConstellationOpts<C> & { workspace: W; chain: Ch },
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
    return Object.freeze({ ...data, chainId: opts.chain })
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
            chainId: opts.chain,
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
  } as ConstellationResult<C, W, Ch>
}
