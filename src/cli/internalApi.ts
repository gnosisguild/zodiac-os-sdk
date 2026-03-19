import { ApiClient } from '..'
import { ListVaultsResult, ListUsersResult } from '@zodiac-os/api-types'

export class InternalApiClient extends ApiClient {
  listVaults(): Promise<ListVaultsResult> {
    return this.get('vaults')
  }
  listUsers(): Promise<ListUsersResult> {
    return this.get('users')
  }
}
