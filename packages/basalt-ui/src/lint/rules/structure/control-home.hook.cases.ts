/**
 * Test support: a fixture run through `basalt-ui lint --hook post-edit` the way the managed shim
 * runs it: a temp install with the bundled basalt plugin, the event JSON on stdin and the working
 * directory a subdirectory of the install. The answer is the exit code and stderr.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const PACKAGE = resolve(import.meta.dirname, '../../../..')
const INSTALL = resolve(PACKAGE, 'test/fixtures/hook/single')
const OXLINT = resolve(PACKAGE, '../../node_modules/.bin/oxlint')
const CLI = resolve(PACKAGE, 'src/cli/index.ts')
const PLUGIN = resolve(PACKAGE, 'src/lint/index.ts')

export type HookRun = { code: number | null; stderr: string }

export type HookInstall = {
  /** Lint `source` as `src/pages/<name>`, edited from `src/pages`, and report what the hook answers. */
  run(name: string, source: string): HookRun
  dispose(): void
}

/** The install: the single-root fixture, oxlint linked, the ids under test enabled as errors. */
export async function hookInstall(ids: readonly string[]): Promise<HookInstall> {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-hook-proof-'))
  cpSync(INSTALL, dir, { recursive: true })
  mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true })
  symlinkSync(OXLINT, join(dir, 'node_modules/.bin/oxlint'))
  const build = await Bun.build({
    entrypoints: [PLUGIN],
    outdir: dir,
    target: 'node',
    format: 'esm',
    naming: 'basalt-plugin.mjs',
  })
  if (!build.success) throw new Error('the basalt plugin did not bundle')
  writeFileSync(
    join(dir, '.oxlintrc.basalt.json'),
    JSON.stringify({
      jsPlugins: ['./basalt-plugin.mjs'],
      rules: Object.fromEntries(ids.map((id) => [`basalt/${id}`, 'error'])),
    }),
  )
  mkdirSync(join(dir, 'src/pages'), { recursive: true })
  return {
    run(name, source) {
      writeFileSync(join(dir, 'src/pages', name), source)
      const cwd = join(dir, 'src/pages')
      const script = `import { run } from ${JSON.stringify(CLI)}; process.exit(await run(['lint', '--hook', 'post-edit'], process.cwd()))`
      const result = Bun.spawnSync(['bun', '-e', script], {
        cwd,
        stdin: new TextEncoder().encode(JSON.stringify({ cwd, tool_input: { file_path: name } })),
      })
      return { code: result.exitCode, stderr: result.stderr.toString() }
    },
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  }
}
