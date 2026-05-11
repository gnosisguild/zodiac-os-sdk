import { pathToFileURL } from 'url'
import { dirname, resolve } from 'path'

export type Contracts = {
  [chain: string]: ContractsNode
}
export type ContractsNode = `0x${string}` | { [name: string]: ContractsNode }

export interface ZodiacConfig {
  /**
   * API key authorizing this directory against a Zodiac org.
   *
   * Optional — defaults to `process.env.ZODIAC_API_KEY` (populated by
   * `zodiac init`). Set this explicitly only when you need to override
   * the env var from inside the config file.
   */
  apiKey?: `zodiac_${string}`
  /**
   * Contracts the `allow` kit should know about, keyed by chain prefix.
   * Nested objects are allowed for grouping related addresses.
   */
  contracts?: Contracts
  /**
   * Directory where fetched ABIs are stored and read from.
   * Resolved relative to the project root (config file's directory).
   * Defaults to `./abis`.
   */
  abisDir?: string
}

/** User-provided config plus the resolved API key + project root. */
export interface ResolvedConfig extends Omit<ZodiacConfig, 'apiKey'> {
  apiKey: `zodiac_${string}`
  rootDir: string
}

/**
 * Loose base used as the *inference* constraint for `defineConfig`.
 * `contracts` is `Record<string, unknown>` here so `const T` can preserve the
 * caller's exact address literals rather than collapsing them into the
 * recursive `ContractsNode` union.
 */
type DefineConfigInput = {
  apiKey?: `zodiac_${string}`
  contracts?: Record<string, unknown>
  abisDir?: string
}

/**
 * Recursive leaf-level check: every leaf in `contracts` must be
 * `` `0x${string}` ``; any other value collapses the branch to `never`,
 * which surfaces as a type error at the call site.
 */
type ValidateContracts<C> = {
  [K in keyof C]: C[K] extends `0x${string}`
    ? C[K]
    : C[K] extends object
      ? ValidateContracts<C[K]>
      : never
}

export const defineConfig = <const T extends DefineConfigInput>(
  config: T & {
    contracts?: ValidateContracts<NonNullable<T['contracts']>>
  }
): T => config

const DEFAULT_CONFIG_PATH = 'zodiac.config.ts'

type LoadConfigOptions = {
  /**
   * Called when neither `config.apiKey` nor `process.env.ZODIAC_API_KEY` is
   * set. Receives the resolved project root and must return a freshly minted
   * API key. Typically wired to the interactive `init()` flow.
   *
   * If omitted, `loadConfig` throws when no key is found.
   */
  onMissingKey?: (rootDir: string) => Promise<string>
}

export async function loadConfig(
  configPath: string = DEFAULT_CONFIG_PATH,
  options: LoadConfigOptions = {}
): Promise<ResolvedConfig> {
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

  const rootDir = dirname(absolutePath)
  const apiKey = await resolveApiKey(config, rootDir, options)

  return { ...config, apiKey, rootDir }
}

const resolveApiKey = async (
  config: ZodiacConfig,
  rootDir: string,
  { onMissingKey }: LoadConfigOptions
): Promise<`zodiac_${string}`> => {
  if (config.apiKey != null) {
    if (!isApiKey(config.apiKey)) {
      throw new Error(
        '`apiKey` in zodiac.config.ts is malformed: a valid Zodiac API key starts with "zodiac_". Either remove the field to use ZODIAC_API_KEY, or run `zodiac init` to mint a fresh key.'
      )
    }
    return config.apiKey
  }

  const fromEnv = process.env.ZODIAC_API_KEY
  if (fromEnv != null && fromEnv !== '') {
    if (!isApiKey(fromEnv)) {
      throw new Error(
        'ZODIAC_API_KEY is set but malformed: a valid Zodiac API key starts with "zodiac_". Run `zodiac init` to mint a fresh key.'
      )
    }
    return fromEnv
  }

  if (onMissingKey == null) {
    throw new Error(
      'No Zodiac API key found. Set ZODIAC_API_KEY in your environment, or run `zodiac init` to generate one.'
    )
  }

  const minted = await onMissingKey(rootDir)
  if (!isApiKey(minted)) {
    throw new Error(
      `onMissingKey returned an invalid Zodiac API key (expected a value starting with "zodiac_").`
    )
  }
  return minted
}

const isApiKey = (value: string | undefined): value is `zodiac_${string}` =>
  value != null && value.startsWith('zodiac_')

export const DEFAULT_ABIS_DIR = 'abis'

export function resolveAbisDir(config: ResolvedConfig): string {
  return resolve(config.rootDir, config.abisDir ?? DEFAULT_ABIS_DIR)
}
