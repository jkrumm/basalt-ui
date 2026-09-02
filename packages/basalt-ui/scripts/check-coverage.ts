/**
 * `check-coverage` — the 11 assertions (SURFACES consistency + the agent-layer line budgets), and
 * the generated `<!-- basalt:coverage -->` header each rule file carries
 * (docs/CONTROLS-SPEC.md §7).
 *
 * A repo-internal script, not a shipped CLI subcommand — nothing outside this repo's own tooling
 * ever invoked `basalt-ui check-coverage`, and every assertion below reads paths relative to THIS
 * package root, never a consumer's. Moved out of `src/cli/index.ts` (C2) to shrink the published
 * CLI's surface to what a consumer actually runs.
 *
 * The block exists because a rule file's own claim about what enforces it was prose, and prose
 * drifted: a doc could name a guard kind and stay silent about the oxlint rule doing the real work,
 * or claim coverage for a law nothing checks (D8). Generating it from SURFACES makes the claim a
 * projection of the registry, and `--check` makes a stale claim a build failure.
 *
 * Usage: bun scripts/check-coverage.ts [--write|--check]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { GUARD_RULES } from '../src/guard'
import {
  PLUGIN_RULE_ID_LIST,
  RULE_NAMES,
  SKILL_NAMES,
  SURFACES,
  TOKEN_LAYER_BOUNDARY_SURFACES,
} from '../src/surfaces'
import type { DoctrineSpec, RuleName, SurfaceSpec } from '../src/surfaces'

const PKG_ROOT = join(import.meta.dir, '..')

// ──────────────────────────────────────────────────────────────────────────────
// coverage headers — the generated `<!-- basalt:coverage -->` block per rule file
// ──────────────────────────────────────────────────────────────────────────────

/** The block's delimiters. Both are HTML comments, so the block renders as nothing in a viewer. */
export const COVERAGE_BLOCK_OPEN = '<!-- basalt:coverage -->'
export const COVERAGE_BLOCK_CLOSE = '<!-- /basalt:coverage -->'

const COVERAGE_BLOCK_RE = /<!-- basalt:coverage -->[\s\S]*?<!-- \/basalt:coverage -->/

/**
 * What actually enforces one rule file's doctrine, as the file itself should state it.
 *
 * Derived from SURFACES — the union over every doctrine surface carrying that `rule`, because
 * `rule` is many-to-one (`data` covers `./data`, `./data/table`, `./data/virtual`; `mantine` covers
 * `.` and `./connectivity`). Naming only one surface's coverage would understate the rule.
 */
export function coverageFor(rule: RuleName): {
  guardKinds: string[]
  pluginRules: string[]
  advisoryLaws: string[]
} {
  const specs = (Object.values(SURFACES) as SurfaceSpec[]).filter(
    (s): s is DoctrineSpec => s.kind === 'doctrine' && s.rule === rule,
  )
  const unique = (values: readonly string[]): string[] => [...new Set(values)].toSorted()
  return {
    guardKinds: unique(specs.flatMap((s) => [...s.guardKinds])),
    pluginRules: unique(specs.flatMap((s) => [...s.pluginRules])),
    // NOT sorted, and not deduped across surfaces by content: an advisory law is a sentence, and
    // its order is the order the spec argues it in.
    advisoryLaws: specs.flatMap((s) => [...(s.advisoryLaws ?? [])]),
  }
}

/**
 * The generated block for one rule, verbatim — HTML comments only, one claim per line so a diff
 * points at the claim that changed rather than at a reflowed paragraph.
 *
 * `not guarded` is printed even when empty, and that is the point: a rule file whose block says
 * `not guarded: —` is claiming full coverage, which is a claim someone can check. A block that
 * simply omitted the section would read as "nothing to declare" whether or not anyone had looked
 * (D8 — see docs/CONTROLS-SPEC.md §6 "Honest coverage").
 */
export function coverageBlock(rule: RuleName): string {
  const { guardKinds, pluginRules, advisoryLaws } = coverageFor(rule)
  const backedBy = [
    guardKinds.length > 0 ? `guard kinds — ${guardKinds.join(', ')}` : 'guard kinds — none',
    pluginRules.length > 0
      ? `oxlint rules — ${pluginRules.map((id) => `basalt/${id}`).join(', ')}`
      : 'oxlint rules — none',
  ].join(' · ')
  const lines = [
    COVERAGE_BLOCK_OPEN,
    '<!-- GENERATED from src/surfaces.ts — `bun scripts/check-coverage.ts --write`. Do not hand-edit. -->',
    `<!-- backed by: ${backedBy} -->`,
  ]
  if (advisoryLaws.length === 0) lines.push('<!-- not guarded: — -->')
  else for (const law of advisoryLaws) lines.push(`<!-- not guarded: ${law} -->`)
  lines.push(COVERAGE_BLOCK_CLOSE)
  return lines.join('\n')
}

/** The block a rule file currently carries, or null when it has none yet. */
export function readCoverageBlock(text: string): string | null {
  return COVERAGE_BLOCK_RE.exec(text)?.[0] ?? null
}

/**
 * `text` with `block` in it — replacing the existing block, or inserted directly below the YAML
 * frontmatter (the rule files' `paths:` header is load-bearing and must stay first).
 */
export function applyCoverageBlock(text: string, block: string): string {
  if (COVERAGE_BLOCK_RE.test(text)) return text.replace(COVERAGE_BLOCK_RE, block)
  const frontmatter = /^---\n[\s\S]*?\n---\n/.exec(text)
  if (frontmatter === null) return `${block}\n\n${text}`
  const end = frontmatter[0].length
  return `${text.slice(0, end)}\n${block}\n${text.slice(end)}`
}

/**
 * Reconcile every rule file's coverage block against SURFACES.
 *
 * `'write'` refreshes them; `'check'` is the CI gate. A rule file with NO block yet is REPORTED,
 * never failed — the blocks are inserted by the agent-layer wave that rewrites those files, and a
 * gate that failed before they exist would have to be landed disabled, which is how a gate stays
 * disabled. A block that exists and DISAGREES is a hard failure: that is drift, and drift in a
 * coverage claim is the defect the block was added for.
 */
export function reconcileCoverageBlocks(
  pkgRoot: string,
  mode: 'write' | 'check',
): { failures: string[]; notes: string[] } {
  const failures: string[] = []
  const notes: string[] = []
  for (const rule of RULE_NAMES) {
    const rel = `agent/rules/basalt-${rule}.md`
    const path = resolve(pkgRoot, rel)
    if (!existsSync(path)) continue // assertion 2 already reports a missing rule file
    const text = readFileSync(path, 'utf8')
    const current = readCoverageBlock(text)
    const expected = coverageBlock(rule)
    if (mode === 'check') {
      if (current === null) notes.push(`${rel}: no <!-- basalt:coverage --> block yet`)
      else if (current !== expected) {
        failures.push(
          `${rel}: coverage block is out of sync with SURFACES (check-coverage --write)`,
        )
      }
      continue
    }
    if (current === expected) {
      notes.push(`${rel}: unchanged`)
      continue
    }
    writeFileSync(path, applyCoverageBlock(text, expected), 'utf8')
    notes.push(`${rel}: ${current === null ? 'block inserted' : 'block updated'}`)
  }
  return { failures, notes }
}

// ──────────────────────────────────────────────────────────────────────────────
// check-coverage — 11-assertion coverage gate
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Per-file line budgets for the shipped agent layer (`docs/CONTROLS-SPEC.md` §7's target table).
 *
 * A budget, not a guideline: seven `src/**`-scoped rules loaded ~2,000 lines on any source edit
 * before the merge, and 55% of that text was doctrine nothing enforced. The numbers are the bar the
 * spec argued, so they live beside the gate that reads them rather than in prose.
 */
const AGENT_LINE_BUDGETS: Readonly<Record<string, number>> = {
  'agent/rules/basalt-tokens.md': 140,
  'agent/rules/basalt-mantine.md': 125,
  'agent/rules/basalt-charts.md': 115,
  'agent/rules/basalt-state.md': 125,
  'agent/rules/basalt-controls.md': 155,
  'agent/rules/basalt-batteries.md': 100,
  'agent/skills/basalt-app/SKILL.md': 100,
  'agent/skills/basalt-design/SKILL.md': 100,
  'agent/skills/basalt-charts/SKILL.md': 100,
  'agent/templates/CLAUDE-block.md.tpl': 40,
  'agent/templates/DESIGN.md.tpl': 45,
}

/** The whole-layer bar — a per-file budget alone can be satisfied by adding a seventh rule file. */
const AGENT_RULE_TOTAL_BUDGET = 750

/**
 * Assert the 11 invariants against the live SURFACES + GUARD_RULES + the shipped agent layer, and
 * (with `--write` / `--check`) reconcile the generated `<!-- basalt:coverage -->` header of every
 * rule file against SURFACES. Returns 0 when all pass; 1 when any fail (console.error each failure).
 *
 * Eleven assertions:
 *  1. Every doctrine spec's guardKinds ⊆ keyof GUARD_RULES.
 *  2. Every doctrine rule (deduped) maps to agent/rules/basalt-{rule}.md on disk.
 *  3. Every doctrine skill (deduped) maps to agent/skills/{skill}/SKILL.md on disk.
 *  4. Every non-#, non-'.' JS-subpath SURFACES key has a package.json exports entry.
 *  5. Every real package.json exports key has a SURFACES entry.
 *  6. Every surface with non-empty forbiddenImports has a globs field.
 *  7. Every headless surface is Mantine-free — via all 3 `forbiddenImports` bans, OR (for
 *     `TOKEN_LAYER_BOUNDARY_SURFACES` members, `./charts`/`./tokens`) exemption, since their
 *     Mantine-free guarantee is covered by the repo-local-only `basalt/token-layer-boundary`
 *     plugin rule instead — this assertion cannot verify that rule's live registration itself (see
 *     the assertion's own comment below for why); basalt's own CI does
 *     (`tests/surfaces-coverage.test.ts`).
 *  8. Every doctrine optionalPeers entry exists in peerDependencies AND peerDependenciesMeta.
 *  9. Every registered oxlint plugin rule (PLUGIN_RULE_ID_LIST) maps to EXACTLY ONE surface's
 *     `pluginRules` — so a new rule cannot ship homeless, and one rule cannot be counted twice as
 *     coverage. Like assertion 7 this reads SURFACES only: whether the plugin really registers
 *     those ids is asserted against the plugin itself in `configs/oxlint-plugin.test.ts`.
 * 10. Every shipped agent-layer file is inside its line budget, and the six rules are inside the
 *     whole-layer total (`AGENT_LINE_BUDGETS` / `AGENT_RULE_TOTAL_BUDGET`).
 * 11. Every `GUARD_RULES` kind appears on at least one doctrine surface — assertion 9's twin for
 *     the text lane. Without it a kind could ship, be documented as a law in the spec, and be
 *     omitted from every generated coverage header. Unlike 9 this is one-directional: a kind may
 *     legitimately appear on SEVERAL surfaces (`raw-hex` is on `./charts` and `./tokens`), because
 *     a text scan is not partitioned by subpath the way a plugin rule id is.
 *
 * Tooling surfaces are exempt from assertions 1–3 by the discriminant.
 * Synthetic #-keys participate in assertions 1 and 2 but feed assertion 3 only
 * via the deduped skill union (no independent per-#-surface skill row).
 */
export function checkCoverage(flags: readonly string[] = [], pkgRoot: string = PKG_ROOT): number {
  const failures: string[] = []
  const notes: string[] = []

  const allSpecs = Object.entries(SURFACES) as [string, SurfaceSpec][]
  const doctrineSpecs = (Object.values(SURFACES) as SurfaceSpec[]).filter(
    (s): s is DoctrineSpec => s.kind === 'doctrine',
  )

  // ── Assertion 1: every doctrine spec's guardKinds ⊆ keyof GUARD_RULES ──────
  const validGuardKinds = new Set(Object.keys(GUARD_RULES))
  for (const [key, spec] of allSpecs) {
    if (spec.kind !== 'doctrine') continue
    for (const kind of spec.guardKinds) {
      if (!validGuardKinds.has(kind)) {
        failures.push(
          `SURFACES['${key}'].guardKinds includes '${kind}' which is not in GUARD_RULES`,
        )
      }
    }
  }

  // ── Assertion 2: every doctrine rule (deduped) → agent/rules/basalt-{rule}.md ──
  for (const rule of RULE_NAMES) {
    const rulePath = resolve(pkgRoot, `agent/rules/basalt-${rule}.md`)
    if (!existsSync(rulePath)) {
      failures.push(
        `Missing rule file: agent/rules/basalt-${rule}.md (derived from SURFACES doctrine rules)`,
      )
    }
  }

  // ── Assertion 3: every doctrine skill (deduped) → agent/skills/{skill}/SKILL.md ──
  for (const skill of SKILL_NAMES) {
    const skillPath = resolve(pkgRoot, `agent/skills/${skill}/SKILL.md`)
    if (!existsSync(skillPath)) {
      failures.push(
        `Missing skill file: agent/skills/${skill}/SKILL.md (derived from SURFACES doctrine skills)`,
      )
    }
  }

  // ── Assertion 4: subpath-export-coverage ────────────────────────────────────
  let pkgExports: Set<string> = new Set()
  try {
    const consumerPkgPath = resolve(pkgRoot, 'package.json')
    const consumerPkg = JSON.parse(readFileSync(consumerPkgPath, 'utf8')) as {
      exports?: Record<string, unknown>
    }
    pkgExports = new Set(Object.keys(consumerPkg.exports ?? {}))
  } catch {
    failures.push(`Cannot read package.json at ${pkgRoot}`)
  }

  for (const key of Object.keys(SURFACES)) {
    if (key.startsWith('#') || key === '.') continue
    if (!pkgExports.has(key)) {
      failures.push(
        `SURFACES key '${key}' is a JS subpath but has no entry in package.json exports`,
      )
    }
  }

  // ── Assertion 5: every real package.json exports key has a SURFACES entry ────
  for (const exportKey of pkgExports) {
    if (
      exportKey === '.' ||
      exportKey === './styles.css' ||
      exportKey === './package.json' ||
      exportKey.startsWith('./configs/')
    )
      continue
    if (!Object.hasOwn(SURFACES, exportKey)) {
      failures.push(`package.json exports key '${exportKey}' has no matching SURFACES entry`)
    }
  }

  // ── Assertion 6: every surface with non-empty forbiddenImports has a globs field ──
  for (const [key, spec] of allSpecs) {
    if (spec.forbiddenImports.length === 0) continue
    if (!('globs' in spec) || spec.globs === undefined) {
      failures.push(
        `SURFACES['${key}'] has non-empty forbiddenImports but no globs field (required for oxlint emission)`,
      )
    }
  }

  // ── Assertion 7: every headless surface is Mantine-free ──────────────────────
  const REQUIRED_MANTINE_BANS = ['@mantine/core', '@mantine/hooks', '@mantine/*'] as const

  for (const [key, spec] of allSpecs) {
    if (spec.layer !== 'headless') continue
    if (TOKEN_LAYER_BOUNDARY_SURFACES.has(key)) continue
    for (const required of REQUIRED_MANTINE_BANS) {
      const hasBan = spec.forbiddenImports.some((fi) => fi.spec === required)
      if (!hasBan) {
        failures.push(
          `SURFACES['${key}'] is headless but missing Mantine ban for '${required}' in forbiddenImports`,
        )
      }
    }
  }

  // ── Assertion 8: every doctrine optionalPeers entry → peerDependencies + peerDependenciesMeta ──
  let peerDependencies: Record<string, string> = {}
  let peerDependenciesMeta: Record<string, { optional?: boolean }> = {}
  try {
    const frameworkPkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8')) as {
      peerDependencies?: Record<string, string>
      peerDependenciesMeta?: Record<string, { optional?: boolean }>
    }
    peerDependencies = frameworkPkg.peerDependencies ?? {}
    peerDependenciesMeta = frameworkPkg.peerDependenciesMeta ?? {}
  } catch {
    failures.push(`Cannot read package.json peerDependencies at ${pkgRoot}`)
  }

  for (const spec of doctrineSpecs) {
    for (const peer of spec.optionalPeers ?? []) {
      if (!(peer in peerDependencies)) {
        failures.push(
          `SURFACES doctrine optionalPeer '${peer}' is not listed in package.json peerDependencies`,
        )
      }
      if (peerDependenciesMeta[peer]?.optional !== true) {
        failures.push(
          `SURFACES doctrine optionalPeer '${peer}' is not marked optional in package.json peerDependenciesMeta`,
        )
      }
    }
  }

  // ── Assertion 9: every plugin rule maps to exactly one surface ───────────────
  const surfacesPerPluginRule = new Map<string, string[]>()
  for (const [key, spec] of allSpecs) {
    if (spec.kind !== 'doctrine') continue
    for (const id of spec.pluginRules) {
      surfacesPerPluginRule.set(id, [...(surfacesPerPluginRule.get(id) ?? []), key])
    }
  }
  for (const id of PLUGIN_RULE_ID_LIST) {
    const owners = surfacesPerPluginRule.get(id) ?? []
    if (owners.length === 1) continue
    failures.push(
      owners.length === 0
        ? `Plugin rule 'basalt/${id}' maps to no surface — add it to one surface's pluginRules`
        : `Plugin rule 'basalt/${id}' maps to ${owners.length} surfaces (${owners.join(', ')}) — exactly one`,
    )
  }

  // ── Assertion 10: the agent layer stays inside its line budgets ─────────────
  for (const [rel, budget] of Object.entries(AGENT_LINE_BUDGETS)) {
    const abs = resolve(pkgRoot, rel)
    if (!existsSync(abs)) continue // assertions 2/3 already report a missing rule or skill
    const lines = readFileSync(abs, 'utf8').split('\n').length - 1
    if (lines > budget) failures.push(`${rel}: ${lines} lines exceeds its ${budget}-line budget`)
  }
  const ruleTotal = RULE_NAMES.reduce((sum, rule) => {
    const abs = resolve(pkgRoot, `agent/rules/basalt-${rule}.md`)
    return existsSync(abs) ? sum + readFileSync(abs, 'utf8').split('\n').length - 1 : sum
  }, 0)
  if (ruleTotal > AGENT_RULE_TOTAL_BUDGET) {
    failures.push(
      `agent/rules/*.md: ${ruleTotal} lines total exceeds the ${AGENT_RULE_TOTAL_BUDGET}-line budget`,
    )
  }

  // ── Assertion 11: every guard kind maps to at least one surface ──────────────
  const surfacedGuardKinds = new Set<string>()
  for (const spec of doctrineSpecs) {
    for (const kind of spec.guardKinds) surfacedGuardKinds.add(kind)
  }
  for (const kind of Object.keys(GUARD_RULES)) {
    if (surfacedGuardKinds.has(kind)) continue
    failures.push(
      `Guard kind '${kind}' maps to no surface — add it to one surface's guardKinds so the ` +
        `generated coverage headers name it`,
    )
  }

  // ── Coverage headers (--write / --check) ─────────────────────────────────────
  const write = flags.includes('--write')
  const check = flags.includes('--check')
  if (write && check) {
    failures.push('--write and --check are alternatives; pass one')
  } else if (write || check) {
    const result = reconcileCoverageBlocks(pkgRoot, write ? 'write' : 'check')
    failures.push(...result.failures)
    notes.push(...result.notes)
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  for (const note of notes) {
    console.log(`  ${note}`)
  }

  if (failures.length === 0) {
    console.log('✓ check-coverage: all 11 assertions pass.')
    return 0
  }

  console.error(`✖ check-coverage: ${failures.length} failure(s)`)
  for (const f of failures) {
    console.error(`  ${f}`)
  }
  return 1
}

if (import.meta.main) {
  process.exit(checkCoverage(process.argv.slice(2)))
}
