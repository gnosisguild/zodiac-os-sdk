import { InternalApiClient } from '../internalApi'
import * as t from '@babel/types'
import { generate } from '@babel/generator'

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

  console.log(vaultsEnum)
}
