import { describe, it, expect } from 'bun:test'
import { constellation } from '../constellation'
import * as codegen from './codegen.mock'

describe('constellation API', () => {
  describe('initialization', () => {
    it('creates a constellation scoped to a chain', () => {
      const eth = constellation(
        { workspace: 'GG', label: 'My Test Constellation', chain: 1 },
        { codegen }
      )

      expect(eth.safe).toBeDefined()
      expect(eth.roles).toBeDefined()
      expect(eth.user).toBeDefined()
    })
  })

  describe('existing safe — bracket access', () => {
    function setup() {
      return constellation(
        { workspace: 'GG', label: 'l', chain: 1 },
        { codegen }
      )
    }

    it('returns a node ref', () => {
      const eth = setup()
      const treasury = eth.safe['Treasury']
      expect(treasury.label).toBe('Treasury')
      expect(treasury.address).toBe(codegen.vaults.GG.vaults.Treasury.address)
    })

    it('returns a node ref with existing properties merged with overrides', () => {
      const eth = setup()
      const ggDao = eth.safe['GG DAO']({ threshold: 5 })

      expect(ggDao.label).toBe('GG DAO')
      expect(ggDao.address).toBe(codegen.vaults.GG.vaults['GG DAO'].address)
      expect(ggDao.threshold).toBe(5)
      expect(ggDao.type).toBe('SAFE')
    })

    it('returns a frozen (non-callable) node ref when invoked', () => {
      const eth = setup()
      const ggDao = eth.safe['GG DAO']()
      expect(Object.isFrozen(ggDao)).toBe(true)
    })

    it('rejects overriding id, label, or unknown props', () => {
      const eth = setup()
      // @ts-expect-error — id is not overridable
      eth.safe['GG DAO']({ id: 'fake-id' })
      // @ts-expect-error — label is not overridable
      eth.safe['GG DAO']({ label: 'fake-label' })
      // @ts-expect-error — unknown prop is not allowed
      eth.safe['GG DAO']({ unknown: 'this does not exist' })
    })
  })

  describe('new safe — bracket access with new key', () => {
    function setup() {
      return constellation(
        { workspace: 'GG', label: 'l', chain: 1 },
        { codegen }
      )
    }

    it('creates a new node with all required fields', () => {
      const eth = setup()

      const newSafe = eth.safe['New Safe']({
        nonce: 0n,
        threshold: 2,
        owners: [
          eth.user['Alice Sample'],
          '0xb8e48df6818d3cbc648b3e8ec248a4f547135f7a',
        ],
        modules: [eth.roles['GG DAO']],
      })

      expect(newSafe.label).toBe('New Safe')
      expect(newSafe.nonce).toBe(0n)
      expect(newSafe.threshold).toBe(2)
      expect(newSafe.type).toBe('SAFE')
    })

    it('returns a frozen (non-callable) node ref', () => {
      const eth = setup()
      const newSafe = eth.safe['Brand New']({
        nonce: 1n,
        threshold: 1,
        owners: ['0xb8e48df6818d3cbc648b3e8ec248a4f547135f7a'],
        modules: [],
      })
      expect(Object.isFrozen(newSafe)).toBe(true)
    })

    it('rejects new node with missing required props', () => {
      const eth = setup()
      // @ts-expect-error — missing threshold, owners, modules
      eth.safe['Brand New']({ nonce: 0n })
    })
  })

  describe('existing roles — bracket access', () => {
    it('returns canonical roles mod with config applied', () => {
      const eth = constellation(
        { workspace: 'GG', label: 'l', chain: 1 },
        { codegen }
      )

      const ggDaoRoles = eth.roles['GG DAO']

      expect(ggDaoRoles.label).toBe('GG DAO')
      expect(ggDaoRoles.type).toBe('ROLES')
    })
  })

  describe('new roles — bracket access with new key', () => {
    it('creates a new roles mod with explicit target', () => {
      const eth = constellation(
        { workspace: 'GG', label: 'l', chain: 1 },
        { codegen }
      )
      const ggDao = eth.safe['GG DAO']

      const newRoles = eth.roles['New Roles']({
        nonce: 123n,
        owner: ggDao,
        target: ggDao,
        avatar: ggDao,
      })

      expect(newRoles.type).toBe('ROLES')
      expect(newRoles.nonce).toBe(123n)
      expect(newRoles.target).toBe(ggDao)
    })

    it('defaults target/owner/avatar to the new safe with the same label', () => {
      const eth = constellation(
        { workspace: 'GG', label: 'l', chain: 1 },
        { codegen }
      )

      const safe = eth.safe['New Safe']({
        nonce: 0n,
        threshold: 1,
        owners: [eth.user['Alice Sample']],
      })
      const roles = eth.roles['New Safe']({
        roles: [],
      })

      expect(roles.target).toBe(safe)
      expect(roles.owner).toBe(safe)
      expect(roles.avatar).toBe(safe)
    })

    it('defaults target/owner/avatar to the existing safe with the same label', () => {
      const eth = constellation(
        { workspace: 'GG', label: 'l', chain: 1 },
        { codegen }
      )

      const roles = eth.roles['GG DAO']({
        roles: [],
      })

      expect(roles.target).toBe(eth.safe['GG DAO'])
      expect(roles.owner).toBe(eth.safe['GG DAO'])
      expect(roles.avatar).toBe(eth.safe['GG DAO'])
    })
  })

  describe('user accessor', () => {
    function setup() {
      return constellation(
        { workspace: 'GG', label: 'l', chain: 1 },
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
      // @ts-expect-error static check already warns
      expect(() => eth.user['Does not exist']).toThrow('Unknown user')
    })
  })

  describe('node references are usable in other nodes', () => {
    function setup() {
      return constellation(
        { workspace: 'GG', label: 'l', chain: 1 },
        { codegen }
      )
    }

    it('roles ref can be passed as a module to a safe', () => {
      const eth = setup()

      const ggDaoRoles = eth.roles['GG DAO']
      const newSafe = eth.safe['Managed Safe']({
        nonce: 0n,
        threshold: 1,
        owners: [eth.user['Alice Sample']],
        modules: [ggDaoRoles],
      })

      expect(newSafe.modules).toContain(ggDaoRoles)
    })

    it('safe ref can be passed as target to a new roles mod', () => {
      const eth = setup()

      const ggDao = eth.safe['GG DAO']
      const newRoles = eth.roles['New Roles']({
        nonce: 1n,
        owner: ggDao,
        target: ggDao,
        avatar: ggDao,
      })

      expect(newRoles.target).toBe(ggDao)
    })

    it('supports circular refs between new nodes', () => {
      const eth = setup()

      const safe = eth.safe['New Safe']({
        nonce: 0n,
        threshold: 1,
        owners: [eth.user['Alice Sample']],
        modules: [eth.roles['New Roles']],
        vault: true,
      })
      const roles = eth.roles['New Roles']({
        nonce: 0n,
        target: safe,
      })

      expect(roles.target).toBe(safe)
      expect(safe.modules).toContain(eth.roles['New Roles'])
    })
  })

  describe('workspace scoping', () => {
    it('only exposes vaults from the selected workspace', () => {
      const gg = constellation(
        { workspace: 'GG', label: 'l', chain: 1 },
        { codegen }
      )

      // GG workspace vaults are accessible
      const treasury = gg.safe['Treasury']
      expect(treasury.label).toBe('Treasury')

      const ggDao = gg.safe['GG DAO']
      expect(ggDao.label).toBe('GG DAO')

      // Ops Fund is NOT in the GG workspace — accessing it returns a node
      // without any pre-filled properties from codegen
      const opsFund = gg.safe['Ops Fund']
      // @ts-expect-error
      expect(opsFund.address).toBeUndefined()
    })

    it('roles accessor is also scoped to the workspace', () => {
      const gg = constellation(
        { workspace: 'GG', label: 'l', chain: 1 },
        { codegen }
      )

      const roles = gg.roles['GG DAO']
      expect(roles.label).toBe('GG DAO')
      expect(roles.type).toBe('ROLES')

      // Ops Fund roles should have no codegen data
      const opsFundRoles = gg.roles['Ops Fund']
      // @ts-expect-error
      expect(opsFundRoles.address).toBeUndefined()
    })
  })
})
