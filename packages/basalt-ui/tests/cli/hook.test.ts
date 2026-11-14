/**
 * The managed shim, black-box: `node .basalt/hook.mjs <event>` in scratch repos copied from
 * `test/fixtures/hook/`, the way Claude Code runs it (event JSON on stdin, `CLAUDE_PROJECT_DIR`
 * set, any cwd). The preset is a stand-in (native `no-console`): the rules are proven elsewhere,
 * this proves the loop: a finding reaches exit 2 from any directory, Stop blocks once per session,
 * and every way the shim can fail exits 2 with a line naming the fix.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = fileURLToPath(new URL('../../', import.meta.url))
const FIXTURES = join(PKG, 'test/fixtures/hook')
const OXLINT = resolve(PKG, '../../node_modules/.bin/oxlint')
const SHIM = readFileSync(join(PKG, 'agent/templates/hook.mjs.tpl'), 'utf8')
const BIN_STUB = `#!/usr/bin/env bun
import { run } from '${join(PKG, 'src/cli/index.ts')}'
process.exit(await run(process.argv.slice(2)))
`
const FINDING = /\S+:\d+ eslint\/no-console: /

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

type Tree = { root: string; bin: string; tmp: string }

/** A scratch repo of a fixture tree, with the shim, a stub bin that runs this checkout, and oxlint. */
function tree(name: 'single' | 'workspace'): Tree {
  const root = mkdtempSync(join(tmpdir(), 'basalt-hook-'))
  dirs.push(root)
  cpSync(join(FIXTURES, name), root, { recursive: true })
  spawnSync('git', ['init', '-q'], { cwd: root })
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A'], { cwd: root })
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base'], {
    cwd: root,
  })
  writeFileSync(join(root, '.basalt/hook.mjs'), SHIM)
  // The isolated linker puts the bin beside the dependent package, not at the root.
  const pkgDir = name === 'workspace' ? join(root, 'apps/dash') : root
  const bin = join(pkgDir, 'node_modules/.bin/basalt-ui')
  mkdirSync(dirname(bin), { recursive: true })
  writeFileSync(bin, BIN_STUB)
  chmodSync(bin, 0o755)
  symlinkSync(OXLINT, join(pkgDir, 'node_modules/.bin/oxlint'))
  return { root, bin, tmp: mkdtempSync(join(tmpdir(), 'basalt-hook-tmp-')) }
}

type Call = { event: string; input?: Record<string, unknown>; cwd?: string; raw?: string }

function hook(t: Tree, { event, input = {}, cwd = t.root, raw }: Call) {
  dirs.push(t.tmp)
  const run = spawnSync('node', [join(t.root, '.basalt/hook.mjs'), event], {
    cwd,
    input: raw ?? JSON.stringify({ cwd, ...input }),
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: t.root, TMPDIR: t.tmp },
  })
  return { code: run.status, err: run.stderr }
}

const edit = (file: string, extra: Record<string, unknown> = {}) => ({
  tool_name: 'Write',
  tool_input: { file_path: file, ...extra },
})

function offender(t: Tree, rel: string): string {
  const file = join(t.root, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, 'console.log(1)\n')
  return file
}

describe('post-edit', () => {
  it('returns a finding for a seeded offender, from the root and from a package subdirectory', () => {
    const t = tree('workspace')
    const file = offender(t, 'apps/dash/src/seeded.tsx')
    for (const cwd of [t.root, join(t.root, 'apps/dash'), join(t.root, 'apps/dash/src')]) {
      const out = hook(t, { event: 'post-edit', input: edit(file), cwd })
      expect(out.code).toBe(2)
      expect(out.err).toMatch(FINDING)
      expect(out.err).toContain('apps/dash/src/seeded.tsx:1')
    }
  })

  it('passes a clean file and a file outside every declared root', () => {
    const t = tree('single')
    expect(hook(t, { event: 'post-edit', input: edit(join(t.root, 'src/clean.tsx')) }).code).toBe(0)
    const outside = offender(t, 'scripts/tool.ts')
    expect(hook(t, { event: 'post-edit', input: edit(outside) }).code).toBe(0)
  })

  it('resolves a relative file_path against the event cwd', () => {
    const t = tree('single')
    offender(t, 'src/seeded.tsx')
    const out = hook(t, { event: 'post-edit', input: edit('seeded.tsx'), cwd: join(t.root, 'src') })
    expect(out.code).toBe(2)
    expect(out.err).toContain('src/seeded.tsx:1')
  })

  it('caps what the model reads at ten lines', () => {
    const t = tree('single')
    const lines = Array.from({ length: 25 }, () => 'console.log(1)').join('\n')
    writeFileSync(join(t.root, 'src/many.tsx'), `${lines}\n`)
    const out = hook(t, { event: 'post-edit', input: edit(join(t.root, 'src/many.tsx')) })
    expect(out.code).toBe(2)
    expect(out.err.trimEnd().split('\n')).toHaveLength(11)
    expect(out.err).toContain('…and 15 more')
  })
})

describe('stop', () => {
  it('returns the agent at most once per session_id', () => {
    const t = tree('single')
    offender(t, 'src/seeded.tsx')
    const stop = (session: string, extra: Record<string, unknown> = {}) =>
      hook(t, { event: 'stop', input: { session_id: session, ...extra } })
    expect(stop('a').code).toBe(2)
    expect(stop('a').code).toBe(0)
    expect(stop('b').code).toBe(2)
  })

  it('does not re-engage while a stop hook is active, nor without a session_id', () => {
    const t = tree('single')
    offender(t, 'src/seeded.tsx')
    expect(
      hook(t, { event: 'stop', input: { session_id: 'c', stop_hook_active: true } }).code,
    ).toBe(0)
    expect(hook(t, { event: 'stop' }).code).toBe(0)
  })

  it('passes when nothing changed', () => {
    const t = tree('single')
    expect(hook(t, { event: 'stop', input: { session_id: 'd' } }).code).toBe(0)
  })
})

describe('pre-edit', () => {
  const t = (): Tree => tree('single')
  const denied = (rel: string, extra: Record<string, unknown>, tr = t()) => {
    const out = hook(tr, { event: 'pre-edit', input: edit(join(tr.root, rel), extra) })
    expect(out.code).toBe(2)
    expect(out.err).toContain('basalt hook: denied')
  }

  it('denies .basalt/**, managed .claude paths and the presets', () => {
    denied('.basalt/budget.json', { content: '{}' })
    denied('.claude/rules/basalt-tokens.md', { content: '# x' })
    denied('.claude/skills/basalt-design/SKILL.md', { content: '# x' })
    denied('.oxlintrc.basalt.json', { content: '{}' })
    denied('.stylelintrc.basalt.json', { content: '{}' })
  })

  it('denies a settings.json write that removes a basalt entry, and allows one that adds a foreign entry', () => {
    const tr = t()
    const file = join(tr.root, '.claude/settings.json')
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(
      file,
      '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"node \\".basalt/hook.mjs\\" stop"}]}]}}\n',
    )
    const removed = hook(tr, {
      event: 'pre-edit',
      input: edit(file, { content: '{"hooks":{}}\n' }),
    })
    expect(removed.code).toBe(2)
    expect(removed.err).toContain('removes a basalt hook entry')
    const added = hook(tr, {
      event: 'pre-edit',
      input: edit(file, {
        old_string: '"hooks":{"Stop"',
        new_string: '"permissions":{},"hooks":{"Stop"',
      }),
    })
    expect(added.code).toBe(0)
  })

  it('denies a managed id added to the consumer lint config, and allows another edit of it', () => {
    const tr = t()
    const rules = '{"extends":["./.oxlintrc.basalt.json"],"rules":{"basalt/colour-literal":"off"}}'
    denied('.oxlintrc.json', { content: rules }, tr)
    const ok = hook(tr, {
      event: 'pre-edit',
      input: edit(join(tr.root, '.oxlintrc.json'), {
        content: '{"extends":["./.oxlintrc.basalt.json"],"rules":{"no-var":"error"}}',
      }),
    })
    expect(ok.code).toBe(0)
  })

  it('allows an ordinary source edit', () => {
    const tr = t()
    const out = hook(tr, {
      event: 'pre-edit',
      input: edit(join(tr.root, 'src/a.tsx'), { content: 'x' }),
    })
    expect(out.code).toBe(0)
  })
})

describe('every failure exits 2 with a line naming the fix', () => {
  const fixed = /bun install|basalt-ui doctor/

  it('a missing bin', () => {
    const t = tree('workspace')
    rmSync(join(t.root, 'apps/dash/node_modules/.bin/basalt-ui'))
    const out = hook(t, {
      event: 'post-edit',
      input: edit(join(t.root, 'apps/dash/src/clean.tsx')),
    })
    expect(out.code).toBe(2)
    expect(out.err).toMatch(fixed)
  })

  it('a thrown error in the bin', () => {
    const t = tree('single')
    writeFileSync(t.bin, '#!/usr/bin/env bun\nthrow new Error("boom")\n')
    const out = hook(t, { event: 'post-edit', input: edit(join(t.root, 'src/clean.tsx')) })
    expect(out.code).toBe(2)
    expect(out.err).toMatch(fixed)
  })

  it('an unknown event', () => {
    const out = hook(tree('single'), { event: 'sideways' })
    expect(out.code).toBe(2)
    expect(out.err).toContain('unknown event "sideways"')
    expect(out.err).toMatch(fixed)
  })

  it('an event that is not JSON, and a missing manifest', () => {
    const t = tree('single')
    const bad = hook(t, { event: 'post-edit', raw: 'not json' })
    expect(bad.code).toBe(2)
    expect(bad.err).toMatch(fixed)
    rmSync(join(t.root, '.basalt/manifest.json'))
    const none = hook(t, { event: 'post-edit', input: edit(join(t.root, 'src/clean.tsx')) })
    expect(none.code).toBe(2)
    expect(none.err).toMatch(fixed)
  })

  it('an unknown flag under --hook exits 2, not 1', () => {
    const t = tree('single')
    const run = spawnSync(t.bin, ['lint', '--hook', 'post-edit', '--bogus'], {
      cwd: t.root,
      input: '{}',
      encoding: 'utf8',
    })
    expect(run.status).toBe(2)
    expect(run.stderr).toContain('--bogus')
  })
})

describe('the shim', () => {
  it('is at most 40 lines and runs the local bin, never bunx', () => {
    expect(SHIM.trimEnd().split('\n').length).toBeLessThanOrEqual(40)
    expect(SHIM).toContain('node_modules/.bin/basalt-ui')
    expect(SHIM).not.toMatch(/\b(?:bunx|npx)\b/)
    expect(existsSync(OXLINT)).toBe(true)
  })
})
