import { Allowance, Annotation, Target } from 'zodiac-roles-sdk'
import { chains } from './chains'

export type LowercaseAddresses<T> = T extends Address
  ? Lowercase<Address>
  : T extends (infer U)[]
    ? LowercaseAddresses<U>[]
    : T extends Record<string, any>
      ? { [K in keyof T]: LowercaseAddresses<T[K]> }
      : T

type Prettify<T> = { [K in keyof T]: T[K] } & {}

type PartialWithMaps<T> = {
  [K in keyof T]?: K extends 'roles' | 'allowances'
    ? T[K] extends (infer U)[]
      ? T[K] | Record<string, U | null>
      : T[K]
    : T[K]
}

type ResolveRefs<T> = T extends AddressOrRef
  ? Address
  : T extends (infer U)[]
    ? ResolveRefs<U>[]
    : T extends Record<string, any>
      ? { [K in keyof T]: ResolveRefs<T[K]> }
      : T

export type Chain = (typeof chains)[number]['shortName']

export type Address = `0x${string}`
export type PrefixedAddress = `${Chain}:${Address}` | `eoa:${Address}`

type Ref = `$${Lowercase<string>}`
export type AddressOrRef = Address | Ref

interface ModifierConfig {
  owner: AddressOrRef
  target: AddressOrRef
  avatar: AddressOrRef
}

interface RoleWithRef {
  key: `0x${string}`
  members: AddressOrRef[]
  targets: Target[]
  annotations: Annotation[]
}

type RolesConfig = ModifierConfig

type RolesFields = {
  /**
   * Defaults to `['0x9641d764fc13c8b624c04430c7356c1c7c8102e2', '0x38869bf66a61cf6bdb996a6ae40d5853fd43b526']`
   **/
  multisend: Address[]
  /**
   * Complete array replaces all roles, partial object merges with existing roles
   */
  roles: RoleWithRef[]
  /**
   * Complete array replaces all allowances, partial object merges with existing allowances
   */
  allowances: Allowance[]
}

type DelayConfig = ModifierConfig & {
  cooldown: bigint
  expiration: bigint
}

type DelayFields = {
  modules: AddressOrRef[]
}

type SafeConfig = {
  threshold: number
  owners: AddressOrRef[]
  modules: AddressOrRef[]
}

interface UpdateAccountBase {
  chain: Chain
  address: Address
  ref?: Lowercase<string>
}

interface NewAccountBase {
  chain: Chain
  address?: Address
  ref?: Lowercase<string>
  nonce: bigint
}

interface ExistingAccountBase {
  chain: Chain
  address: Address
  ref?: Lowercase<string>
  nonce?: bigint
}

type UpdateRoles = { type: 'ROLES' } & UpdateAccountBase &
  PartialWithMaps<RolesConfig & RolesFields>
type NewRoles = { type: 'ROLES' } & NewAccountBase &
  RolesConfig &
  PartialWithMaps<RolesFields>
type Roles = { type: 'ROLES' } & ExistingAccountBase & RolesConfig & RolesFields

type UpdateDelay = { type: 'DELAY' } & UpdateAccountBase &
  Partial<DelayConfig & DelayFields>
type NewDelay = { type: 'DELAY' } & NewAccountBase &
  DelayConfig &
  Partial<DelayFields>
type Delay = { type: 'DELAY' } & ExistingAccountBase & DelayConfig & DelayFields

type UpdateSafe = { type: 'SAFE' } & UpdateAccountBase & Partial<SafeConfig>
type NewSafe = { type: 'SAFE' } & NewAccountBase & SafeConfig
type Safe = { type: 'SAFE' } & ExistingAccountBase & SafeConfig

export type UpdateAccount = UpdateSafe | UpdateRoles | UpdateDelay
export type NewAccount = NewSafe | NewRoles | NewDelay
export type AccountUpdateOrCreate = Prettify<UpdateAccount | NewAccount>

export type Account = Prettify<
  LowercaseAddresses<ResolveRefs<Delay | Roles | Safe>>
>
