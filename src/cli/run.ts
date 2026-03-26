import { Command } from 'commander'
import { loadConfig } from './config'
import { pullOrg } from './commands/pullOrg'
import { pullContracts } from './commands/pullContracts'

export const run = async (argv: string[] = process.argv) => {
  const program = new Command()

  program
    .name('zodiac-os')
    .description('Zodiac OS SDK CLI – pull org data and contract ABIs')
    .version('1.0.0')
    .option(
      '-c, --config <path>',
      'path to the config file',
      'zodiac.config.ts'
    )

  program
    .command('pull-org')
    .description('Fetch Zodiac users and vaults, generate TypeScript types')
    .action(async (_opts, cmd) => {
      const config = await loadConfig(cmd.optsWithGlobals().config)
      await pullOrg(config)
    })

  program
    .command('pull-contracts')
    .description('Fetch contract ABIs, generate typed permissions kit')
    .action(async (_opts, cmd) => {
      const config = await loadConfig(cmd.optsWithGlobals().config)
      await pullContracts(config)
    })

  program
    .command('pull')
    .description('Fetch Zodiac org and contracts ABI, generate SDK functions')
    .action(async (_opts, cmd) => {
      const config = await loadConfig(cmd.optsWithGlobals().config)
      await Promise.all([pullOrg(config), pullContracts(config)])
    })

  await program.parseAsync(argv)
}
