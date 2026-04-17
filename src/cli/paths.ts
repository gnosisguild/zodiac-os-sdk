import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

/**
 * Resolve the consumer's `node_modules/.zodiac-os/` directory — the shared
 * home for SDK codegen (`pull-org` emits the importable module here,
 * `pull-contracts` writes `allow.d.ts` alongside it).
 *
 * Prefers walking up from this module's own path when the SDK is installed
 * under a real `node_modules`; falls back to `<cwd>/node_modules` when the
 * SDK is being run from source (dev / linked builds).
 */
export function resolveZodiacOsDir(): string {
  const selfPath = fileURLToPath(import.meta.url)
  const match = selfPath.match(/^(.+[/\\]node_modules)[/\\]/)
  const nodeModules = match ? match[1] : join(process.cwd(), 'node_modules')
  return join(nodeModules, '.zodiac-os')
}
