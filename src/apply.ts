import type {
  ApplyConstellationPayload,
  ApplyConstellationResult,
} from '@zodiac-os/api-types'
import { ApiClient } from './api'
import type { ConstellationMeta } from './constellation'

type NodeLike = Readonly<Record<string, any>> & {
  type: string
  label: string
  chain: number
}

type ApplyOpts = {
  /** API client instance. Defaults to a client configured from environment variables. */
  api?: ApiClient
}

/**
 * Resolves node references and applies the constellation specification via the API.
 *
 *
 * ```ts
 * const eth = constellation({ workspace: 'GG', label: 'my constellation', chain: 1 })
 * const dao = eth.safe['GG DAO']
 * const roles = eth.roles['New Roles']({ nonce: 0n, target: dao, owner: dao, avatar: dao })
 *
 * await apply([dao, roles])
 * ```
 */
export async function apply(
  nodes: NodeLike[],
  opts?: ApplyOpts
): Promise<ApplyConstellationResult[]> {
  const api = opts?.api ?? new ApiClient()

  // Group nodes by constellation, keyed on concatenated meta values
  const groups = new Map<
    string,
    { meta: ConstellationMeta; nodes: NodeLike[] }
  >()

  for (const node of nodes) {
    const meta = (node as any)._constellation as ConstellationMeta | undefined
    if (!meta) {
      throw new Error(
        `Node "${node.label}" is not associated with a constellation`
      )
    }
    const key = `${meta.workspaceId}:${meta.chain}:${meta.label}`
    let group = groups.get(key)
    if (!group) {
      group = { meta, nodes: [] }
      groups.set(key, group)
    }
    group.nodes.push(node)
  }

  const results: ApplyConstellationResult[] = []
  for (const { meta, nodes: groupNodes } of groups.values()) {
    const specification = groupNodes.map(
      nodeToSpec
    ) as ApplyConstellationPayload['specification']
    const result = await api.applyConstellation(meta.workspaceId as any, {
      label: meta.label,
      chain: meta.chain,
      specification,
    })
    results.push(result)
  }

  return results
}

function nodeToSpec(node: NodeLike): Record<string, any> {
  const { id, _constellation, ...rest } = node as Record<string, any>
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

function isNodeRef(
  value: unknown
): value is { type: string; label: string; chain: number } {
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
