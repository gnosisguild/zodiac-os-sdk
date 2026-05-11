import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from './config'

const ENV_KEY = 'ZODIAC_API_KEY'

let tmpDir: string
let originalEnv: string | undefined
let originalCwd: string

beforeEach(() => {
  tmpDir = join(tmpdir(), `zodiac-config-test-${Date.now()}-${Math.random()}`)
  mkdirSync(tmpDir, { recursive: true })
  originalEnv = process.env[ENV_KEY]
  delete process.env[ENV_KEY]
  originalCwd = process.cwd()
  process.chdir(tmpDir)
})

afterEach(() => {
  process.chdir(originalCwd)
  rmSync(tmpDir, { recursive: true, force: true })
  if (originalEnv == null) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = originalEnv
  }
})

const writeConfig = (body: string) => {
  writeFileSync(
    join(tmpDir, 'zodiac.config.ts'),
    `export default ${body}\n`,
    'utf8'
  )
}

describe('loadConfig', () => {
  it('uses ZODIAC_API_KEY from the environment when config omits apiKey', async () => {
    process.env[ENV_KEY] = 'zodiac_from-env'
    writeConfig('{}')

    const config = await loadConfig('zodiac.config.ts')

    expect(config.apiKey).toBe('zodiac_from-env')
  })

  it('prefers an explicit apiKey in the config over the env var', async () => {
    process.env[ENV_KEY] = 'zodiac_from-env'
    writeConfig(`{ apiKey: 'zodiac_from-config' }`)

    const config = await loadConfig('zodiac.config.ts')

    expect(config.apiKey).toBe('zodiac_from-config')
  })

  it('throws a helpful error when the env var is set but malformed', async () => {
    process.env[ENV_KEY] = 'not-a-zodiac-key'
    writeConfig('{}')

    await expect(loadConfig('zodiac.config.ts')).rejects.toThrow(
      /ZODIAC_API_KEY is set but malformed/
    )
  })

  it('throws a helpful error when the config apiKey is malformed', async () => {
    writeConfig(`{ apiKey: 'oops' }`)

    await expect(loadConfig('zodiac.config.ts')).rejects.toThrow(
      /apiKey.*malformed/
    )
  })

  it('throws a "run zodiac init" hint when neither source has a key', async () => {
    writeConfig('{}')

    await expect(loadConfig('zodiac.config.ts')).rejects.toThrow(
      /No Zodiac API key found.*zodiac init/
    )
  })

  it('invokes onMissingKey when no key is set, and uses the returned key', async () => {
    writeConfig('{}')

    const config = await loadConfig('zodiac.config.ts', {
      onMissingKey: async () => 'zodiac_minted',
    })

    expect(config.apiKey).toBe('zodiac_minted')
  })

  it('rejects an onMissingKey return value that is not a valid api key', async () => {
    writeConfig('{}')

    await expect(
      loadConfig('zodiac.config.ts', {
        onMissingKey: async () => 'definitely-not-a-key',
      })
    ).rejects.toThrow(/onMissingKey returned an invalid/)
  })
})
