import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findProjectRoot } from './projectRoot'

const root = join(
  tmpdir(),
  `zodiac-project-root-test-${Date.now()}-${process.pid}`
)

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('findProjectRoot', () => {
  it('returns the dir itself when it contains a package.json', () => {
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'package.json'), '{}')

    expect(findProjectRoot(root)).toBe(root)
  })

  it('walks up to the nearest ancestor with a package.json', () => {
    const nested = join(root, 'apps', 'web', 'src')
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(root, 'package.json'), '{}')

    expect(findProjectRoot(nested)).toBe(root)
  })

  it('prefers the closest package.json in a monorepo layout', () => {
    const inner = join(root, 'packages', 'inner')
    mkdirSync(join(inner, 'src'), { recursive: true })
    writeFileSync(join(root, 'package.json'), '{}')
    writeFileSync(join(inner, 'package.json'), '{}')

    expect(findProjectRoot(join(inner, 'src'))).toBe(inner)
  })

  it('falls back to the start dir when no package.json exists in any ancestor', () => {
    // Use a non-existent path safely under tmpdir so we won't accidentally
    // walk into a real project's package.json.
    mkdirSync(root, { recursive: true })
    expect(findProjectRoot(root)).toBe(root)
  })
})
