import type { ZodiacConfig } from '../config'
import { defineConfig } from '@gnosis-guild/eth-sdk'
import { gatherABIs } from '@gnosis-guild/eth-sdk/dist/abi-management'
import { generateSdk } from '@gnosis-guild/eth-sdk/dist/client'
import { createEthSdkConfig } from '@gnosis-guild/eth-sdk/dist/config/types'
import { realFs } from '@gnosis-guild/eth-sdk/dist/peripherals/fs'

export const pullContracts = async (config: ZodiacConfig) => {
  if (!config.contracts || Object.keys(config.contracts).length === 0) {
    console.log('No contracts defined in config, skipping.')
    return
  }

  const cwd = process.cwd()
  const ethSdkConfig = createEthSdkConfig(
    defineConfig({
      contracts: config.contracts,
    })
  )

  const ctx = {
    cliArgs: { workingDirPath: cwd },
    config: ethSdkConfig,
    fs: realFs,
  }

  console.log('Fetching contract ABIs...')
  await gatherABIs(ctx)

  console.log('Generating typed SDK...')
  await generateSdk(ctx)
}
