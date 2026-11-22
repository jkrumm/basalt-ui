/**
 * Links basalt-ui's OWN shipped rules, skills and subagents into this repo's `/.claude/`, the dogfood half
 * of C2 (`.claude/maturation/consolidation-plan.md`, "Dogfood"): an agent editing `packages/basalt-ui/src/**`
 * reads the law the package ships to every consumer (`agent/rules/*.md`, each skill's `agent/skills/<name>/`).
 *
 * Each entry is a relative symlink to its shipped source, not a copy. A copy was a second committed file that every
 * skill edit had to resync and that conflicted on every rebase of two branches touching the same skill (about one
 * commit in twenty on master in the week from 2026-11-15); a link carries the shipped bytes by construction and
 * never changes. Claude Code follows symlinked rules and skill directories.
 *
 * Deliberately NOT `basalt-ui sync` (`src/cli`'s consumer command): that command reconciles a CONSUMER's copy
 * against a published version, with three-way discipline for locally-edited files and a prune pass for namespaces
 * a newer basalt no longer ships. This repo is not a consumer of itself.
 *
 * `tests/drift.test.ts`'s "sync-self" block asserts every shipped entry is linked and nothing else is.
 *
 * Usage: bun packages/basalt-ui/scripts/sync-self.ts [--check]
 *   --check writes nothing and exits 1 when an entry is not a link to its source, is missing or is an orphan.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import { SIBLING_PREFIX } from '../src/cli/sync/sibling'

const PKG_ROOT = join(import.meta.dir, '..')
const REPO_ROOT = join(PKG_ROOT, '..', '..')

/** One row per linked namespace: `unit` is what a source entry is, a file (`rule.md`) or a skill directory. */
const NAMESPACES = [
  { name: 'rule', dir: 'rules', from: 'rules', unit: 'file' },
  { name: 'skill', dir: 'skills', from: 'skills', unit: 'dir' },
  { name: 'agent', dir: 'agents', from: 'reviewer', unit: 'file' },
] as const

type Namespace = (typeof NAMESPACES)[number]

/** The shipped entries of a namespace: `basalt-*.md` files, or the skill directories. */
function shippedOf(ns: Namespace): string[] {
  const src = join(PKG_ROOT, 'agent', ns.from)
  if (!existsSync(src)) throw new Error(`sync-self: shipped source dir missing: ${src}`)
  return readdirSync(src, { withFileTypes: true })
    .filter((e) =>
      ns.unit === 'dir' ? e.isDirectory() : e.name.startsWith('basalt-') && e.name.endsWith('.md'),
    )
    .map((e) => e.name)
    .toSorted()
}

/** The `basalt-*` entries this sync owns in `/.claude/<dir>`: a sibling install's `basalt-v3-*` placements are not. */
function ownedOf(ns: Namespace): string[] {
  const dest = join(REPO_ROOT, '.claude', ns.dir)
  if (!existsSync(dest)) return []
  return readdirSync(dest)
    .filter((name) => name.startsWith('basalt-') && !name.startsWith(SIBLING_PREFIX))
    .filter((name) => ns.unit === 'dir' || name.endsWith('.md'))
    .toSorted()
}

/** The link target of an entry, relative to the directory that holds the link. */
const targetOf = (ns: Namespace, name: string): string =>
  relative(join(REPO_ROOT, '.claude', ns.dir), join(PKG_ROOT, 'agent', ns.from, name))

/** Where a link points, or null when the path is not a link. */
function linkedTo(path: string): string | null {
  return lstatSafe(path)?.isSymbolicLink() ? readlinkSync(path) : null
}

function lstatSafe(path: string): ReturnType<typeof lstatSync> | null {
  try {
    return lstatSync(path)
  } catch {
    return null
  }
}

/** What is out of place: a shipped entry not linked to its source, and an owned entry with no source. */
export function drift(): string[] {
  const out: string[] = []
  for (const ns of NAMESPACES) {
    const shipped = shippedOf(ns)
    for (const name of shipped) {
      const path = join('.claude', ns.dir, name)
      const link = linkedTo(join(REPO_ROOT, path))
      if (link !== targetOf(ns, name))
        out.push(
          `${path}: ${link === null ? 'not a link' : `links to ${link}`}, want ${targetOf(ns, name)}`,
        )
    }
    for (const name of ownedOf(ns))
      if (!shipped.includes(name)) out.push(`.claude/${ns.dir}/${name}: no shipped source (orphan)`)
  }
  return out
}

function syncNamespace(ns: Namespace): { linked: number; pruned: number } {
  const dest = join(REPO_ROOT, '.claude', ns.dir)
  mkdirSync(dest, { recursive: true })
  const shipped = shippedOf(ns)
  for (const name of shipped) {
    const path = join(dest, name)
    if (linkedTo(path) === targetOf(ns, name)) continue
    rmSync(path, { recursive: true, force: true })
    symlinkSync(targetOf(ns, name), path)
  }
  // A rule, skill or agent dropped upstream must not stay installed here: that is how a retired doctrine kept being
  // read as live.
  const orphans = ownedOf(ns).filter((name) => !shipped.includes(name))
  for (const name of orphans) rmSync(join(dest, name), { recursive: true, force: true })
  return { linked: shipped.length, pruned: orphans.length }
}

if (import.meta.main) {
  if (process.argv.includes('--check')) {
    const out = drift()
    for (const line of out) console.error(`sync-self: ${line}`)
    if (out.length) {
      console.error('sync-self: run make sync-self')
      process.exit(1)
    }
    console.log('sync-self: every shipped rule, skill and agent is linked into .claude/')
  } else {
    const results = NAMESPACES.map((ns) => ({ ns, ...syncNamespace(ns) }))
    const pruned = results.reduce((sum, r) => sum + r.pruned, 0)
    console.log(
      `sync-self: ${results.map((r) => `${r.linked} ${r.ns.name}(s) linked in .claude/${r.ns.dir}`).join(', ')}` +
        (pruned > 0 ? `, ${pruned} orphan(s) pruned` : ''),
    )
  }
}
