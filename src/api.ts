import type {
  ApplyConstellationPayload,
  ApplyConstellationResult,
  ResolveConstellationPayload,
  ResolveConstellationResult,
  ApiError as ApiErrorResponse,
} from '@zodiac-os/api-types'

export type Options = {
  workspace: string
  apiKey: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  headers?: Record<string, string>
}

const DEFAULT_BASE_URL = 'https://app.pilot.gnosisguild.org/api/v1'

export class ApiClient {
  private apiKey: string
  private baseUrl: string
  private _fetch: typeof fetch
  private headers: Record<string, string>

  constructor(opts: Options) {
    this.baseUrl =
      (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '') +
      '/workspace/' +
      opts.workspace

    this._fetch = opts.fetch ?? fetch
    this.headers = opts.headers ?? {}
    this.apiKey = opts.apiKey
  }

  private async postJson(endpoint: string, payload: unknown) {
    const res = await this._fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      await handleApiError(res)
    }

    return await res.json()
  }

  /**
   * Applies an accounts specification to Zodiac OS.
   */
  async applyConstellation(
    payload: ApplyConstellationPayload
  ): Promise<ApplyConstellationResult> {
    this.resolveConstellation({
      specification: payload.specification,
      source: payload.source,
    })
    return await this.postJson('constellation/apply', payload)
  }

  /**
   * Resolves an accounts specification to Zodiac OS.
   */
  async resolveConstellation(
    payload: ResolveConstellationPayload
  ): Promise<ResolveConstellationResult> {
    return await this.postJson('constellation/resolve', payload)
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
        typeof details === 'string' ? details : JSON.stringify(details, null, 2)
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
  try {
    const errorData = (await response.json()) as ApiErrorResponse
    throw new ApiRequestError(errorData.error.message, {
      status: response.status,
      statusText: response.statusText,
      details: errorData.error.details,
    })
  } catch (jsonError) {
    // If JSON parsing fails, try to read as string
    try {
      const text = await response.text()
      throw new ApiRequestError(`Unexpected error: ${text}`, {
        status: response.status,
        statusText: response.statusText,
        cause: jsonError,
      })
    } catch (textError) {
      // If both JSON and text parsing fail, throw a generic error
      throw new ApiRequestError(
        `Unexpected error: ${response.status} ${response.statusText}`,
        {
          status: response.status,
          statusText: response.statusText,
          cause: textError,
        }
      )
    }
  }
}
