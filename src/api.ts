import type {
  ApplyConstellationPayload,
  ApplyConstellationResult,
  ResolveConstellationPayload,
  ResolveConstellationResult,
  ApiError as ApiErrorResponse,
} from '@zodiac-os/api-types'
import assert from 'assert'

export type Options = {
  workspace?: string
  apiKey?: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  headers?: Record<string, string>
}

const DEFAULT_BASE_URL = 'http://localhost:3040/api/v1'
// const DEFAULT_BASE_URL = 'https://app.pilot.gnosisguild.org/api/v1'

const { ZODIAC_OS_API_KEY, ZODIAC_OS_WORKSPACE } = process.env

export class ApiClient {
  private apiKey: string
  private baseUrl: string
  private _fetch: typeof fetch
  private headers: Record<string, string>

  constructor({
    baseUrl = DEFAULT_BASE_URL,
    workspace = ZODIAC_OS_WORKSPACE,
    fetch: customFetch = fetch,
    headers = {},
    apiKey = ZODIAC_OS_API_KEY,
  }: Options = {}) {
    assert(
      workspace,
      'No workspace provided to the API client. Either pass it as the "workspace" option or set the ZODIAC_OS_WORKSPACE environment variable.'
    )

    this.baseUrl = baseUrl.replace(/\/$/, '') + '/workspace/' + workspace

    this._fetch = customFetch
    this.headers = headers

    assert(
      apiKey,
      'No API key provided to the API client. Either pass it as the "apiKey" option or set the ZODIAC_OS_API_KEY environment variable.'
    )

    this.apiKey = apiKey
  }

  protected async postJson(endpoint: string, payload: unknown) {
    const res = await this._fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: jsonStringify(payload),
    })
    if (!res.ok) {
      await handleApiError(res)
    }

    return res.json()
  }

  protected async get(endpoint: string) {
    const res = await this._fetch(`${this.baseUrl}/${endpoint}`, {
      headers: { ...this.headers, authorization: `Bearer ${this.apiKey}` },
    })

    if (!res.ok) {
      await handleApiError(res)
    }

    return res.json()
  }

  /**
   * Applies an accounts specification to Zodiac OS.
   */
  applyConstellation(
    payload: ApplyConstellationPayload
  ): Promise<ApplyConstellationResult> {
    return this.postJson('constellation/apply', payload)
  }

  /**
   * Resolves an accounts specification to Zodiac OS.
   */
  resolveConstellation(
    payload: ResolveConstellationPayload
  ): Promise<ResolveConstellationResult> {
    return this.postJson('constellation/resolve', payload)
  }
}

export class ApiRequestError extends Error {
  public readonly status: number
  public readonly statusText: string
  public readonly details?: unknown

  constructor(
    message: string,
    opts: {
      status: number
      statusText: string
      details?: unknown
      cause?: unknown
    }
  ) {
    super(ApiRequestError.composeMessage(message, opts.details))
    this.name = 'ApiRequestError'
    this.status = opts.status
    this.statusText = opts.statusText
    this.details = opts.details
    if (opts.cause !== undefined) {
      ;(this as any).cause = opts.cause
    }
  }

  private static composeMessage(message: string, details?: unknown) {
    if (details == null) return message
    let detailsString: string
    try {
      detailsString =
        typeof details === 'string' ? details : jsonStringify(details, 2)
    } catch (_err) {
      detailsString = String(details)
    }
    return `${message}\nDetails: ${detailsString}`
  }

  toString() {
    return `${this.name}: ${this.message}`
  }
}

async function handleApiError(response: Response): Promise<never> {
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    const errorData = (await response.json()) as ApiErrorResponse
    let error: ApiRequestError
    try {
      error = new ApiRequestError(errorData.error.message, {
        status: response.status,
        statusText: response.statusText,
        details: errorData.error.details,
      })
    } catch (jsonShapeError) {
      error = new ApiRequestError(
        `Failed parsing error response: ${jsonShapeError}`,
        {
          status: response.status,
          statusText: response.statusText,
          details: errorData,
        }
      )
    }
    throw error
  } else {
    // Not JSON, read as text directly
    const text = await response.text()
    throw new ApiRequestError(`Unexpected error: ${text}`, {
      status: response.status,
      statusText: response.statusText,
    })
  }
}

/** JSON.stringify with bigint support */
const jsonStringify = (value: unknown, indent?: number) =>
  JSON.stringify(
    value,
    (_, value) => {
      if (typeof value === 'bigint') {
        return value.toString()
      }

      return value
    },
    indent
  )
