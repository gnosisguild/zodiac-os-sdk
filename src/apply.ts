import type {
  ApplyConstellationPayload,
  ApplyConstellationResult,
} from '@zodiac-os/api-types'
import { invariant } from '@epic-web/invariant'
import { ApiClient } from './api'
import type {
  ConstellationMeta,
  ConstellationNode,
  ConstellationNodeInternal,
} from './constellation'

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
  nodes: ConstellationNode[] | { [key: string]: ConstellationNode },
  opts?: ApplyOpts
): Promise<ApplyConstellationResult[]> {
  const api = opts?.api ?? new ApiClient()
  const refs = deriveRefs(nodes)

  // Group nodes by constellation (multiple constellations can be applied with a single call)
  const groups = new Map<
    string,
    { meta: ConstellationMeta; nodes: ConstellationNodeInternal[] }
  >()

  for (const node of refs.keys()) {
    const meta = node._constellation
    invariant(
      meta,
      `Node "${node.label}" is not associated with a constellation`
    )
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
    const specification = groupNodes.map((n) => nodeToSpec(n, refs))
    const result = await api.applyConstellation(meta.workspaceId, {
      label: meta.label,
      chain: meta.chain,
      specification,
    })
    results.push(result)
  }

  return results
}

function deriveRefs(
  nodes: ConstellationNode[] | { [key: string]: ConstellationNode }
): Map<ConstellationNodeInternal, string> {
  const refs = new Map<ConstellationNodeInternal, string>()

  if (Array.isArray(nodes)) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      invariant(
        isConstellationNode(node),
        `unexpected node input at index: ${i}`
      )
      refs.set(node, `${i}`)
    }
  } else {
    for (const [key, node] of Object.entries(nodes)) {
      invariant(
        isConstellationNode(node),
        `unexpected node input under key: ${key}`
      )
      refs.set(node, key)
    }
  }

  return refs
}

function nodeToSpec(
  node: ConstellationNodeInternal,
  refs: Map<ConstellationNodeInternal, string>
): ApplyConstellationPayload['specification'][number] {
  const { id, _constellation, ...rest } = node as Record<string, any>
  const spec: Record<string, any> = {}

  for (const [key, value] of Object.entries(rest)) {
    spec[key] = resolveRefs(value, refs)
  }

  spec.ref = refs.get(node)
  invariant(spec.ref != null, 'ref not found')

  return stringifyBigints(spec) as ApplyConstellationPayload['specification'][number]
}

function resolveRefs(
  value: unknown,
  refs: Map<ConstellationNodeInternal, string>
): unknown {
  if (isConstellationNode(value)) {
    const ref = refs.get(value)
    invariant(
      ref != null,
      `Node "${value.label}" is referenced not included in the apply() call`
    )
    return `$${ref}`
  }

  if (Array.isArray(value)) {
    return value.map((v) => resolveRefs(v, refs))
  }

  if (typeof value === 'object' && value !== null) {
    const resolved: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveRefs(v, refs)
    }
    return resolved
  }

  return value
}

function stringifyBigints(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.map(stringifyBigints)
  }

  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = stringifyBigints(v)
    }
    return result
  }

  return value
}

function isConstellationNode(
  value: unknown
): value is ConstellationNodeInternal {
  if (typeof value === 'function' || typeof value === 'object') {
    const obj = value as any
    return (
      obj != null &&
      typeof obj.type === 'string' &&
      typeof obj.chain === 'number' &&
      typeof obj._constellation === 'object'
    )
  }
  return false
}
