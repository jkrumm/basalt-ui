// Entry point of the v3 consumer migration tools: `bun tools/migrate-v3/run.ts <command> <app-dir> ...`.
// One row per command; rows below the marker are appended by the Issues that own them.
import {
  benchCommand,
  classesExistCommand,
  lintCleanCommand,
  valueshiftsCommand,
} from './bench/index.ts'
import { chartsCommand } from './charts/index.ts'
import { controlsCommand } from './controls/index.ts'
import { importsCommand } from './imports/index.ts'
import { layoutCommand } from './layout/index.ts'
import { namesCommand } from './names/index.ts'
import { tokensCommand } from './tokens/index.ts'

type Command = (args: string[]) => number | Promise<number>

const commands: Record<string, Command> = {
  layout: layoutCommand,
  imports: importsCommand,
  tokens: tokensCommand,
  charts: chartsCommand,
  controls: controlsCommand,
  names: namesCommand,
  bench: benchCommand,
  valueshifts: valueshiftsCommand,
  'classes-exist': classesExistCommand,
  'lint-clean': (args) => lintCleanCommand(args),
}

if (import.meta.main) {
  const [name, ...rest] = process.argv.slice(2)
  const command = name ? commands[name] : undefined
  if (!command) {
    console.error(`usage: run.ts <${Object.keys(commands).join('|')}> <app-dir> [flags]`)
    process.exit(2)
  }
  process.exit(await command(rest))
}
