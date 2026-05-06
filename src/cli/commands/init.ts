import { randomBytes } from 'node:crypto'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import open from 'open'

const DEFAULT_APP_URL = 'https://app.zodiac.eco'
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

type InitOptions = {
  rootDir?: string
  /** Override the Zodiac app base URL (defaults to ZODIAC_APP_URL env or app.zodiac.eco). */
  appUrl?: string
}

export const init = async (options: InitOptions = {}): Promise<void> => {
  const rootDir = options.rootDir ?? process.cwd()
  const appUrl = (
    options.appUrl ??
    process.env.ZODIAC_APP_URL ??
    DEFAULT_APP_URL
  ).replace(/\/$/, '')

  const label = basename(resolve(rootDir)) || 'zodiac-cli'
  const state = randomBytes(32).toString('base64url')

  const appOrigin = new URL(appUrl).origin

  const { port, waitForKey, close } = await startCallbackServer({
    appOrigin,
    expectedState: state,
  })

  const callbackUrl = `http://127.0.0.1:${port}/callback`
  const authUrl = new URL('/cli-auth', appUrl)
  authUrl.searchParams.set('callback', callbackUrl)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('label', label)

  console.log(
    `Opening ${authUrl} in your browser. Approve the request to receive an API key.`
  )
  await open(authUrl.toString())

  let key: string
  try {
    key = await waitForKey(CALLBACK_TIMEOUT_MS)
  } finally {
    close()
  }

  const envPath = join(rootDir, '.env')
  writeApiKeyToEnv(envPath, key)

  console.log(`✓ API key written to ${envPath}`)
}

type StartServerOptions = {
  appOrigin: string
  expectedState: string
}

type StartServerResult = {
  port: number
  waitForKey: (timeoutMs: number) => Promise<string>
  close: () => void
}

const startCallbackServer = async ({
  appOrigin,
  expectedState,
}: StartServerOptions): Promise<StartServerResult> => {
  let resolveKey: (key: string) => void = () => {}
  let rejectKey: (err: Error) => void = () => {}
  const keyPromise = new Promise<string>((res, rej) => {
    resolveKey = res
    rejectKey = rej
  })

  const handler = (req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin
    const isAllowedOrigin = origin === appOrigin

    // CORS / Private Network Access preflight + actual response headers.
    if (isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', appOrigin)
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'content-type')
      // Required for Chrome's Private Network Access preflight when an
      // HTTPS page targets http://localhost.
      if (req.headers['access-control-request-private-network'] === 'true') {
        res.setHeader('Access-Control-Allow-Private-Network', 'true')
      }
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = isAllowedOrigin ? 204 : 403
      res.end()
      return
    }

    if (req.method !== 'POST' || req.url !== '/callback') {
      res.statusCode = 404
      res.end()
      return
    }

    if (!isAllowedOrigin) {
      res.statusCode = 403
      res.end()
      return
    }

    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (typeof body.state !== 'string' || body.state !== expectedState) {
          // Don't reject — could be a stray request from a malicious local
          // process. Stay silent and keep waiting for the real one.
          res.statusCode = 403
          res.end()
          return
        }
        if (typeof body.key !== 'string' || !body.key.startsWith('zodiac_')) {
          res.statusCode = 400
          res.end()
          return
        }
        res.statusCode = 200
        res.end()
        resolveKey(body.key)
      } catch {
        res.statusCode = 400
        res.end()
      }
    })
  }

  const server = createServer(handler)
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', res))
  const address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('Failed to bind loopback callback server')
  }
  const port = address.port

  const close = () => server.close()

  const waitForKey = (timeoutMs: number) =>
    Promise.race<string>([
      keyPromise,
      new Promise<string>((_, rej) =>
        setTimeout(() => {
          rejectKey(new Error(`Timed out waiting for CLI auth callback`))
          rej(new Error(`Timed out waiting for CLI auth callback`))
        }, timeoutMs)
      ),
    ])

  return { port, waitForKey, close }
}

const ENV_KEY = 'ZODIAC_API_KEY'

const writeApiKeyToEnv = (envPath: string, key: string): void => {
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''

  const line = `${ENV_KEY}=${key}`
  const lines = existing.split(/\r?\n/)
  const idx = lines.findIndex((l) => new RegExp(`^\\s*${ENV_KEY}\\s*=`).test(l))

  let next: string
  if (idx >= 0) {
    lines[idx] = line
    next = lines.join('\n')
  } else {
    next =
      existing.length === 0 || existing.endsWith('\n')
        ? `${existing}${line}\n`
        : `${existing}\n${line}\n`
  }

  writeFileSync(envPath, next, 'utf8')
}
