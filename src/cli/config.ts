import type { EthSdkContracts } from '@gnosis-guild/eth-sdk'
import { pathToFileURL } from 'url'
import { resolve } from 'path'

export interface ZodiacConfig {
  apiKey: `zodiac_${string}`
  contracts?: EthSdkContracts
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
