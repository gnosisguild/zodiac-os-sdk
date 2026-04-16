import fs from 'node:fs'
import path from 'node:path'
import type { ZodiacConfig } from '../config'
import { resolveAbisDir } from '../config'
import {
  abiFilePath,
  walkContracts,
  writeAbi,
} from '../../allow/abi'
import { fetchAbi } from '../../allow/fetch'
import { chainIdFor } from '../../allow/networks'
import { generateAllowTypes, writeGenerated } from '../../allow/codegen'

type Status = 'ok' | 'fetched' | 'missing'

function resolveGeneratedFile(): string {
  // Write to `<cwd>/.zodiac-os/allow.d.ts` so the generated global
  // `AllowKit` interface is picked up by the user's tsconfig (node_modules
  // files aren't automatically included for global augmentations).
  return path.join(process.cwd(), '.zodiac-os', 'allow.d.ts')
}

export const pullContracts = async (config: ZodiacConfig) => {
  if (!config.contracts || Object.keys(config.contracts).length === 0) {
    console.log('No contracts defined in config, skipping.')
    return
  }

  const abisDir = resolveAbisDir(config)
  const generatedFile = resolveGeneratedFile()

  let missing = 0
  let fetched = 0
  let existing = 0

  for (const node of walkContracts(config.contracts)) {
    const file = abiFilePath(abisDir, node)

    if (fs.existsSync(file)) {
      existing++
      report(node.chain, node.segments, node.address, 'ok', file)
      continue
    }

    let chainId: number
    try {
      chainId = chainIdFor(node.chain)
    } catch (error) {
      missing++
      report(
        node.chain,
        node.segments,
        node.address,
        'missing',
        file,
        (error as Error).message
      )
      continue
    }

    const abi = await fetchAbi(chainId, node.address)
    if (!abi) {
      missing++
      report(
        node.chain,
        node.segments,
        node.address,
        'missing',
        file,
        `api.abi.pub returned no ABI for chain ${chainId}`
      )
      continue
    }
    writeAbi(abisDir, node, abi)
    fetched++
    report(node.chain, node.segments, node.address, 'fetched', file)
  }

  console.log('')
  console.log(
    `Contracts summary: ${existing} existing, ${fetched} fetched, ${missing} missing.`
  )
  if (missing > 0) {
    console.log('')
    console.log('Missing ABIs must be provided manually. Paste the contract')
    console.log(
      'ABI JSON at the paths listed above and re-run `zodiac-os pull-contracts`.'
    )
  }

  const source = generateAllowTypes(abisDir, config.contracts)
  writeGenerated(generatedFile, source)
  console.log('')
  console.log(`Wrote typings to ${path.relative(process.cwd(), generatedFile)}`)

  if (missing > 0) process.exit(1)
}

function report(
  chain: string,
  segments: string[],
  address: string,
  status: Status,
  file: string,
  reason?: string
) {
  const label = `${chain}.${segments.join('.')}`.padEnd(40, ' ')
  const tag = {
    ok: '  cached  ',
    fetched: '  fetched ',
    missing: '  MISSING ',
  }[status]
  const suffix = reason ? ` — ${reason}` : ''
  console.log(`${tag} ${label} ${address}${suffix}`)
  if (status === 'missing') {
    console.log(`            → paste ABI at ${file}`)
  }
}
