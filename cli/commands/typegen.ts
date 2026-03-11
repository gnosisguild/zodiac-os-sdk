import { InternalApiClient } from '../internalApi'
import { Project } from 'ts-morph'
import { mkdirSync } from 'fs'

export const typegen = async () => {
  const client = new InternalApiClient()

  const vaults = await client.listVaults()

  const cwd = process.cwd()
  const typesDir = `${cwd}/.zodiac-os/types`

  mkdirSync(typesDir, { recursive: true })

  const project = new Project({ compilerOptions: { declaration: true } })
  const sourceFile = project.createSourceFile(`${typesDir}/index.ts`, '', {
    overwrite: true,
  })

  sourceFile.addEnum({
    isExported: true,
    name: 'Vault',
    members: vaults.map((vault) => ({
      name: vault.label,
      value: vault.id,
    })),
  })

  await sourceFile.save()
}
