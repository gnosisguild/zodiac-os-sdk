import { describe, it, expect, mock, spyOn, afterEach } from 'bun:test'
import { readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const mockUsers = [
  {
    id: 'user-1',
    fullName: 'Alice Example',
    personalSafes: {},
  },
  {
    id: 'user-2',
    fullName: 'Bob Example',
    personalSafes: {},
  },
]

const mockVaults = [
  {
    id: 'vault-1',
    label: 'Treasury',
    chainId: 1,
    address: '0x1234567890abcdef1234567890abcdef12345678',
  },
]

mock.module('../internalApi', () => ({
  InternalApiClient: class {
    listUsers() {
      return Promise.resolve(mockUsers)
    }
    listVaults() {
      return Promise.resolve(mockVaults)
    }
  },
}))

describe('codegen', () => {
  const tmpDir = join(tmpdir(), `zodiac-os-codegen-test-${Date.now()}`)

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes users and vaults as named exports with as const', async () => {
    spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { codegen } = await import('./codegen')
    await codegen()

    const output = readFileSync(
      join(tmpDir, '.zodiac-os', 'types', 'index.ts'),
      'utf-8'
    )

    expect(output).toBe(
      `export const users = [
      {
        "id": "user-1",
        "fullName": "Alice Example",
        "personalSafes": {}
      },
      {
        "id": "user-2",
        "fullName": "Bob Example",
        "personalSafes": {}
      }
    ] as const;
export const vaults = [
      {
        "id": "vault-1",
        "label": "Treasury",
        "chainId": 1,
        "address": "0x1234567890abcdef1234567890abcdef12345678"
      }
    ] as const;
`
    )
  })
})
