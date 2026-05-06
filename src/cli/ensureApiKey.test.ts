import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { ensureApiKey } from './ensureApiKey'

const ENV_KEY = 'ZODIAC_API_KEY'

describe('ensureApiKey', () => {
  let originalKey: string | undefined

  beforeEach(() => {
    originalKey = process.env[ENV_KEY]
    delete process.env[ENV_KEY]
  })

  afterEach(() => {
    if (originalKey == null) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = originalKey
    }
  })

  it('does nothing when the env var is already set', async () => {
    process.env[ENV_KEY] = 'zodiac_existing'

    let initCalled = false
    await ensureApiKey({
      init: () => {
        initCalled = true
        return Promise.resolve('zodiac_should-not-be-used')
      },
    })

    expect(initCalled).toBe(false)
    expect(process.env[ENV_KEY]).toBe('zodiac_existing')
  })

  it('runs init and populates the env var when missing', async () => {
    await ensureApiKey({ init: () => Promise.resolve('zodiac_minted') })

    expect(process.env[ENV_KEY]).toBe('zodiac_minted')
  })
})
