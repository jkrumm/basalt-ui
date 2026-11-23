/**
 * Moves every workspace dependency that is a peer of `basalt-ui` to the newest version its declared
 * peer range admits, so the scheduled newest-peers job (.github/workflows/newest-peers.yml) tests what
 * a consumer gets on a fresh install. It edits package.json files in the CI checkout only; the job
 * never commits. Prints one `name old -> new` line per change.
 *
 * Usage: bun scripts/newest-peers.ts [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FIELDS = ['dependencies', 'devDependencies'] as const

/** The newest stable version in `versions` that `range` admits, or null. */
export function newestInRange(versions: readonly string[], range: string): string | null {
  const stable = versions.filter((v) => /^\d+\.\d+\.\d+$/.test(v) && Bun.semver.satisfies(v, range))
  return stable.toSorted((a, b) => Bun.semver.order(a, b)).at(-1) ?? null
}

type Manifest = Record<string, unknown> & {
  peerDependencies?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

async function registryVersions(name: string): Promise<string[]> {
  const run = Bun.spawnSync(['npm', 'view', name, 'versions', '--json'])
  if (run.exitCode !== 0) throw new Error(`npm view ${name} failed: ${run.stderr.toString()}`)
  const parsed: unknown = JSON.parse(run.stdout.toString())
  return Array.isArray(parsed) ? (parsed as string[]) : [String(parsed)]
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry')
  const root = join(import.meta.dirname, '..')
  const pkgPath = join(root, 'packages/basalt-ui/package.json')
  const peers = (JSON.parse(readFileSync(pkgPath, 'utf8')) as Manifest).peerDependencies ?? {}
  const workspaces = [
    'package.json',
    'packages/basalt-ui/package.json',
    ...[...new Bun.Glob('apps/*/package.json').scanSync({ cwd: root })].toSorted(),
  ]

  const newest = new Map<string, string>()
  for (const [name, range] of Object.entries(peers)) {
    const version = newestInRange(await registryVersions(name), range)
    if (version === null) throw new Error(`no stable ${name} satisfies ${range}`)
    newest.set(name, version)
  }

  for (const rel of workspaces) {
    const path = join(root, rel)
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as Manifest
    let changed = false
    for (const field of FIELDS) {
      const deps = manifest[field]
      if (deps === undefined) continue
      for (const [name, current] of Object.entries(deps)) {
        const next = newest.get(name)
        if (next === undefined || current === next || current.startsWith('workspace:')) continue
        console.log(`${rel} ${name} ${current} -> ${next}`)
        deps[name] = next
        changed = true
      }
    }
    if (changed && !dry) writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
  }
}

if (import.meta.main) await main()
