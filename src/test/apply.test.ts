import { describe, it, expect, mock } from 'bun:test'
import { apply } from '../apply'
import { constellation } from '../constellation'
import * as codegen from './codegen.mock'

function mockApi() {
  const mockApply = mock(() => Promise.resolve({ ok: true }))
  const api = { applyConstellation: mockApply } as any
  const lastPayload = () => (mockApply.mock.calls[0] as any)[1] as any
  return { api, lastPayload }
}

const wsId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' as any

describe('apply', () => {
  function setup() {
    return constellation(
      { workspace: 'GG', label: 'test', chainId: 1 },
      { codegen }
    )
  }

  it('resolves node refs to $label strings', async () => {
    const eth = setup()
    const dao = eth.safe['GG DAO']
    const roles = eth.roles['New Roles']({
      nonce: 0n,
      target: dao,
      owner: dao,
      avatar: dao,
    })

    const { api, lastPayload } = mockApi()
    await apply([roles], { label: 'test', chainId: 1, workspaceId: wsId, api })

    const spec = lastPayload().specification[0]
    expect(spec.target).toBe('$gg dao')
    expect(spec.owner).toBe('$gg dao')
    expect(spec.avatar).toBe('$gg dao')
  })

  it('maps chainId to chain in the spec', async () => {
    const eth = setup()
    const dao = eth.safe['GG DAO']

    const { api, lastPayload } = mockApi()
    await apply([dao], { label: 'test', chainId: 1, workspaceId: wsId, api })

    const spec = lastPayload().specification[0]
    expect(spec.chain).toBe(1)
    expect(spec.chainId).toBeUndefined()
  })

  it('sets ref from label lowercased', async () => {
    const eth = setup()
    const dao = eth.safe['GG DAO']

    const { api, lastPayload } = mockApi()
    await apply([dao], { label: 'test', chainId: 1, workspaceId: wsId, api })

    const spec = lastPayload().specification[0]
    expect(spec.ref).toBe('gg dao')
    expect(spec.label).toBe('GG DAO')
  })

  it('converts bigint nonce to string', async () => {
    const eth = setup()
    const newSafe = eth.safe['New Safe']({
      nonce: 42n,
      threshold: 1,
      owners: [],
      modules: [],
    })

    const { api, lastPayload } = mockApi()
    await apply([newSafe], { label: 'test', chainId: 1, workspaceId: wsId, api })

    const spec = lastPayload().specification[0]
    expect(spec.nonce).toBe('42')
  })

  it('resolves refs in owners and modules arrays', async () => {
    const eth = setup()
    const dao = eth.safe['GG DAO']
    const roles = eth.roles['GG DAO']

    const newSafe = eth.safe['New Safe']({
      nonce: 0n,
      threshold: 2,
      owners: [eth.user['Alice Sample'], dao],
      modules: [roles],
    })

    const { api, lastPayload } = mockApi()
    await apply([newSafe], { label: 'test', chainId: 1, workspaceId: wsId, api })

    const spec = lastPayload().specification[0]
    expect(spec.owners).toEqual([
      codegen.users['Alice Sample'].personalSafes[1].address,
      '$gg dao',
    ])
    expect(spec.modules).toEqual(['$gg dao'])
  })

  it('strips id from codegen vault data', async () => {
    const eth = setup()
    const dao = eth.safe['GG DAO']

    const { api, lastPayload } = mockApi()
    await apply([dao], { label: 'test', chainId: 1, workspaceId: wsId, api })

    const spec = lastPayload().specification[0]
    expect(spec.id).toBeUndefined()
  })

  it('passes label and chainId at the payload level', async () => {
    const eth = setup()
    const dao = eth.safe['GG DAO']

    const { api, lastPayload } = mockApi()
    await apply([dao], { label: 'my constellation', chainId: 1, workspaceId: wsId, api })

    const payload = lastPayload()
    expect(payload.label).toBe('my constellation')
    expect(payload.chainId).toBe(1)
  })
})
