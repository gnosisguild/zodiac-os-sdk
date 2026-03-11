import { InternalApiClient } from '../internalApi'
import { Project, VariableDeclarationKind } from 'ts-morph'
import { mkdirSync } from 'fs'

export const codegen = async () => {
  const client = new InternalApiClient()

  const [users, vaults] = await Promise.all([
    client.listUsers(),
    client.listVaults(),
  ])

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
        initializer: `${JSON.stringify(users, null, 2)} as const`,
      },
    ],
  })

  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'vaults',
        initializer: `${JSON.stringify(vaults, null, 2)} as const`,
      },
    ],
  })

  await sourceFile.save()
}
