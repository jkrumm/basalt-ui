/**
 * `check-coverage` — the 11 assertions (SURFACES consistency + the agent-layer shape and line
 * budgets).
 *
 * A repo-internal script, not a shipped CLI subcommand — nothing outside this repo's own tooling
 * ever invoked `basalt-ui check-coverage`, and every assertion below reads paths relative to THIS
 * package root, never a consumer's. Moved out of `src/cli/index.ts` (C2) to shrink the published
 * CLI's surface to what a consumer actually runs.
 *
 * What a rule file claims it is enforced by lives in the file itself since v3: every bullet ends in
 * `[lint:<id>]` or `[type:<name>]` or sits under `not guarded:`, and `check-rule-tags.ts` holds
 * that (called from `check-agent-doc-drift.ts`). The 2.x generated `<!-- basalt:coverage -->`
 * header projected `SURFACES` doctrine onto six rule files; it cannot hold for five files named by
 * the v3 tree, so it is retired and `--write` refuses.
 *
 * Usage: bun scripts/check-coverage.ts [--check]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { GUARD_RULES } from '../src/guard'
import {
  PLUGIN_RULE_ID_LIST,
  AGENT_NAMES,
  SKILL_NAMES,
  SURFACES,
  TOKEN_LAYER_BOUNDARY_SURFACES,
} from '../src/surfaces'
import type { DoctrineSpec, SurfaceSpec } from '../src/surfaces'

const PKG_ROOT = join(import.meta.dir, '..')

/**
 * The shipped rule files, the v3 tree (skills-agent-layer concept section 4.2). `agent/rules/`
 * lists exactly these; the SURFACES `rule` field still names the 2.x six and no longer drives it.
 */
export const SHIPPED_RULES: readonly string[] = [
  'basalt-tokens',
  'basalt-ui',
  'basalt-page',
  'basalt-state',
  'basalt-charts',
]

/** The five rule files together, never more (every session loads them: concept section 6). */
export const RULES_TOTAL_BUDGET = 230

/**
 * Plugin rules that exist for this repo's own source and never reach a consumer's `configs/`.
 * Check G of the drift gate bans naming them in a shipped agent file; the surface assertions still
 * count them, so none ships homeless.
 */
export const REPO_LOCAL_RULES: ReadonlySet<string> = new Set([
  'chart-host-single',
  'token-layer-boundary',
  'no-dev-helper',
  'no-import-meta-env',
])

// ──────────────────────────────────────────────────────────────────────────────
// check-coverage — 11-assertion coverage gate
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Per-file line budgets for the shipped agent layer, set to the landed values.
 *
 * A budget, not a guideline: the rules load into every session, so the numbers are the bar the
 * spec argued and live beside the gate that reads them rather than in prose.
 */
export const AGENT_LINE_BUDGETS: Readonly<Record<string, number>> = {
  'agent/rules/basalt-tokens.md': 45,
  'agent/rules/basalt-ui.md': 45,
  'agent/rules/basalt-page.md': 60,
  'agent/rules/basalt-state.md': 45,
  'agent/rules/basalt-charts.md': 40,
  'agent/skills/basalt-app/SKILL.md': 300, // W10: +40 streaming snippet; +43 form-dialog snippet
  'agent/skills/basalt-design/SKILL.md': 36, // W31: the design-round procedure
  'agent/skills/basalt-charts/SKILL.md': 40,
  'agent/templates/AGENTS-block.md.tpl': 55, // concept 4.4: at most 55 lines, imports nothing
  'agent/templates/AGENTS-block.tokens.md.tpl': 15, // the tokens-profile variant
  // Outside the layer total: a subagent loads only when invoked, not into every session.
  'agent/reviewer/basalt-design-reviewer.md': 40, // the thin wrapper; agent/reviewer/rubric.md carries the items
  'agent/templates/DESIGN.md.tpl': 45,
}

/**
 * The whole-layer bar — rules + skills + the AGENTS block together, since a per-file budget alone
 * can be satisfied by adding a sixth rule file or a fourth skill. The seeded `DESIGN.md.tpl` is
 * the consumer's own file after `init`, so it is outside the sum.
 */
export const AGENT_LAYER_TOTAL_BUDGET = 625 // v3 rules: five files at 215 lines (was six at 266), block 38; skills unchanged until G1

/**
 * Assert the 11 invariants against the live SURFACES + GUARD_RULES + the shipped agent layer.
 * Returns 0 when all pass; 1 when any fail (console.error each failure). `--check` is accepted for
 * the Makefile's call; every assertion always runs. `--write` is retired and fails.
 *
 * Eleven assertions:
 *  1. Every doctrine spec's guardKinds ⊆ keyof GUARD_RULES.
 *  2. `agent/rules/` lists exactly the five {@link SHIPPED_RULES} files, totalling at most
 *     {@link RULES_TOTAL_BUDGET} lines.
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
 * 10. Every shipped agent-layer file is inside its line budget, and rules + skills + the AGENTS block are inside the
 *     whole-layer total (`AGENT_LINE_BUDGETS` / `AGENT_LAYER_TOTAL_BUDGET`).
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

  // ── Assertion 2: agent/rules/ lists exactly the five shipped rule files, inside the total ──
  const rulesDir = resolve(pkgRoot, 'agent/rules')
  const onDisk = existsSync(rulesDir) ? readdirSync(rulesDir).toSorted() : []
  const wanted = SHIPPED_RULES.map((rule) => `${rule}.md`).toSorted()
  for (const name of wanted.filter((n) => !onDisk.includes(n))) {
    failures.push(`Missing rule file: agent/rules/${name}`)
  }
  for (const name of onDisk.filter((n) => !wanted.includes(n))) {
    failures.push(
      `Unexpected file in agent/rules/: ${name} (the shipped tree is exactly five rules)`,
    )
  }
  const rulesTotal = onDisk
    .filter((n) => n.endsWith('.md'))
    .reduce((sum, n) => sum + readFileSync(resolve(rulesDir, n), 'utf8').split('\n').length - 1, 0)
  if (rulesTotal > RULES_TOTAL_BUDGET) {
    failures.push(
      `agent/rules: ${rulesTotal} lines total exceeds the ${RULES_TOTAL_BUDGET}-line budget`,
    )
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
  for (const name of AGENT_NAMES) {
    if (!existsSync(resolve(pkgRoot, `agent/reviewer/${name}.md`)))
      failures.push(`agent/reviewer/${name}.md: missing`)
  }
  // A missing rule or skill is already reported by assertions 2/3; the AGENTS block has no other
  // assertion, so its absence is reported here. The block imports nothing (an `@` import line)
  // and never names the file that would suppress it.
  const blockRel = 'agent/templates/AGENTS-block.md.tpl'
  for (const rel of [blockRel, 'agent/templates/AGENTS-block.tokens.md.tpl']) {
    const abs = resolve(pkgRoot, rel)
    if (!existsSync(abs)) {
      failures.push(`${rel}: missing`)
      continue
    }
    const text = readFileSync(abs, 'utf8')
    if (/^@\S/m.test(text)) failures.push(`${rel}: an @import line (the block imports nothing)`)
    if (/CLAUDE\.md/.test(text))
      failures.push(`${rel}: names CLAUDE.md (the block lives in AGENTS.md)`)
  }
  const layerFiles = [
    ...SHIPPED_RULES.map((rule) => `agent/rules/${rule}.md`),
    ...SKILL_NAMES.map((skill) => `agent/skills/${skill}/SKILL.md`),
    blockRel,
  ]
  const layerTotal = layerFiles.reduce((sum, rel) => {
    const abs = resolve(pkgRoot, rel)
    return existsSync(abs) ? sum + readFileSync(abs, 'utf8').split('\n').length - 1 : sum
  }, 0)
  if (layerTotal > AGENT_LAYER_TOTAL_BUDGET) {
    failures.push(
      `agent layer (rules + skills + AGENTS block): ${layerTotal} lines total exceeds the ` +
        `${AGENT_LAYER_TOTAL_BUDGET}-line budget`,
    )
  }

  // ── Assertion 11: every guard kind maps to at least one surface ──────────────
  const surfacedGuardKinds = new Set<string>()
  for (const spec of doctrineSpecs) {
    for (const kind of spec.guardKinds) surfacedGuardKinds.add(kind)
  }
  for (const kind of Object.keys(GUARD_RULES)) {
    if (surfacedGuardKinds.has(kind)) continue
    failures.push(`Guard kind '${kind}' maps to no surface — add it to one surface's guardKinds`)
  }

  // ── The retired coverage-header writer ──────────────────────────────────────
  if (flags.includes('--write')) {
    failures.push(
      '--write is retired: the generated coverage header is gone; a rule bullet carries its own ' +
        'tag and check-rule-tags.ts holds it',
    )
  }

  // ── Report ──────────────────────────────────────────────────────────────────

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
