/**
 * Installs basalt-ui's OWN shipped rules, skills and subagents into this repo's `/.claude/` — the dogfood half
 * of C2 (`.claude/maturation/consolidation-plan.md`, "Dogfood"). Before this script, an agent
 * editing `packages/basalt-ui/src/**` never saw the 1,000+ lines of law the package ships to every
 * consumer (`agent/rules/*.md`, each skill's `agent/skills/<name>/SKILL.md`) — this repo carried
 * no `/.claude/rules/` and no `/.claude/skills/` at all.
 *
 * Deliberately NOT `basalt-ui sync` (`src/cli`'s consumer command): that command reconciles a
 * CONSUMER's copy against a published version, with three-way discipline for locally-edited files
 * and a prune pass for namespaces a newer basalt no longer ships. This repo is not a consumer of
 * itself — there is no version skew to reconcile, so a plain overwrite is correct and the extra
 * machinery would be dead weight here.
 *
 * A plain copy is also why `tests/drift.test.ts`'s "sync-self" describe block can assert
 * `/.claude/rules/basalt-*.md` BYTE-MATCHES `agent/rules/*.md` — the drift check reads as literally
 * as the mechanism that satisfies it.
 *
 * Usage: bun packages/basalt-ui/scripts/sync-self.ts
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const PKG_ROOT = join(import.meta.dir, '..')
const REPO_ROOT = join(PKG_ROOT, '..', '..')

/**
 * One row per installed namespace. `unit` is what a source entry is: a file (`rule.md`) or a
 * directory holding `SKILL.md`. Rules, skills and agents share one copy and one prune.
 */
const NAMESPACES = [
  { name: 'rule', dir: 'rules', unit: 'file' },
  { name: 'skill', dir: 'skills', unit: 'dir' },
  { name: 'agent', dir: 'agents', unit: 'file' },
] as const

function entries(root: string, unit: 'file' | 'dir'): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => (unit === 'dir' ? e.isDirectory() : e.name.endsWith('.md')))
    .map((e) => e.name)
}

/** Copy every shipped entry into `/.claude/<dir>`, then delete `basalt-*` entries with no source. */
function syncNamespace(dir: string, unit: 'file' | 'dir'): { copied: number; pruned: number } {
  const src = join(PKG_ROOT, 'agent', dir)
  const dest = join(REPO_ROOT, '.claude', dir)
  const shipped = entries(src, unit)
  mkdirSync(dest, { recursive: true })
  for (const name of shipped) {
    if (unit === 'file') copyFileSync(join(src, name), join(dest, name))
    else {
      mkdirSync(join(dest, name), { recursive: true })
      copyFileSync(join(src, name, 'SKILL.md'), join(dest, name, 'SKILL.md'))
    }
  }
  // A plain copy never removes a stale file: a rule, skill or agent dropped upstream stayed
  // installed here forever, which is how a retired doctrine kept being read as live.
  const orphans = entries(dest, unit).filter((n) => n.startsWith('basalt-') && !shipped.includes(n))
  for (const name of orphans) rmSync(join(dest, name), { recursive: true })
  return { copied: shipped.length, pruned: orphans.length }
}

function main(): void {
  const results = NAMESPACES.map((ns) => ({ ns, ...syncNamespace(ns.dir, ns.unit) }))
  const pruned = results.reduce((sum, r) => sum + r.pruned, 0)
  console.log(
    `✓ sync-self: ${results.map((r) => `${r.copied} ${r.ns.name}(s) → .claude/${r.ns.dir}`).join(', ')}` +
      (pruned > 0 ? `, ${pruned} orphan(s) pruned` : ''),
  )
}

main()
