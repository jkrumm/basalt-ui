/**
 * Builds eject fixtures in a temp dir: a consumer shape copied from `consumers/<name>`, with a
 * `node_modules/basalt-ui` made of the miniature `pkg/` plus the REAL seeds, guards and `cn` from
 * this package's `src/` (what the tarball ships), and links to the peers the build needs.
 */
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { eject } from '../../../src/cli/eject'
import { seedNames } from '../../../src/cli/merge/seed'

export const FIXTURES = dirname(fileURLToPath(import.meta.url))
export const PKG_ROOT = join(FIXTURES, '../../..')
const PEERS = [
  'react',
  'react-dom',
  '@base-ui/react',
  'class-variance-authority',
  'clsx',
  '@types/react',
  '@types/react-dom',
]

const scratch: string[] = []

export function cleanup(): void {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
}

/** The installed miniature package; `seeds` limits which real primitives it ships. */
function installPackage(consumer: string, seeds: readonly string[]): string {
  const pkg = join(consumer, 'node_modules/basalt-ui')
  cpSync(join(FIXTURES, 'pkg'), pkg, { recursive: true })
  mkdirSync(join(pkg, 'src/ui'), { recursive: true })
  mkdirSync(join(pkg, 'src/core'), { recursive: true })
  for (const name of seeds) {
    cpSync(join(PKG_ROOT, 'src/ui', `${name}.tsx`), join(pkg, 'src/ui', `${name}.tsx`))
    const guard = join(PKG_ROOT, 'src/ui', `${name}.guard.ts`)
    try {
      cpSync(guard, join(pkg, 'src/ui', `${name}.guard.ts`))
    } catch {
      // no guard ships for this primitive
    }
  }
  for (const file of ['cn.ts', 'cn-theme.ts']) {
    cpSync(join(PKG_ROOT, 'src/core', file), join(pkg, 'src/core', file))
  }
  for (const peer of PEERS) {
    const at = join(consumer, 'node_modules', peer)
    mkdirSync(dirname(at), { recursive: true })
    symlinkSync(realpathSync(join(PKG_ROOT, 'node_modules', peer)), at)
  }
  return pkg
}

export type Fixture = { dir: string; pkg: string }

/**
 * A consumer copy with the package installed. `git` makes it a repository with everything
 * committed on `main` (then `feature` checked out, so the merge base is that first commit).
 */
export function makeConsumer(
  name: string,
  opts: { git?: boolean; seeds?: readonly string[] } = {},
): Fixture {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `basalt-eject-${name}-`)))
  scratch.push(dir)
  cpSync(join(FIXTURES, 'consumers', name), dir, { recursive: true })
  writeFileSync(join(dir, '.gitignore'), 'node_modules\ndist\ndist-ssr\n')
  const pkg = installPackage(dir, opts.seeds ?? seedNames(PKG_ROOT))
  if (opts.git === true) {
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', 'fixture')
    git(dir, 'checkout', '-q', '-b', 'feature')
  }
  return { dir, pkg }
}

export function git(dir: string, ...args: string[]): string {
  const run = spawnSync(
    'git',
    ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', ...args],
    { cwd: dir, encoding: 'utf8' },
  )
  if (run.status !== 0) throw new Error(`git ${args.join(' ')}: ${run.stderr}`)
  return run.stdout
}

/** Stages and commits everything (node_modules and build output are gitignored). */
export function commitAll(dir: string, message: string): void {
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', message)
}

export type Run = { code: number; log: string }

export function run(fixture: Fixture, flags: string[], cwd: string = fixture.dir): Run {
  const saved = { log: console.log, error: console.error }
  let log = ''
  const sink = (...args: unknown[]): void => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    return { code: eject(flags, cwd, { pkgRoot: fixture.pkg }), log }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

const SKIP = new Set(['.git', 'node_modules', 'dist', 'dist-ssr'])

/** Every file under `dir` outside .git, node_modules and build output, as relative path -> bytes. */
export function snapshot(
  dir: string,
  root = dir,
  out = new Map<string, string>(),
): Map<string, string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) snapshot(abs, root, out)
    else out.set(abs.slice(root.length + 1), readFileSync(abs, 'utf8'))
  }
  return out
}

export const read = (dir: string, rel: string): string => readFileSync(join(dir, rel), 'utf8')
