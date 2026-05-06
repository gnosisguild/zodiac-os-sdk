import { init as defaultInit } from './commands/init'

const ENV_KEY = 'ZODIAC_API_KEY'

type EnsureApiKeyOptions = {
  /** Override the init function. Used in tests. */
  init?: () => Promise<string>
}

/**
 * Ensure `ZODIAC_API_KEY` is set in the current process. If missing,
 * runs the interactive init flow to mint a key, persist it to .env,
 * and populate the env var so the calling command can proceed.
 */
export const ensureApiKey = async (
  options: EnsureApiKeyOptions = {}
): Promise<void> => {
  if (process.env[ENV_KEY]) {
    return
  }

  console.log(
    `No ${ENV_KEY} found. Starting authorization to mint one for this directory…`
  )

  const init = options.init ?? defaultInit
  const key = await init()
  process.env[ENV_KEY] = key
}
