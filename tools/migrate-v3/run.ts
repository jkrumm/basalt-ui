// Entry point of the v3 consumer migration tools: `bun tools/migrate-v3/run.ts <command> <app-dir> ...`.
// One row per command; rows below the marker are appended by the Issues that own them.
import { chartsCommand } from './charts/index.ts'
import { controlsCommand } from './controls/index.ts'
import { importsCommand } from './imports/index.ts'
import { layoutCommand } from './layout/index.ts'

type Command = (args: string[]) => number | Promise<number>

const owned =
  (name: string): Command =>
  () => {
    console.error(`${name}: not implemented yet (owned by v3-mig-bench)`)
    return 2
  }

const commands: Record<string, Command> = {
  layout: layoutCommand,
  imports: importsCommand,
  charts: chartsCommand,
  controls: controlsCommand,
  // v3-mig-bench fills these four.
  bench: owned('bench'),
  valueshifts: owned('valueshifts'),
  'classes-exist': owned('classes-exist'),
  'lint-clean': owned('lint-clean'),
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
