import { ApiClient } from '../src'

export class InternalApiClient extends ApiClient {
  listVaults() {
    return this.get('vaults')
  }
}
