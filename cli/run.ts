import arg from 'arg'
import { codegen } from './commands'

export const run = async (argv: string[] = process.argv.slice(2)) => {
  const args = arg({}, { argv })

  const input = args._

  const [command] = input

  switch (command) {
    case 'codegen': {
      await codegen()
      break
    }

    default: {
      throw new Error(`Unknown command "${command}"`)
    }
  }
}
