import { ApiClient } from '../src'
import { ListVaultsResult } from '@zodiac-os/api-types'

export class InternalApiClient extends ApiClient {
  listVaults(): Promise<ListVaultsResult> {
    return this.get('vaults')
  }
}
