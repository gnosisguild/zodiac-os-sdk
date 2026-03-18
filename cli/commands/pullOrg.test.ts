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
    workspaceId: 'ws-1',
    workspaceName: 'Test Workspace',
    vaults: [
      {
        id: 'vault-1',
        label: 'Treasury',
        chainId: 1,
        address: '0xaaaa00000000000000000000000000000000aaaa',
        canonicalRolesAddress: '0x0000000000000000000000000000000000000000',
      },
    ],
  },
]

const mockResolvedSafe = {
  type: 'SAFE',
  chain: 1,
  address: '0xaaaa00000000000000000000000000000000aaaa',
  threshold: 3,
  owners: [
    '0xbbbb00000000000000000000000000000000bbbb',
    '0xcccc00000000000000000000000000000000cccc',
    '0xdddd00000000000000000000000000000000dddd',
  ],
  modules: [],
}

mock.module('../internalApi', () => ({
  InternalApiClient: class {
    listUsers() {
      return Promise.resolve(mockUsers)
    }
    listVaults() {
      return Promise.resolve(mockVaults)
    }
    resolveConstellation() {
      return Promise.resolve({ result: [mockResolvedSafe] })
    }
  },
}))

describe('pullOrg', () => {
  const tmpDir = join(tmpdir(), `zodiac-os-codegen-test-${Date.now()}`)

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes users and vaults as named exports with as const', async () => {
    spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { pullOrg } = await import('./pullOrg')
    await pullOrg({ apiKey: 'zodiac_test-key' })

    const output = readFileSync(
      join(tmpDir, '.zodiac-os', 'types', 'index.ts'),
      'utf-8'
    )

    expect(output).toBe(
      `export const users = [
      {
        id: "user-1",
        fullName: "Alice Example",
        personalSafes: {},
      },
      {
        id: "user-2",
        fullName: "Bob Example",
        personalSafes: {},
      },
    ] as const;
export const vaults = [
      {
        workspaceId: "ws-1",
        workspaceName: "Test Workspace",
        vaults: [
          {
            id: "vault-1",
            label: "Treasury",
            address: "0xaaaa00000000000000000000000000000000aaaa",
            chainId: 1,
            threshold: 3,
            owners: [
              "0xbbbb00000000000000000000000000000000bbbb",
              "0xcccc00000000000000000000000000000000cccc",
              "0xdddd00000000000000000000000000000000dddd",
            ],
            modules: [],
          },
        ],
      },
    ] as const;
`
    )
  })
})
