import { describe, it, expect, mock, spyOn, afterEach } from 'bun:test'
import { readFileSync, rmSync, mkdirSync } from 'fs'
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

mock.module('../../api', () => ({
  ApiClient: class {
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

  it('writes JS and d.ts to node_modules/.zodiac-os/', async () => {
    mkdirSync(tmpDir, { recursive: true })
    spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { pullOrg } = await import('./pullOrg')
    await pullOrg({ apiKey: 'zodiac_test-key' })

    const outDir = join(tmpDir, 'node_modules', '.zodiac-os')

    // package.json is written
    const pkg = JSON.parse(readFileSync(join(outDir, 'package.json'), 'utf-8'))
    expect(pkg.name).toBe('.zodiac-os')
    expect(pkg.type).toBe('module')

    // JS file is written with proper exports
    const js = readFileSync(join(outDir, 'index.js'), 'utf-8')
    expect(js).toContain('export const users')
    expect(js).toContain('export const vaults')
    expect(js).toContain('"Alice Example"')
    expect(js).toContain('Treasury')

    // d.ts file is written
    const dts = readFileSync(join(outDir, 'index.d.ts'), 'utf-8')
    expect(dts).toContain('export declare const users')
    expect(dts).toContain('export declare const vaults')
  })
})
