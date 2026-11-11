/**
 * Builds `basalt()` fixtures in a temp dir: a consumer copied from `consumers/<name>`, with a
 * `node_modules/basalt-ui` made of the miniature `pkg/` (a `./cards` composite) plus the REAL seeds,
 * guards and `cn` from this package's `src/`, and links to only the peers the fixture asks for, so
 * a missing peer is really missing. `eject` writes what `basalt-ui eject` records, by hand, so the
 * fixtures do not depend on the CLI.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ejectHeader, withHeader } from '../../../src/cli/merge/header'
import { ejectedSource, readSeed } from '../../../src/cli/merge/seed'

export const FIXTURES = dirname(fileURLToPath(import.meta.url))
export const PKG_ROOT = join(FIXTURES, '../../..')

/** What a `parts` app installs beside basalt-ui. */
export const PARTS_PEERS = [
  'react',
  'react-dom',
  '@base-ui/react',
  'class-variance-authority',
  'clsx',
] as const

const scratch: string[] = []

export function cleanup(): void {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
}

function installPackage(app: string): string {
  const pkg = join(app, 'node_modules/basalt-ui')
  cpSync(join(FIXTURES, 'pkg'), pkg, { recursive: true })
  mkdirSync(join(pkg, 'src/ui'), { recursive: true })
  for (const file of readdirSync(join(PKG_ROOT, 'src/ui'))) {
    if (/^[a-z-]+\.(?:tsx|guard\.ts)$/.test(file)) {
      cpSync(join(PKG_ROOT, 'src/ui', file), join(pkg, 'src/ui', file))
    }
  }
  mkdirSync(join(pkg, 'src/core'), { recursive: true })
  for (const file of ['cn.ts', 'cn-theme.ts']) {
    cpSync(join(PKG_ROOT, 'src/core', file), join(pkg, 'src/core', file))
  }
  return pkg
}

export type App = { dir: string; pkg: string }

/** A consumer copy with basalt-ui installed and `peers` linked from this repo's install. */
export function makeApp(name: string, peers: readonly string[] = PARTS_PEERS): App {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `basalt-vite-${name}-`)))
  scratch.push(dir)
  cpSync(join(FIXTURES, 'consumers', name), dir, { recursive: true })
  const pkg = installPackage(dir)
  for (const peer of peers) {
    const at = join(dir, 'node_modules', peer)
    mkdirSync(dirname(at), { recursive: true })
    symlinkSync(realpathSync(join(PKG_ROOT, 'node_modules', peer)), at)
  }
  return { dir, pkg }
}

export const EDIT = 'data-local-edit="ejected"'

type ManifestJson = { ejected: Record<string, Record<string, unknown>> } & Record<string, unknown>

export function readManifest(app: App): ManifestJson {
  return JSON.parse(read(app.dir, '.basalt/manifest.json')) as ManifestJson
}

export function writeManifest(app: App, manifest: ManifestJson): void {
  writeFileSync(join(app.dir, '.basalt/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

/**
 * Ejects `name` into `src/components/ui/` the way `basalt-ui eject` does (header, rewritten seed,
 * manifest row with the installed digest), then edits it so a test can see which copy rendered.
 */
export function eject(app: App, name: string): void {
  const seed = readSeed(app.pkg, name)
  if (seed === null) throw new Error(`no seed ${name}`)
  const source = ejectedSource(seed.seed)
  if ('error' in source) throw new Error(source.error)
  const header = ejectHeader(name, '3.0.0-fixture', 'fixture')
  const file = join(app.dir, 'src/components/ui', `${name}.tsx`)
  mkdirSync(dirname(file), { recursive: true })
  const local = withHeader(header, source.text).replace(
    `data-slot="${name}"`,
    `data-slot="${name}" ${EDIT}`,
  )
  if (!local.includes(EDIT)) throw new Error(`${name}: no data-slot="${name}" to mark`)
  writeFileSync(file, local)
  const manifest = readManifest(app)
  manifest.ejected[`src#${name}`] = {
    path: `src/components/ui/${name}.tsx`,
    fromVersion: '3.0.0-fixture',
    seedDigest: seed.digest,
    reason: 'fixture',
    origin: 'seed',
  }
  writeManifest(app, manifest)
}

export const read = (dir: string, rel: string): string => readFileSync(join(dir, rel), 'utf8')
export const exists = (dir: string, rel: string): boolean => existsSync(join(dir, rel))
