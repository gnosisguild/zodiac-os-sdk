import { Command } from 'commander'
import { init } from './commands/init'
import { loadConfig } from './config'
import { pullOrg } from './commands/pullOrg'
import { pullContracts } from './commands/pullContracts'

export const run = async (argv: string[] = process.argv) => {
  const program = new Command()

  program
    .name('zodiac')
    .description('Zodiac SDK CLI – pull org data and contract ABIs')
    .version('1.0.0')
    .option(
      '-c, --config <path>',
      'path to the config file',
      'zodiac.config.ts'
    )

  program
    .command('init')
    .description(
      'Authorize this directory with a Zodiac org. Opens a browser to mint an API key and writes it to .env.'
    )
    .option(
      '--app-url <url>',
      'Override the Zodiac app URL (defaults to ZODIAC_APP_URL or app.zodiac.eco)'
    )
    .action(async (opts) => {
      await init({ appUrl: opts.appUrl })
    })

  program
    .command('pull-org')
    .description('Fetch Zodiac users and accounts, generate TypeScript types')
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
