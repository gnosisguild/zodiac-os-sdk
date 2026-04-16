/// <reference path="./zodiac-os-codegen.d.ts" />
import type { Address, ChainId } from '@zodiac-os/api-types'
import type { AllowanceSpec } from './types'
import type {
  Annotation,
  Permission,
  PermissionSet,
} from 'zodiac-roles-sdk'
import { createRequire } from 'module'
import type * as ZodiacOsCodegen from '.zodiac-os'
import { UUID } from 'crypto'

/**
 * A role definition keyed by role name. Permissions are expanded into
 * `{ targets, annotations }` via `processPermissions` at `apply()` time.
 */
export type RoleDef = {
  members: readonly AddressOrRef[]
  permissions: readonly (
    | Permission
    | PermissionSet
    | Promise<PermissionSet>
  )[]
  annotations?: readonly Annotation[]
}

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

/** A reference to a node used in `owners`, `modules`, `target`, etc. */
type NodeRef = Readonly<{ type: NodeType; label: string; chain: ChainId }>

/** A blockchain address (checksummed or lowercase) or a reference to another
 * node in the constellation. Values are normalized to lowercase before being
 * sent to the API. */
type AddressOrRef = Address | NodeRef

type NodeBase = Readonly<{
  /** Human-readable identifier, unique within the constellation. */
  label: string
  /** Chain the node is deployed on. */
  chain: ChainId
  /** Set for existing nodes from codegen, absent for new nodes. */
  address?: Lowercase<Address>
  /** Deployment nonce — required for new nodes, optional for existing. */
  nonce?: bigint
}>

/** A safe node spec — existing vault ref or new safe with required config. */
export type SafeNode = NodeBase &
  Readonly<{
    /** Discriminator identifying this node as a Safe. */
    type: 'SAFE'
    /** Number of owner signatures required to execute a transaction. */
    threshold: number
    /** Safe owner addresses or node references. */
    owners: readonly (string | NodeRef)[]
    /** Module addresses or node references enabled on the safe. */
    modules?: readonly (string | NodeRef)[]
    /** Whether this safe shall appear as a vault in the workspace. @default false */
    vault?: boolean
  }>

/** A roles modifier node spec — existing vault ref or new roles with modifier config. */
export type RolesNode = NodeBase &
  Readonly<{
    /** Discriminator identifying this node as a Roles modifier. */
    type: 'ROLES'
    /** The safe that this roles modifier controls. */
    target?: AddressOrRef
    /** The account that is allowed to update the configuration of the Roles mod. */
    owner?: AddressOrRef
    /** The account that calls will be executed from. */
    avatar?: AddressOrRef
    /** MultiSend contract addresses for batched transactions. */
    multisend?: readonly Address[]
    /** Role definitions configured on this modifier. */
    roles?: Record<string, RoleDef>
    /** Spending allowances configured on this modifier. */
    allowances?: readonly AllowanceSpec[]
  }>

/** Any complete node that can be passed to `apply()`. */
export type ConstellationNode = SafeNode | RolesNode
export type ConstellationNodeInternal = ConstellationNode & {
  _constellation: ConstellationMeta
}

type NewSafeProps = {
  /** Deployment nonce for CREATE2 address derivation. */
  nonce: bigint
  /** Number of owner signatures required to execute a transaction. */
  threshold: number
  /** Safe owner addresses or node references. */
  owners: readonly AddressOrRef[]
  /** Module addresses or node references to enable on the safe. */
  modules?: readonly AddressOrRef[]
  /** Whether this safe is a workspace vault. @default false */
  vault?: boolean
}

type NewRolesProps = {
  /** Deployment nonce for CREATE2 address derivation. Defaults to `0n` when omitted. */
  nonce?: bigint
  /** The safe that this roles modifier controls. Defaults to the new safe with the same label, when one exists. */
  target?: AddressOrRef
  /** The account that calls will be executed from. Defaults to `target` value */
  avatar?: AddressOrRef
  /** The account that is allowed to update the configuration of the Roles Mod. Defaults to `target` value */
  owner?: AddressOrRef
  /** MultiSend contract addresses for batched transactions. Defaults to `['0x38869bf66a61cf6bdb996a6ae40d5853fd43b526', '0x9641d764fc13c8b624c04430c7356c1c7c8102e2']` */
  multisend?: readonly Address[]
  /** Role definitions to configure on this modifier. */
  roles?: Record<string, RoleDef>
  /** Spending allowances to configure on this modifier. */
  allowances?: readonly AllowanceSpec[]
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
          } & Partial<NP> = {},
        >(
          overrides?: {
            [P in Exclude<keyof Entries[K] & string, 'id' | 'label'>]?: any
          } & Partial<NP> &
            O
        ) => Readonly<
          Prettify<
            Omit<Entries[K], keyof O> &
              O &
              Partial<NP> & { type: Type; label: K; chain: Ch }
          >
        >)
    : Readonly<Prettify<{ type: Type; label: string; chain: Ch }>> &
        ((
          props: NP
        ) => Readonly<Prettify<NP & { type: Type; label: string; chain: Ch }>>)
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

/** @internal */
export type ConstellationMeta = {
  label: string
  chain: ChainId
  workspaceId: UUID
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

  const meta: ConstellationMeta = {
    label: opts.label,
    chain: opts.chain,
    workspaceId: (ws?.workspaceId ?? '') as UUID,
  }

  const newSafes = new Map<string, Readonly<Record<string, any>>>()

  function makeNodeRef(
    data: Record<string, any>
  ): Readonly<Record<string, any>> {
    const ref: Record<string, any> = Object.freeze({
      ...data,
      chain: opts.chain,
      _constellation: meta,
    })
    if (ref.type === 'SAFE' && typeof ref.label === 'string') {
      newSafes.set(ref.label, ref)
    }
    return ref
  }

  function entityAccessor(
    registry: Record<string, Record<string, any>>,
    type: string,
    resolveCanonicalSafe?: (name: string) => Record<string, any> | undefined
  ) {
    const cache = new Map<string, Record<string, any>>()
    return new Proxy({} as Record<string, any>, {
      get(_target: any, name: string) {
        if (typeof name !== 'string') return undefined
        const cached = cache.get(name)
        if (cached) return cached
        const existing = registry[name]
        const fn = (overrides?: Record<string, any>) => {
          const canonicalSafe =
            resolveCanonicalSafe && !overrides?.target
              ? resolveCanonicalSafe(name)
              : undefined
          if (canonicalSafe) {
            return makeNodeRef({
              type,
              nonce: 0n,
              target: canonicalSafe,
              owner: canonicalSafe,
              avatar: canonicalSafe,
              ...overrides,
              label: name,
            })
          }
          return makeNodeRef({
            type,
            ...(existing || {}),
            ...overrides,
            label: name,
          })
        }
        Object.assign(fn, {
          type,
          ...(existing || {}),
          label: name,
          chain: opts.chain,
          _constellation: meta,
        })
        cache.set(name, fn)
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

  const safe = entityAccessor(vaultsByLabel, 'SAFE')
  const roles = entityAccessor(vaultsByLabel, 'ROLES', (name) => {
    const invoked = newSafes.get(name)
    if (invoked) return invoked
    if (name in vaultsByLabel) return safe[name]
    return undefined
  })

  return {
    safe,
    roles,
    user: userAccessor(),
  } as ConstellationResult<C, W, Ch>
}
