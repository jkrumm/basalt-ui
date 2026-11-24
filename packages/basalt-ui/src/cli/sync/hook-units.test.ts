import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { buildContext, runChecks } from '../doctor/index'
import { commitTree, HEALTHY, makeTree, quiet, settingsJson } from '../doctor/fixture.test'
import { packageRoot, readFrameworkVersion, run } from '../index'
import { hookCommand } from '../lint/settings'
import { renderTokens } from '../tokens-css'
import { sync } from './index'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function repo(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-hook-step-'))
  dirs.push(dir)
  mkdirSync(join(dir, '.git'))
  writeFileSync(join(dir, 'package.json'), '{"name":"x"}')
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

async function init(dir: string, profile: string): Promise<{ code: number; log: string }> {
  const saved = { log: console.log, error: console.error }
  let log = ''
  console.log = console.error = (...args: unknown[]) => void (log += `${args.join(' ')}\n`)
  try {
    return { code: await run(['init', '--no-install', '--profile', profile], dir), log }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

const read = (dir: string, path: string): string => readFileSync(join(dir, path), 'utf8')

describe('init registers the hook through sync', () => {
  it('places the shim and the three entries, and a second run changes nothing', async () => {
    const dir = repo()
    expect((await init(dir, 'app')).code).toBe(0)
    expect(read(dir, '.basalt/hook.mjs')).toContain('lint')
    const hooks = (JSON.parse(read(dir, '.claude/settings.json')) as { hooks: object }).hooks
    expect(Object.keys(hooks)).toEqual(['PostToolUse', 'Stop', 'PreToolUse'])
    const before = [read(dir, '.basalt/hook.mjs'), read(dir, '.claude/settings.json')]
    await init(dir, 'app')
    expect([read(dir, '.basalt/hook.mjs'), read(dir, '.claude/settings.json')]).toEqual(before)
  })

  it('keeps an existing settings.json entry byte-identical', async () => {
    const guard =
      '{\n  "hooks": {\n    "PreToolUse": [\n      {\n        "matcher": "Edit",\n        "hooks": [{ "type": "command", "command": "keep-me" }]\n      }\n    ]\n  }\n}\n'
    const dir = repo({ '.claude/settings.json': guard })
    await init(dir, 'bridge')
    expect(read(dir, '.claude/settings.json')).toContain(
      '      {\n        "matcher": "Edit",\n        "hooks": [{ "type": "command", "command": "keep-me" }]\n      }',
    )
  })

  it('leaves an unparseable settings.json alone and prints the entries to place', async () => {
    const broken = '{ "hooks": { "Stop": [ ], }\n'
    const dir = repo({ '.claude/settings.json': broken })
    const out = await init(dir, 'app')
    expect(read(dir, '.claude/settings.json')).toBe(broken)
    expect(out.log).toContain('is not valid JSON')
    expect(out.log).toContain('.basalt/hook.mjs')
  })

  it('a tokens install registers no hook', async () => {
    const dir = repo()
    await init(dir, 'tokens')
    expect(existsSync(join(dir, '.basalt/hook.mjs'))).toBe(false)
    expect(existsSync(join(dir, '.claude/settings.json'))).toBe(false)
  })
})

/** The shim and the command 3.0 shipped before `sync` owned them: what an old install still holds. */
const OLD_SHIM = '// Managed by basalt-ui: `basalt-ui init` rewrites this file.\nprocess.exit(0)\n'
const OLD_COMMAND = (event: string): string =>
  `node "$CLAUDE_PROJECT_DIR/.basalt/hook.mjs" ${event}; s=$?; case $s in 0|2) exit $s;; esac; ` +
  "echo 'basalt hook: the shim did not run (exit '$s'). Run bun install, then basalt-ui doctor.' >&2; exit 2"

describe('sync heals an old install', () => {
  it('refreshes the shim, the hook entries, a stale token sheet and the ledger formats; doctor is green', async () => {
    const dir = makeTree('app')
    const settings = JSON.parse(settingsJson(OLD_COMMAND)) as {
      hooks: Record<string, { matcher?: string; hooks: { command: string }[] }[]>
    }
    settings.hooks['PreToolUse']?.push({ matcher: 'Bash', hooks: [{ command: 'keep-me' }] })
    writeFileSync(join(dir, '.claude/settings.json'), `${JSON.stringify(settings, null, 2)}\n`)
    writeFileSync(join(dir, '.basalt/hook.mjs'), OLD_SHIM)
    writeFileSync(join(dir, 'src/tokens.css'), '/* tokens:css from an older release */\n')
    for (const rel of ['.basalt/manifest.json', '.basalt/budget.json']) {
      const { format: _format, ...old } = JSON.parse(read(dir, rel)) as Record<string, unknown>
      writeFileSync(join(dir, rel), JSON.stringify(old))
    }

    expect(quiet(() => sync({ pkgRoot: packageRoot(), check: true }, dir))).toBe(1)
    expect(quiet(() => sync({ pkgRoot: packageRoot() }, dir))).toBe(0)

    expect(read(dir, '.basalt/hook.mjs')).toBe(read(packageRoot(), 'agent/templates/hook.mjs.tpl'))
    const healed = read(dir, '.claude/settings.json')
    for (const event of ['post-edit', 'stop', 'pre-edit']) {
      expect(healed).toContain(JSON.stringify(hookCommand(event)))
    }
    expect(healed).not.toContain('Run bun install')
    expect(healed).toContain('keep-me')
    const sheet = renderTokens(
      ['--out', 'src/tokens.css'],
      dir,
      readFrameworkVersion(packageRoot()),
    )
    expect('files' in sheet && sheet.files[0]?.content).toBe(read(dir, 'src/tokens.css'))
    expect(JSON.parse(read(dir, '.basalt/manifest.json'))).toHaveProperty('format', 1)
    expect(JSON.parse(read(dir, '.basalt/budget.json'))).toHaveProperty('format', 1)
    expect(quiet(() => sync({ pkgRoot: packageRoot(), check: true }, dir))).toBe(0)

    // Check 8 probes the shim on a seeded offender, which needs a real install: the tree's stub
    // stands in for it (the Node CLI job in CI runs the real shim end to end).
    const shim = read(dir, '.basalt/hook.mjs')
    writeFileSync(join(dir, '.basalt/hook.mjs'), read(makeTree('app'), '.basalt/hook.mjs'))
    commitTree(dir)
    const results = await runChecks(buildContext(dir, HEALTHY))
    expect(results.filter((r) => r.status !== 'pass')).toEqual([])
    expect(shim).toContain('`basalt-ui sync` rewrites this file')
  })
})
