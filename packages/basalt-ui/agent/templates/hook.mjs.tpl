// Managed by basalt-ui: `basalt-ui sync` rewrites this file. Settings call it as `node hook.mjs <event>`.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

const event = process.argv[2] ?? ''
let [project, roots, file] = [null, [], null]
const real = (p) =>
  existsSync(p) ? realpathSync(p) : dirname(p) === p ? p : join(real(dirname(p)), basename(p))

/** A guard that cannot run blocks only what it guards: an edit under a declared root, .basalt/ or .claude/. */
function stop(why) {
  process.stderr.write(`basalt hook: ${why}. Install the dependencies, then run basalt-ui doctor.\n`)
  const rel = project && file ? relative(real(project), real(file)).split('\\').join('/') : '..'
  const under = (root) => root === '.' || rel === root || rel.startsWith(`${root}/`)
  const guarded = rel !== '' && !rel.startsWith('..') && ['.basalt', '.claude', ...roots].some(under)
  process.exit(event !== 'stop' && (project === null || guarded) ? 2 : 0)
}

/** The local bin: beside each declared root's package (the isolated linker), then at the root. */
function findBin() {
  for (const root of [...roots, '.']) {
    for (let at = join(project, root); ; at = dirname(at)) {
      if (existsSync(join(at, 'node_modules/.bin/basalt-ui'))) return join(at, 'node_modules/.bin/basalt-ui')
      if (at === project || dirname(at) === at) break
    }
  }
  return null
}

try {
  const raw = readFileSync(0, 'utf8')
  const input = JSON.parse(raw)
  project = process.env.CLAUDE_PROJECT_DIR || input.cwd
  const path = input.tool_input?.file_path
  if (typeof path === 'string' && path !== '') file = resolve(input.cwd || project, path)
  const manifest = JSON.parse(readFileSync(join(project, '.basalt/manifest.json'), 'utf8'))
  roots = Object.keys(manifest.roots ?? {}).map((r) => r.replace(/^(?:\.\/)+|\/+$/g, '') || '.')
  const bin = findBin()
  if (bin === null) stop('basalt-ui is not installed')
  const run = spawnSync(bin, ['lint', '--hook', event], { input: raw, cwd: project, encoding: 'utf8' })
  if (run.error || ![0, 2].includes(run.status)) {
    stop(`basalt-ui lint did not run (${run.error?.code ?? `exit ${run.status}`})`)
  }
  process.stderr.write(run.stderr)
  process.exit(run.status)
} catch (error) {
  stop(error instanceof Error ? error.message : String(error))
}
