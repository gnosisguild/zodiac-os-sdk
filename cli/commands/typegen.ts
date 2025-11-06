import { InternalApiClient } from '../internalApi'
import * as t from '@babel/types'
import { generate } from '@babel/generator'
import { mkdirSync, writeFileSync } from 'fs'

export const typegen = async () => {
  const client = new InternalApiClient()

  const vaults = await client.listVaults()

  const vaultsEnum = generate(
    t.exportNamedDeclaration(
      t.enumDeclaration(
        t.identifier('Vault'),
        t.enumStringBody(
          vaults.map((vault) =>
            t.enumStringMember(
              t.identifier(vault.label.replaceAll(/ /g, '_')),
              t.stringLiteral(vault.id)
            )
          )
        )
      )
    )
  )

  const cwd = process.cwd()

  mkdirSync(`${cwd}/.zodiac-os/types`, { recursive: true })
  writeFileSync(`${cwd}/.zodiac-os/types/index.ts`, vaultsEnum.code)
}
