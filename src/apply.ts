import type { ApplyConstellationPayload, ApplyConstellationResult, ChainId } from '@zodiac-os/api-types'
import type { UUID } from 'crypto'
import type { ApiClient } from './api'

type NodeLike = Readonly<Record<string, any>> & {
  type: string
  label: string
  chain: number
}

/**
 * Resolves node references and applies the constellation specification via the API.
 *
 * Converts `NodeRef` objects to `$ref` strings and serializes bigint values
 * as required by the API.
 *
 * ```ts
 * const eth = constellation({ workspace: 'GG', label: 'my constellation', chain: 1 })
 * const dao = eth.safe['GG DAO']
 * const roles = eth.roles['New Roles']({ nonce: 0n, target: dao, owner: dao, avatar: dao })
 *
 * await apply([dao, roles], {
 *   label: 'my constellation',
 *   chain: 1,
 *   workspaceId: 'ws-id',
 *   api: client,
 * })
 * ```
 */
export async function apply(
  nodes: NodeLike[],
  opts: { label: string; chain: ChainId; workspaceId: UUID; api: ApiClient }
): Promise<ApplyConstellationResult> {
  const specification = nodes.map(
    nodeToSpec
  ) as ApplyConstellationPayload['specification']
  return opts.api.applyConstellation(opts.workspaceId, {
    label: opts.label,
    chain: opts.chain,
    specification,
  })
}

function nodeToSpec(node: NodeLike): Record<string, any> {
  const { id, ...rest } = node as Record<string, any>
  const spec: Record<string, any> = {}

  for (const [key, value] of Object.entries(rest)) {
    spec[key] = resolveValue(value)
  }

  spec.ref = spec.label.toLowerCase()

  if (spec.nonce != null && typeof spec.nonce === 'bigint') {
    spec.nonce = spec.nonce.toString()
  }

  return spec
}

function resolveValue(value: unknown): unknown {
  if (isNodeRef(value)) {
    return `$${value.label.toLowerCase()}`
  }

  if (Array.isArray(value)) {
    return value.map(resolveValue)
  }

  if (typeof value === 'object' && value !== null) {
    const resolved: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveValue(v)
    }
    return resolved
  }

  return value
}

function isNodeRef(value: unknown): value is { type: string; label: string; chain: number } {
  if (typeof value === 'function' || typeof value === 'object') {
    const obj = value as any
    return (
      obj != null &&
      typeof obj.type === 'string' &&
      typeof obj.label === 'string' &&
      typeof obj.chain === 'number'
    )
  }
  return false
}
