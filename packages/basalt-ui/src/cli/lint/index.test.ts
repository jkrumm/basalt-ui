import { afterEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
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

import { run } from '../index'

const FIXTURE = fileURLToPath(new URL('../../../test/fixtures/hook/single', import.meta.url))
const OXLINT = resolve(
  fileURLToPath(new URL('../../../../../node_modules/.bin/oxlint', import.meta.url)),
)
const PROBE = `export default {
  meta: { name: 'basalt' },
  rules: {
    'no-foo': {
      create: (context) => ({
        Literal: (node) => {
          if (node.value === 'foo') context.report({ node, message: 'a foo. Use a bar.' })
        },
      }),
    },
  },
}
`

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const git = (dir: string, ...args: string[]): void => {
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir })
}

/** The single-root fixture as a git repo with oxlint linked, plus `files`; `commit` snapshots it first. */
function repo(files: Record<string, string> = {}, { commit = true } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-lint-'))
  dirs.push(dir)
  cpSync(FIXTURE, dir, { recursive: true })
  mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true })
  symlinkSync(OXLINT, join(dir, 'node_modules/.bin/oxlint'))
  writeFileSync(join(dir, 'probe-plugin.mjs'), PROBE)
  writeFileSync(
    join(dir, '.oxlintrc.basalt.json'),
    JSON.stringify({
      jsPlugins: ['./probe-plugin.mjs'],
      rules: { 'no-console': 'error', 'basalt/no-foo': 'error' },
    }),
  )
  git(dir, 'init', '-q')
  if (commit) {
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'base')
  }
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

async function lint(dir: string, ...flags: string[]): Promise<{ code: number; log: string }> {
  const saved = { log: console.log, error: console.error }
  let log = ''
  const sink = (...args: unknown[]): void => void (log += `${args.join(' ')}\n`)
  console.log = sink
  console.error = sink
  try {
    return { code: await run(['lint', ...flags], dir), log }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

const FOO = "export const a = 'foo'\n"
const waiver = (n: number): string =>
  Array.from(
    { length: n },
    (_, i) =>
      `// oxlint-disable-next-line basalt/no-foo -- case ${i}\nexport const w${i} = 'foo'\n`,
  ).join('')
const budgetOf = (dir: string): { waivers: number; escapes: number } =>
  JSON.parse(readFileSync(join(dir, '.basalt/budget.json'), 'utf8')) as {
    waivers: number
    escapes: number
  }

describe('lint', () => {
  it('reports a finding as file:line rule: message and exits 1; clean exits 0', async () => {
    const dirty = await lint(repo({ 'src/a.tsx': FOO }))
    expect(dirty.code).toBe(1)
    expect(dirty.log).toContain('src/a.tsx:1 basalt/no-foo: a foo. Use a bar.')
    expect(dirty.log).toContain('scanned 2 files in src')
    const clean = await lint(repo())
    expect(clean.code).toBe(0)
    expect(clean.log).toContain('scanned 1 file in src')
  })

  it('--agent is terse and exits 2 on a finding, silent when clean', async () => {
    const dirty = await lint(repo({ 'src/a.tsx': FOO }), '--agent')
    expect(dirty.code).toBe(2)
    expect(dirty.log).toBe('src/a.tsx:1 basalt/no-foo: a foo. Use a bar.\n')
    expect(await lint(repo(), '--agent')).toEqual({ code: 0, log: '' })
  })

  it('--file lints the named file only and refuses one outside every declared root', async () => {
    const dir = repo({ 'src/a.tsx': FOO, 'src/b.tsx': FOO })
    const one = await lint(dir, '--file', 'src/a.tsx')
    expect(one.code).toBe(1)
    expect(one.log).toContain('scanned 1 file')
    expect(one.log).not.toContain('b.tsx')
    const outside = await lint(dir, '--file', 'scripts/x.ts')
    expect(outside.code).toBe(1)
    expect(outside.log).toContain('is not under a declared root')
  })

  it('--changed lints what git reports changed; nothing changed is clean', async () => {
    const dir = repo({ 'src/a.tsx': FOO }, { commit: false })
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'base')
    const none = await lint(dir, '--changed')
    expect(none.code).toBe(0)
    expect(none.log).toContain('scanned 0 files')
    writeFileSync(join(dir, 'src/c.tsx'), FOO)
    const some = await lint(dir, '--changed')
    expect(some.code).toBe(1)
    expect(some.log).toContain('src/c.tsx:1')
    expect(some.log).not.toContain('src/a.tsx')
  })

  it('--changed fails when git cannot list the changes, instead of reading as clean', async () => {
    const dir = repo({ 'src/a.tsx': FOO })
    rmSync(join(dir, '.git'), { recursive: true })
    const out = await lint(dir, '--changed')
    expect(out.code).toBe(1)
    expect(out.log).toContain('git could not list the changed files')
  })

  it('--changed skips what a full scan skips (.claude, .basalt, node_modules)', async () => {
    const dir = repo()
    const manifest = JSON.parse(readFileSync(join(dir, '.basalt/manifest.json'), 'utf8')) as {
      roots: Record<string, string>
    }
    writeFileSync(
      join(dir, '.basalt/manifest.json'),
      JSON.stringify({ ...manifest, roots: { '.': 'app' } }),
    )
    for (const path of ['.claude/hooks/x.mjs', '.basalt/y.mjs', 'node_modules/z/index.js']) {
      mkdirSync(dirname(join(dir, path)), { recursive: true })
      writeFileSync(join(dir, path), FOO)
    }
    const out = await lint(dir, '--changed')
    expect(out.code).toBe(0)
    expect(out.log).toContain('scanned 0 files')
  })

  it('a scan of zero files fails and says so', async () => {
    const dir = repo()
    rmSync(join(dir, 'src'), { recursive: true })
    const out = await lint(dir)
    expect(out.code).toBe(1)
    expect(out.log).toContain('scanned 0 files')
  })

  it('exits 1 when counted waivers exceed the ceiling, and names the way up', async () => {
    const out = await lint(repo({ 'src/w.tsx': waiver(2) }))
    expect(out.code).toBe(1)
    expect(out.log).toContain('2 waivers is above the ceiling 0 in .basalt/budget.json')
    expect(out.log).toContain('eject --raise')
  })

  it('exits 1 when escapes exceed the ceiling', async () => {
    const text = 'export const e = [col.custom, chart.custom, field.custom, filterSlot.custom]\n'
    const out = await lint(repo({ 'src/e.tsx': text }))
    expect(out.code).toBe(1)
    expect(out.log).toContain('4 escapes is above the ceiling 3')
  })

  it('--stats prints findings, waivers and escapes per rule against the ceilings', async () => {
    const out = await lint(repo({ 'src/w.tsx': waiver(1), 'src/a.tsx': FOO }), '--stats')
    expect(out.log).toContain('findings: 1 (basalt/no-foo 1)')
    expect(out.log).toContain('waivers: 1 of 0 (basalt/no-foo 1)')
    expect(out.log).toContain('escapes: 0 of 3')
    expect(out.log).toContain('ejects: 0 of 3')
  })

  it('a file-level directive in a deepRender file counts as the findings it suppresses', async () => {
    const dir = repo({
      'src/deep.tsx': `/* oxlint-disable basalt/no-foo -- deep render */\nexport const a = 'foo'\nexport const b = 'foo'\n`,
    })
    const manifest = JSON.parse(readFileSync(join(dir, '.basalt/manifest.json'), 'utf8')) as object
    writeFileSync(
      join(dir, '.basalt/manifest.json'),
      JSON.stringify({ ...manifest, deepRender: ['src/deep.tsx'] }),
    )
    const out = await lint(dir, '--stats')
    expect(out.log).toContain('waivers: 2 of 0 (basalt/no-foo 2)')
    expect(readFileSync(join(dir, 'src/deep.tsx'), 'utf8')).toContain('deep render')
    expect(
      spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).stdout,
    ).not.toContain('basalt-recount')
  })

  it('--stats --write-budget lands the counts through landBudget, and refuses to raise past the base', async () => {
    const dir = repo({ 'src/w.tsx': waiver(2) }, { commit: false })
    rmSync(join(dir, '.basalt/budget.json'))
    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'base without a budget copy')
    writeFileSync(
      join(dir, '.basalt/budget.json'),
      '{"ejects":3,"adopted":0,"waivers":0,"escapes":3,"profileFloor":"app","raises":[]}\n',
    )
    const first = await lint(dir, '--stats', '--write-budget')
    expect(first.code).toBe(0)
    expect(budgetOf(dir)).toMatchObject({ waivers: 2, escapes: 0 })
    expect(await lint(dir)).toMatchObject({ code: 0 })

    git(dir, 'add', '-A')
    git(dir, 'commit', '-qm', 'land the budget')
    writeFileSync(join(dir, 'src/w.tsx'), waiver(3))
    const raised = await lint(dir, '--stats', '--write-budget')
    expect(raised.code).toBe(1)
    expect(raised.log).toContain('eject --raise')
    expect(budgetOf(dir).waivers).toBe(2)

    writeFileSync(join(dir, 'src/w.tsx'), waiver(1))
    expect((await lint(dir, '--stats', '--write-budget')).code).toBe(0)
    expect(budgetOf(dir).waivers).toBe(1)
  })

  it('rejects an unknown flag with exit 1, and --write-budget without --stats', async () => {
    const dir = repo()
    const bad = await lint(dir, '--bogus')
    expect(bad.code).toBe(1)
    expect(bad.log).toContain('--bogus')
    const budget = await lint(dir, '--write-budget')
    expect(budget.code).toBe(1)
    expect(budget.log).toContain('--write-budget needs --stats')
  })

  it('runs without a manifest on the 2.x `basalt.roots` key', async () => {
    const dir = repo({ 'src/a.tsx': FOO })
    rmSync(join(dir, '.basalt'), { recursive: true })
    const out = await lint(dir)
    expect(out.code).toBe(1)
    expect(out.log).toContain('src/a.tsx:1 basalt/no-foo')
  })
})
