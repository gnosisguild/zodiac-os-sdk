import type {
  ApplyAccountsPayload,
  ApplyAccountsResponse,
  ResolveAccountsPayload,
  ResolveAccountsResponse,
} from 'zodiac-os-api-schema'

interface ApiError {
  error: {
    code: string
    message: string
  }
}

export type Options = {
  workspace: string
  apiKey: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  headers?: Record<string, string>
}

const DEFAULT_BASE_URL = 'https://app.pilot.gnosisguild.org/api/v1'

export class ApiClient {
  private baseUrl: string
  private _fetch: typeof fetch
  private headers: Record<string, string>

  constructor(opts: Options) {
    this.baseUrl =
      (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '') +
      '/' +
      opts.workspace
    this._fetch = opts.fetch ?? fetch
    this.headers = opts.headers ?? {}
  }

  async applyAccounts(payload: ApplyAccountsPayload) {
    const res = await this._fetch(`${this.baseUrl}/apply-accounts`, {
      method: 'POST',
      headers: { ...this.headers, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      await handleApiError(res)
    }

    const json = await res.json()
    return json as ApplyAccountsResponse
  }

  async resolveAccounts(payload: ResolveAccountsPayload) {
    const res = await this._fetch(`${this.baseUrl}/resolve-accounts`, {
      method: 'POST',
      headers: { ...this.headers, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      await handleApiError(res)
    }

    const json = await res.json()
    return json as ResolveAccountsResponse
  }
}

async function handleApiError(response: Response): Promise<never> {
  try {
    const errorData = (await response.json()) as ApiError
    const error = new Error(errorData.error.message)
    ;(error as any).code = errorData.error.code
    ;(error as any).status = response.status
    throw error
  } catch (jsonError) {
    // If JSON parsing fails, try to read as string
    try {
      const text = await response.text()
      throw new Error(`Unexpected error: ${text}`)
    } catch (textError) {
      // If both JSON and text parsing fail, throw a generic error
      throw new Error(
        `Unexpected error: ${response.status} ${response.statusText}`
      )
    }
  }
}
