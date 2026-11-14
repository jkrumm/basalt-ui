// Managed by basalt-ui: `basalt-ui sync` rewrites this file. Settings call it as `node hook.mjs <event>`.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const FIX = 'Run bun install, then basalt-ui doctor.'
const stop = (why) => {
  process.stderr.write(`basalt hook: ${why}. ${FIX}\n`)
  process.exit(2)
}

/** The local bin: beside each declared root's package (the isolated linker), then at the root. */
function findBin(project, roots) {
  for (const root of [...roots, '.']) {
    for (let at = join(project, root); ; at = dirname(at)) {
      const bin = join(at, 'node_modules/.bin/basalt-ui')
      if (existsSync(bin)) return bin
      if (at === project || dirname(at) === at) break
    }
  }
  return null
}

try {
  const input = readFileSync(0, 'utf8')
  const project = process.env.CLAUDE_PROJECT_DIR || JSON.parse(input).cwd
  const manifest = JSON.parse(readFileSync(join(project, '.basalt/manifest.json'), 'utf8'))
  const bin = findBin(project, Object.keys(manifest.roots ?? {}))
  if (bin === null) stop('basalt-ui is not installed')
  const args = ['lint', '--hook', process.argv[2] ?? '']
  const run = spawnSync(bin, args, { input, cwd: project, encoding: 'utf8' })
  if (run.error || ![0, 2].includes(run.status)) {
    stop(`basalt-ui lint did not run (${run.error?.code ?? `exit ${run.status}`})`)
  }
  process.stderr.write(run.stderr)
  process.exit(run.status)
} catch (error) {
  stop(error instanceof Error ? error.message : String(error))
}
