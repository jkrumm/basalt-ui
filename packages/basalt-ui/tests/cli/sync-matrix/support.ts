/**
 * Fixtures for the sync matrix: a miniature shipped package with one primitive (`widget`) and an
 * app that ejected it through the real `eject`, with a real git repository and oxfmt. `bump`
 * moves the package to a new version and seed, the way an upgrade does.
 */
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { eject } from '../../../src/cli/eject'
import { readManifest, writeManifest } from '../../../src/cli/manifest'
import type { Manifest } from '../../../src/cli/manifest'
import { sync } from '../../../src/cli/sync'

const FIXTURE_PKG = fileURLToPath(new URL('../../../test/fixtures/sync/pkg/', import.meta.url))
const OXFMT = fileURLToPath(new URL('../../../../../node_modules/.bin/oxfmt', import.meta.url))

export const FILE = 'src/components/ui/widget.tsx'
export const GUARD = 'src/components/ui/widget.guard.ts'
export const BASE = '.basalt/base/src/widget.tsx'
export const KEY = 'src#widget'

/** The v1 seed, in basalt's own style (single quotes, no semicolons): one line per entry. */
export const SEED_V1 = [
  "import { cn } from '../core/cn'",
  '',
  "export const widgetParts = ['widget'] as const",
  '',
  "const tone = 'neutral'",
  '',
  'export function Widget({ label }: { label: string }) {',
  "  const size = 'md'",
  '  return (',
  "    <div data-slot='widget' className={cn('flex', tone, size)}>",
  '      {label}',
  '    </div>',
  '  )',
  '}',
  '',
  'export function widgetLabel(count: number): string {',
  "  const unit = count === 1 ? 'item' : 'items'",
  '  return `${count} ${unit}`',
  '}',
  '',
  'export function widgetTone(): string {',
  '  return tone',
  '}',
  '',
]

export const GUARD_V1 =
  "import type { Widget } from './widget'\nexport type Requires = typeof Widget\n"

export const text = (lines: readonly string[]): string => lines.join('\n')

/** `lines` with line `at` (0-based) replaced, or removed when `next` is null. */
export function edit(lines: readonly string[], at: number, next: string | null): string[] {
  const out = [...lines]
  if (next === null) out.splice(at, 1)
  else out[at] = next
  return out
}

/** The seed as an eject receives it: the package-relative import moved to its published path. */
export const ejected = (seed: string): string =>
  seed.replace("from '../core/cn'", "from 'basalt-ui/core/cn'")

const scratch: string[] = []

export const cleanup = (): void => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
}

function tmp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  scratch.push(dir)
  return dir
}

function put(dir: string, rel: string, content: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true })
  writeFileSync(join(dir, rel), content)
}

export type Fixture = { app: string; pkg: string }

/** Moves the fixture package to `version` with this seed and guard (null removes the guard). */
export function bump(pkg: string, version: string, seed: string, guard: string | null): void {
  put(pkg, 'package.json', `${JSON.stringify({ name: 'basalt-ui', version })}\n`)
  put(pkg, 'src/ui/widget.tsx', seed)
  if (guard === null) rmSync(join(pkg, 'src/ui/widget.guard.ts'), { force: true })
  else put(pkg, 'src/ui/widget.guard.ts', guard)
}

type Run = { code: number; log: string }

/** Runs `fn` with both console streams captured. */
export function capture(fn: () => number): Run {
  const saved = { log: console.log, error: console.error }
  let log = ''
  const sink = (...args: unknown[]): void => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    return { code: fn(), log }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

export const runSync = (f: Fixture, check = false): Run =>
  capture(() => sync({ pkgRoot: f.pkg, presetFiles: () => [], check }, f.app))

const git = (dir: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf8' })

export const commit = (dir: string): void => {
  git(dir, 'add', '-A')
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'tree')
}

export const gitDiff = (dir: string, path: string): string => git(dir, 'diff', '--', path)

/**
 * An app at 3.0.0 that ejected `widget` through `eject` and synced once, committed. `formatter`
 * declares oxfmt (with its bin linked) so `sync` resolves it; without, the merge runs raw.
 */
export function makeFixture({ formatter = true }: { formatter?: boolean } = {}): Fixture {
  const pkg = tmp('basalt-matrix-pkg-')
  cpSync(FIXTURE_PKG, pkg, { recursive: true })
  bump(pkg, '3.0.0', text(SEED_V1), GUARD_V1)

  const app = tmp('basalt-matrix-app-')
  put(
    app,
    'package.json',
    JSON.stringify({ name: 'app', devDependencies: formatter ? { oxfmt: '*' } : {} }),
  )
  if (formatter) {
    mkdirSync(join(app, 'node_modules/.bin'), { recursive: true })
    symlinkSync(OXFMT, join(app, 'node_modules/.bin/oxfmt'))
  }
  put(app, '.gitignore', 'node_modules\n')
  put(
    app,
    'vite.config.ts',
    "import { basalt } from 'basalt-ui/vite'\nexport default { plugins: [basalt()] }\n",
  )
  put(app, 'tsconfig.json', '{\n  "compilerOptions": {\n    "strict": true\n  }\n}\n')
  const manifest: Manifest = {
    profile: 'parts',
    version: '3.0.0',
    roots: { src: 'parts' },
    ejected: {},
    managed: {},
    deepRender: [],
    authoredContent: [],
    viewports: [],
    tokens: [],
    rest: {},
  }
  writeManifest(app, manifest)
  const ejectRun = capture(() => eject(['widget', '--reason', 'dense rows'], app, { pkgRoot: pkg }))
  if (ejectRun.code !== 0) throw new Error(`fixture eject failed:\n${ejectRun.log}`)
  const first = runSync({ app, pkg })
  if (first.code !== 0) throw new Error(`fixture sync failed:\n${first.log}`)
  git(app, 'init', '-q')
  commit(app)
  return { app, pkg }
}

export const read = (f: Fixture, rel: string): string => readFileSync(join(f.app, rel), 'utf8')
export const write = (f: Fixture, rel: string, content: string): void => put(f.app, rel, content)

/** The header line eject wrote, and the body under it. */
export function split(content: string): { header: string; body: string } {
  const at = content.indexOf('\n')
  return { header: content.slice(0, at), body: content.slice(at + 1) }
}

export function row(f: Fixture): Record<string, unknown> {
  const read = readManifest(f.app)
  if (read === null || 'error' in read) throw new Error('no manifest')
  return read.manifest.ejected[KEY] ?? {}
}

export function editRow(f: Fixture, patch: Record<string, unknown>): void {
  const read = readManifest(f.app)
  if (read === null || 'error' in read) throw new Error('no manifest')
  const m = read.manifest
  writeManifest(f.app, { ...m, ejected: { ...m.ejected, [KEY]: { ...m.ejected[KEY], ...patch } } })
}

/** Every file of the app (no `.git`, no `node_modules`) as relative path -> bytes. */
export function snapshot(dir: string, root = dir, out = new Map<string, string>()) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) snapshot(abs, root, out)
    else out.set(abs.slice(root.length + 1), readFileSync(abs, 'utf8'))
  }
  return out
}
