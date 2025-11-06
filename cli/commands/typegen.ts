import { InternalApiClient } from '../internalApi'

export const typegen = async () => {
  const client = new InternalApiClient()

  const vaults = await client.listVaults()
}
