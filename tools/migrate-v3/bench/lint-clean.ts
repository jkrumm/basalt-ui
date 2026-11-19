// `lint-clean`: `basalt-ui lint` over the migrated app; any finding fails. The tool that produced a
// change cannot excuse its own output, so there is no allow list here.
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

export type LintRun = { code: number; output: string }
export type LintRunner = (dir: string) => LintRun | Promise<LintRun>

/** Exit 0 and no output beyond whitespace is clean; plain `lint` exits 1 on a finding. */
export async function lintClean(
  dir: string,
  run: LintRunner,
): Promise<{ ok: boolean; ran: boolean; output: string }> {
  const { code, output } = await run(dir)
  return { ok: code === 0, ran: code === 0 || code === 1, output: output.trim() }
}

function installedLint(bin?: string): LintRunner {
  return (dir) => {
    const cli = bin ?? join(dir, 'node_modules/.bin/basalt-ui')
    if (!existsSync(cli))
      return { code: 2, output: `${cli} not found; install the app's dependencies` }
    const r = Bun.spawnSync([cli, 'lint'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
    return { code: r.exitCode, output: `${r.stdout.toString()}${r.stderr.toString()}` }
  }
}

export async function lintCleanCommand(args: string[], run?: LintRunner): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { bin: { type: 'string' } },
  })
  if (!positionals[0]) {
    console.error('usage: run.ts lint-clean <app-dir> [--bin <basalt-ui binary>]')
    return 2
  }
  const dir = resolve(positionals[0])
  const result = await lintClean(dir, run ?? installedLint(values.bin))
  if (result.output) console.error(result.output)
  console.log(
    `lint-clean: ${result.ok ? 'clean' : result.ran ? 'lint failed, output above' : 'lint did not run'}`,
  )
  return result.ok ? 0 : result.ran ? 1 : 2
}
