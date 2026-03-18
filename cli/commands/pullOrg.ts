import type { ZodiacConfig } from '../config'
import { InternalApiClient } from '../internalApi'
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
      ([k, v]) => `${childPad}${k}: ${toLiteral(v, indent + 1)}`
    )
    return `{\n${props.join(',\n')},\n${pad}}`
  }
  return String(value)
}

export const pullOrg = async (config: ZodiacConfig) => {
  const client = new InternalApiClient({
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
  const vaults = workspaceVaults.map((ws) => ({
    workspaceId: ws.workspaceId,
    workspaceName: ws.workspaceName,
    vaults: ws.vaults.map((vault) => {
      const account = accounts[accountIndex++]
      invariant(
        account.type === 'SAFE',
        `Expected SAFE account for vault ${vault.id}`
      )
      return {
        id: vault.id,
        label: vault.label,
        address: account.address,
        chainId: vault.chainId,
        threshold: account.threshold,
        owners: [...account.owners],
        modules: [...account.modules],
      }
    }),
  }))

  const cwd = process.cwd()
  const typesDir = `${cwd}/.zodiac-os/types`

  mkdirSync(typesDir, { recursive: true })

  const project = new Project({ compilerOptions: { declaration: true } })
  const sourceFile = project.createSourceFile(`${typesDir}/index.ts`, '', {
    overwrite: true,
  })

  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'users',
        initializer: `${toLiteral(users)} as const`,
      },
    ],
  })

  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'vaults',
        initializer: `${toLiteral(vaults)} as const`,
      },
    ],
  })

  await sourceFile.save()
}
