import type { ZodiacConfig } from '../config'
import { ApiClient } from '../../api'
import { invariant } from '@epic-web/invariant'
import { Project, VariableDeclarationKind } from 'ts-morph'
import { mkdirSync } from 'fs'

const toLiteral = (value: unknown, indent = 0): string => {
  const pad = '  '.repeat(indent)
  const childPad = '  '.repeat(indent + 1)

  if (value === null) return 'null'
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `[\n${value.map((v) => `${childPad}${toLiteral(v, indent + 1)}`).join(',\n')},\n${pad}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    const props = entries.map(
      ([k, v]) =>
        `${childPad}${/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k)}: ${toLiteral(v, indent + 1)}`
    )
    return `{\n${props.join(',\n')},\n${pad}}`
  }
  return String(value)
}

export const pullOrg = async (config: ZodiacConfig) => {
  const client = new ApiClient({
    apiKey: config.apiKey,
  })

  const [users, workspaceVaults] = await Promise.all([
    client.listUsers(),
    client.listVaults(),
  ])

  const allRawVaults = workspaceVaults.flatMap((ws) => ws.vaults)

  const { result: accounts } = await client.resolveConstellation(
    workspaceVaults[0].workspaceId, // can just use any workspace to resolve
    {
      specification: allRawVaults.map((vault) => ({
        type: 'SAFE',
        chain: vault.chainId,
        address: vault.address,
      })),
    }
  )

  let accountIndex = 0
  const vaultsRecord: Record<string, unknown> = {}
  for (const ws of workspaceVaults) {
    const wsVaults: Record<string, unknown> = {}
    for (const vault of ws.vaults) {
      const account = accounts[accountIndex++]
      invariant(
        account.type === 'SAFE',
        `Expected SAFE account for vault ${vault.id}`
      )
      wsVaults[vault.label] = {
        id: vault.id,
        label: vault.label,
        address: account.address,
        chainId: vault.chainId,
        threshold: account.threshold,
        owners: [...account.owners],
        modules: [...account.modules],
      }
    }
    vaultsRecord[ws.workspaceName] = {
      workspaceId: ws.workspaceId,
      workspaceName: ws.workspaceName,
      vaults: wsVaults,
    }
  }

  const cwd = process.cwd()
  const typesDir = `${cwd}/.zodiac-os/types`

  mkdirSync(typesDir, { recursive: true })

  const project = new Project({ compilerOptions: { declaration: true } })
  const sourceFile = project.createSourceFile(`${typesDir}/index.ts`, '', {
    overwrite: true,
  })

  const nameCount = new Map<string, number>()
  for (const user of users) {
    nameCount.set(user.fullName, (nameCount.get(user.fullName) ?? 0) + 1)
  }

  const usersRecord: Record<string, unknown> = {}
  for (const user of users) {
    const handle =
      nameCount.get(user.fullName)! > 1
        ? `${user.fullName} (${user.id})`
        : user.fullName
    usersRecord[handle] = {
      id: user.id,
      fullName: user.fullName,
      personalSafes: user.personalSafes,
    }
  }

  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'users',
        initializer: `${toLiteral(usersRecord)} as const`,
      },
    ],
  })

  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'vaults',
        initializer: `${toLiteral(vaultsRecord)} as const`,
      },
    ],
  })

  await sourceFile.save()
}
