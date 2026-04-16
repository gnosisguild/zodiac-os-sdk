import { pathToFileURL } from 'url'
import { resolve } from 'path'

export type Contracts = {
  [chain: string]: ContractsNode
}
export type ContractsNode = `0x${string}` | { [name: string]: ContractsNode }

export interface ZodiacConfig {
  apiKey: `zodiac_${string}`
  /**
   * Contracts the `allow` kit should know about, keyed by chain prefix.
   * Nested objects are allowed for grouping related addresses.
   */
  contracts?: Contracts
  /**
   * Directory where fetched ABIs are stored and read from.
   * Resolved relative to the project root (cwd). Defaults to `./abis`.
   */
  abisDir?: string
}

export const defineConfig = (config: ZodiacConfig): ZodiacConfig => config

const DEFAULT_CONFIG_PATH = 'zodiac.config.ts'

export async function loadConfig(
  configPath: string = DEFAULT_CONFIG_PATH
): Promise<ZodiacConfig> {
  const absolutePath = resolve(process.cwd(), configPath)

  let mod: Record<string, unknown>
  try {
    mod = await import(pathToFileURL(absolutePath).href)
  } catch (error: any) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'ENOENT') {
      throw new Error(`Config file not found: ${absolutePath}`)
    }
    throw error
  }

  const config = (mod.default ?? mod.config) as ZodiacConfig | undefined
  if (!config) {
    throw new Error(
      `Config file must export a default value or a named "config" export: ${absolutePath}`
    )
  }

  if (!config.apiKey) {
    throw new Error(`Config is missing required field "apiKey"`)
  }

  return config
}

export const DEFAULT_ABIS_DIR = 'abis'

export function resolveAbisDir(config: ZodiacConfig): string {
  return resolve(process.cwd(), config.abisDir ?? DEFAULT_ABIS_DIR)
}
