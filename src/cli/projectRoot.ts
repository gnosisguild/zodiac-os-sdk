import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * Walk up from `startDir` looking for a `package.json`. Returns the
 * directory that contains it. Falls back to `startDir` if no ancestor
 * has a `package.json` (e.g. when running outside any project).
 */
export const findProjectRoot = (startDir: string = process.cwd()): string => {
  const absoluteStart = resolve(startDir)
  let dir = absoluteStart

  while (true) {
    if (existsSync(resolve(dir, 'package.json'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return absoluteStart
    }
    dir = parent
  }
}
