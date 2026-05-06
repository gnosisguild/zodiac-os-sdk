import { describe, it, expect, mock, afterEach } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const APP_URL = 'https://app.example.test'

// Capture the URL `open` is called with so we can drive the callback ourselves.
let capturedUrl: string | null = null
mock.module('open', () => ({
  default: (url: string) => {
    capturedUrl = url
    return Promise.resolve()
  },
}))

const tmpDir = join(tmpdir(), `zodiac-init-test-${Date.now()}-${process.pid}`)

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
  capturedUrl = null
})

describe('init', () => {
  it('opens cli-auth, accepts the POSTed key, and writes .env', async () => {
    mkdirSync(tmpDir, { recursive: true })

    const { init } = await import('./init')

    const initPromise = init({ rootDir: tmpDir, appUrl: APP_URL })

    const { callbackUrl, state } = await waitForCapturedUrl()

    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: APP_URL,
      },
      body: JSON.stringify({ key: 'zodiac_test-key-1', state }),
    })
    expect(response.status).toBe(200)

    await initPromise

    const envContents = readFileSync(join(tmpDir, '.env'), 'utf8')
    expect(envContents).toContain('ZODIAC_API_KEY=zodiac_test-key-1')
    expect(envContents).toContain(`ZODIAC_API_URL=${APP_URL}/api/v1`)
  })

  it('rejects callbacks from the wrong origin', async () => {
    mkdirSync(tmpDir, { recursive: true })

    const { init } = await import('./init')
    const initPromise = init({ rootDir: tmpDir, appUrl: APP_URL })

    const { callbackUrl, state } = await waitForCapturedUrl()

    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example.com',
      },
      body: JSON.stringify({ key: 'zodiac_evil-key', state }),
    })
    expect(response.status).toBe(403)

    // Now send a valid one so init can complete.
    await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: APP_URL,
      },
      body: JSON.stringify({ key: 'zodiac_real-key', state }),
    })

    await initPromise
    const envContents = readFileSync(join(tmpDir, '.env'), 'utf8')
    expect(envContents).toContain('ZODIAC_API_KEY=zodiac_real-key')
    expect(envContents).not.toContain('zodiac_evil-key')
  })

  it('rejects callbacks with a wrong state', async () => {
    mkdirSync(tmpDir, { recursive: true })

    const { init } = await import('./init')
    const initPromise = init({ rootDir: tmpDir, appUrl: APP_URL })

    const { callbackUrl, state } = await waitForCapturedUrl()

    const wrongStateResponse = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: APP_URL,
      },
      body: JSON.stringify({ key: 'zodiac_attacker', state: 'wrong-state' }),
    })
    expect(wrongStateResponse.status).toBe(403)

    // The right state still wins.
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: APP_URL },
      body: JSON.stringify({ key: 'zodiac_correct', state }),
    })

    await initPromise
    expect(readFileSync(join(tmpDir, '.env'), 'utf8')).toContain(
      'ZODIAC_API_KEY=zodiac_correct'
    )
  })

  it('preserves other lines in an existing .env when writing the key', async () => {
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(
      join(tmpDir, '.env'),
      'OTHER_VAR=foo\nZODIAC_API_KEY=zodiac_old\nZODIAC_API_URL=https://stale.example/api/v1\nMORE=bar\n',
      'utf8'
    )

    const { init } = await import('./init')
    const initPromise = init({ rootDir: tmpDir, appUrl: APP_URL })

    const { callbackUrl, state } = await waitForCapturedUrl()
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: APP_URL },
      body: JSON.stringify({ key: 'zodiac_new', state }),
    })

    await initPromise

    const envContents = readFileSync(join(tmpDir, '.env'), 'utf8')
    expect(envContents).toContain('OTHER_VAR=foo')
    expect(envContents).toContain('MORE=bar')
    expect(envContents).toContain('ZODIAC_API_KEY=zodiac_new')
    expect(envContents).toContain(`ZODIAC_API_URL=${APP_URL}/api/v1`)
    expect(envContents).not.toContain('zodiac_old')
    expect(envContents).not.toContain('stale.example')
  })

  it('echoes Private Network Access preflight headers when requested', async () => {
    mkdirSync(tmpDir, { recursive: true })

    const { init } = await import('./init')
    const initPromise = init({ rootDir: tmpDir, appUrl: APP_URL })

    const { callbackUrl, state } = await waitForCapturedUrl()

    const preflight = await fetch(callbackUrl, {
      method: 'OPTIONS',
      headers: {
        origin: APP_URL,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
        'access-control-request-private-network': 'true',
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe(APP_URL)
    expect(preflight.headers.get('access-control-allow-private-network')).toBe(
      'true'
    )

    // Complete the flow so init resolves.
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: APP_URL },
      body: JSON.stringify({ key: 'zodiac_done', state }),
    })

    await initPromise
  })
})

const waitForCapturedUrl = async (): Promise<{
  callbackUrl: string
  state: string
}> => {
  for (let i = 0; i < 100 && capturedUrl == null; i++) {
    await new Promise((r) => setTimeout(r, 10))
  }
  if (capturedUrl == null) throw new Error('open was never called')
  const url = new URL(capturedUrl)
  const callbackUrl = url.searchParams.get('callback')
  const state = url.searchParams.get('state')
  if (callbackUrl == null || state == null) {
    throw new Error('captured url missing callback/state')
  }
  return { callbackUrl, state }
}
