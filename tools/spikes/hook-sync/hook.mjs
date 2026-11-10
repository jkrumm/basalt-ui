// Spike stand-in for the managed .basalt/hook.mjs (skills-agent-layer 4.2). Never shipped.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MAX_LINES = 10
const MAX_CHARS = 2000
const policy = process.env.HOOK_SPIKE_STOP_POLICY ?? 'both' // none | flag | counter | both
const event = process.argv[2] ?? ''
const log = (m) =>
  process.env.HOOK_SPIKE_LOG && appendFileSync(process.env.HOOK_SPIKE_LOG, `${m}\n`)
const fail = (msg) => {
  process.stderr.write(`basalt hook: ${msg}\n`)
  process.exit(2)
}

if (!['post-edit', 'stop', 'pre-edit'].includes(event))
  fail(`unknown event "${event}". Run basalt-ui doctor.`)
try {
  const raw = readFileSync(0, 'utf8')
  const ev = JSON.parse(raw)
  const project = process.env.CLAUDE_PROJECT_DIR || ev.cwd
  const manifest = JSON.parse(readFileSync(join(project, '.basalt/manifest.json'), 'utf8'))
  const bin = join(project, manifest.packageDir ?? '.', 'node_modules/.bin/basalt-ui')
  const key = createHash('sha256')
    .update(`${project}\0${ev.session_id ?? ''}`)
    .digest('hex')
    .slice(0, 16)
  const counter = join(tmpdir(), `basalt-stop-${key}`)
  log(`${event} active=${ev.stop_hook_active ?? 'absent'} cwd=${ev.cwd}`)
  if (event === 'stop' && ['flag', 'both'].includes(policy) && ev.stop_hook_active === true)
    process.exit(0)
  if (event === 'stop' && ['counter', 'both'].includes(policy) && existsSync(counter))
    process.exit(0)
  const r = spawnSync(bin, ['lint', '--hook', event], {
    input: raw,
    cwd: project,
    encoding: 'utf8',
  })
  if (r.error || ![0, 2].includes(r.status)) {
    fail(
      `basalt-ui lint did not run (${r.error?.code ?? `exit ${r.status}`}). Run bun install, then basalt-ui doctor.`,
    )
  }
  if (r.status === 0) process.exit(0)
  const lines = r.stderr.trimEnd().split('\n').filter(Boolean)
  if (lines.length === 0) fail('basalt-ui lint exited 2 without a finding. Run basalt-ui doctor.')
  if (event === 'stop' && policy !== 'none') writeFileSync(counter, '1')
  const more =
    lines.length > MAX_LINES ? `\n…and ${lines.length - MAX_LINES} more; run basalt-ui lint.` : ''
  process.stderr.write(`${(lines.slice(0, MAX_LINES).join('\n') + more).slice(0, MAX_CHARS)}\n`)
  process.exit(2)
} catch (e) {
  fail(`${e instanceof Error ? e.message : e}. Run basalt-ui doctor.`)
}
