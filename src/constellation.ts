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

type CodegenData = {
  users: Readonly<Record<string, User>>
  vaults: Readonly<Record<string, WorkspaceVaults>>
}

type ConstellationOpts = {
  workspace: string
  label: string
  chain: number
  codegen: CodegenData
}

type NodeRef = Readonly<Record<string, any>>

export function constellation(opts: ConstellationOpts) {
  const nodes: NodeRef[] = []

  const vaultsByLabel: Record<string, Vault> = {}
  for (const ws of Object.values(opts.codegen.vaults)) {
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
          const user = opts.codegen.users[name]
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
  }
}
