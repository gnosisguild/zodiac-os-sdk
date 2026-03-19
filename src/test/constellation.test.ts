import { describe, it, expect } from 'bun:test'
import { constellation } from '../constellation'
import * as codegen from './codegen.mock'

const vaultByLabel = (label: string) => {
  for (const ws of Object.values(codegen.vaults)) {
    const v = ws.vaults[label as keyof typeof ws.vaults]
    if (v) return v
  }
  throw new Error(`Vault not found: ${label}`)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('constellation API', () => {
  describe('initialization', () => {
    it('creates a constellation scoped to a chain', () => {
      const eth = constellation(
        { workspace: 'GG', label: 'My Test Constellation', chain: 1 },
        { codegen }
      )
      expect(eth.safe['']).toBeDefined()
      expect(eth.roles).toBeDefined()
      expect(eth.user).toBeDefined()
    })
  })

  describe('existing safe — bracket access', () => {
    function setup() {
      return constellation(
        { workspace: 'w', label: 'l', chain: 1 },
        { codegen }
      )
    }

    it('returns a node ref with existing properties merged with overrides', () => {
      const eth = setup()

      const ggDao = eth.safe['GG DAO']()

      expect(ggDao.label).toBe('GG DAO')
      expect(ggDao.address).toBe(vaultByLabel('GG DAO').address)
      expect(ggDao.threshold).toBe(vaultByLabel('GG DAO').threshold)
      expect(ggDao.type).toBe('SAFE')
    })

    it('returns a node ref without overrides via empty call', () => {
      const eth = setup()

      const treasury = eth.safe['Treasury']()

      expect(treasury.label).toBe('Treasury')
      expect(treasury.address).toBe(vaultByLabel('Treasury').address)
    })

    it('returns a frozen (non-callable) node ref', () => {
      const eth = setup()
      const ggDao = eth.safe['GG DAO']()
      expect(Object.isFrozen(ggDao)).toBe(true)
    })
  })

  describe('new safe — direct call', () => {
    function setup() {
      return constellation(
        { workspace: 'w', label: 'l', chain: 1 },
        { codegen }
      )
    }

    it('creates a new node with all required fields', () => {
      const eth = setup()
      const ggDaoRoles = eth.roles['GG DAO']({})

      const newSafe = eth.safe({
        label: 'New Safe',
        nonce: 0n,
        threshold: 2,
        owners: [
          eth.user['Alice Sample'],
          '0xb8e48df6818d3cbc648b3e8ec248a4f547135f7a',
        ],
        modules: [ggDaoRoles],
      })

      expect(newSafe.label).toBe('New Safe')
      expect(newSafe.nonce).toBe(0n)
      expect(newSafe.threshold).toBe(2)
      expect(newSafe.type).toBe('SAFE')
    })

    it('returns a frozen (non-callable) node ref', () => {
      const eth = setup()
      const newSafe = eth.safe({
        label: 'Brand New',
        nonce: 1n,
        threshold: 1,
        owners: ['0xb8e48df6818d3cbc648b3e8ec248a4f547135f7a'],
        modules: [],
      })
      expect(Object.isFrozen(newSafe)).toBe(true)
    })
  })

  describe('existing roles — bracket access', () => {
    it('returns canonical roles mod with config applied', () => {
      const eth = constellation(
        { workspace: 'w', label: 'l', chain: 1 },
        { codegen }
      )

      const mockRole = {
        members: [
          '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`,
        ],
        permissions: [],
      }

      const ggDaoRoles = eth.roles['GG DAO']({
        roles: { eth_wrapping: mockRole },
      })

      expect(ggDaoRoles.label).toBe('GG DAO')
      expect(ggDaoRoles.type).toBe('ROLES')
      expect(ggDaoRoles.roles).toEqual({ eth_wrapping: mockRole })
    })
  })

  describe('new roles — direct call', () => {
    it('creates a new roles mod with explicit target', () => {
      const eth = constellation(
        { workspace: 'w', label: 'l', chain: 1 },
        { codegen }
      )
      const ggDao = eth.safe['GG DAO']()

      const newRoles = eth.roles({
        nonce: 123n,
        target: ggDao,
      })

      expect(newRoles.type).toBe('ROLES')
      expect(newRoles.nonce).toBe(123n)
      expect(newRoles.target).toBe(ggDao)
    })
  })

  describe('user accessor', () => {
    function setup() {
      return constellation(
        { workspace: 'w', label: 'l', chain: 1 },
        { codegen }
      )
    }

    it('resolves a known user to their address', () => {
      const eth = setup()
      const addr = eth.user['Alice Sample']
      expect(addr).toBe(codegen.users['Alice Sample'].personalSafes[1].address)
    })

    it('throws for unknown users', () => {
      const eth = setup()
      expect(() => (eth.user as any)['unknown@example.com']).toThrow(
        'Unknown user'
      )
    })
  })

  describe('explicit export — no side-effects', () => {
    function setup() {
      return constellation(
        { workspace: 'w', label: 'l', chain: 1 },
        { codegen }
      )
    }

    it('accessing a bracket accessor without calling does NOT create a node', () => {
      const eth = setup()

      expect(eth._nodes).toHaveLength(0)

      // accessing but not calling — no node created
      const _safeAccessor = eth.safe['Treasury']
      expect(eth._nodes).toHaveLength(0)

      // calling materializes the node
      eth.safe['GG DAO']()
      expect(eth._nodes).toHaveLength(1)
    })

    it('each call creates exactly one node', () => {
      const eth = setup()

      eth.safe['GG DAO']()
      expect(eth._nodes).toHaveLength(1)

      eth.roles['GG DAO']({})
      expect(eth._nodes).toHaveLength(2)

      eth.safe({
        label: 'New',
        nonce: 0n,
        threshold: 1,
        owners: [],
        modules: [],
      })
      expect(eth._nodes).toHaveLength(3)
    })

    it('all materialized nodes are in the internal tracking list', () => {
      const eth = setup()

      const ggDao = eth.safe['GG DAO']()
      const ggDaoRoles = eth.roles['GG DAO']({ roles: {} })
      const newSafe = eth.safe({
        label: 'New',
        nonce: 0n,
        threshold: 1,
        owners: [],
        modules: [],
      })

      // simulates: export { ggDao, ggDaoRoles, newSafe }
      for (const node of [ggDao, ggDaoRoles, newSafe]) {
        expect(eth._nodes).toContain(node)
      }
    })
  })

  describe('node references are usable in other nodes', () => {
    function setup() {
      return constellation(
        { workspace: 'w', label: 'l', chain: 1 },
        { codegen }
      )
    }

    it('roles ref can be passed as a module to a safe', () => {
      const eth = setup()

      const ggDaoRoles = eth.roles['GG DAO']({})
      const newSafe = eth.safe({
        label: 'Managed Safe',
        nonce: 0n,
        threshold: 1,
        owners: [eth.user['Alice Sample']],
        modules: [ggDaoRoles],
      })

      expect(newSafe.modules).toContain(ggDaoRoles)
    })

    it('safe ref can be passed as target to a new roles mod', () => {
      const eth = setup()

      const ggDao = eth.safe['GG DAO']()
      const newRoles = eth.roles({
        nonce: 1n,
        target: ggDao,
      })

      expect(newRoles.target).toBe(ggDao)
    })
  })
})
