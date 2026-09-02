/**
 * Installs basalt-ui's OWN shipped rules + skills into this repo's `/.claude/` — the dogfood half
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

const RULES_SRC = join(PKG_ROOT, 'agent/rules')
const RULES_DEST = join(REPO_ROOT, '.claude/rules')
const SKILLS_SRC = join(PKG_ROOT, 'agent/skills')
const SKILLS_DEST = join(REPO_ROOT, '.claude/skills')

function syncRules(): number {
  mkdirSync(RULES_DEST, { recursive: true })
  const files = readdirSync(RULES_SRC).filter((name) => name.endsWith('.md'))
  for (const name of files) copyFileSync(join(RULES_SRC, name), join(RULES_DEST, name))
  return files.length
}

function syncSkills(): number {
  const skillDirs = readdirSync(SKILLS_SRC, { withFileTypes: true }).filter((e) => e.isDirectory())
  for (const dir of skillDirs) {
    const dest = join(SKILLS_DEST, dir.name)
    mkdirSync(dest, { recursive: true })
    copyFileSync(join(SKILLS_SRC, dir.name, 'SKILL.md'), join(dest, 'SKILL.md'))
  }
  return skillDirs.length
}

/**
 * Deletes `.claude/rules/basalt-*.md` files and `.claude/skills/basalt-*` directories whose
 * source no longer exists under `agent/`. A plain copy (see the module doc) never removes a stale
 * file on its own — a rule or skill dropped from `agent/rules`/`agent/skills` stayed installed
 * here forever, which is how a retired doctrine kept being read as live long after it stopped
 * shipping.
 */
function pruneOrphans(): number {
  let pruned = 0

  if (existsSync(RULES_DEST)) {
    const installed = readdirSync(RULES_DEST).filter(
      (name) => name.startsWith('basalt-') && name.endsWith('.md'),
    )
    for (const name of installed) {
      if (existsSync(join(RULES_SRC, name))) continue
      rmSync(join(RULES_DEST, name))
      pruned++
    }
  }

  if (existsSync(SKILLS_DEST)) {
    const installed = readdirSync(SKILLS_DEST, { withFileTypes: true }).filter(
      (e) => e.isDirectory() && e.name.startsWith('basalt-'),
    )
    for (const dir of installed) {
      if (existsSync(join(SKILLS_SRC, dir.name))) continue
      rmSync(join(SKILLS_DEST, dir.name), { recursive: true })
      pruned++
    }
  }

  return pruned
}

function main(): void {
  const ruleCount = syncRules()
  const skillCount = syncSkills()
  const prunedCount = pruneOrphans()
  console.log(
    `✓ sync-self: ${ruleCount} rule(s) → .claude/rules, ${skillCount} skill(s) → .claude/skills` +
      (prunedCount > 0 ? `, ${prunedCount} orphan(s) pruned` : ''),
  )
}

main()
