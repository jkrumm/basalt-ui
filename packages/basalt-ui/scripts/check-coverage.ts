/**
 * `check-coverage` — the 7 assertions (SURFACES consistency + the agent-layer shape and line
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

import { AGENT_NAMES, SKILL_NAMES, SURFACES } from '../src/surfaces'
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

// ──────────────────────────────────────────────────────────────────────────────
// check-coverage — 7-assertion coverage gate
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Per-file line budgets for the shipped agent layer, set to the landed values.
 *
 * A budget, not a guideline: the rules load into every session, so the numbers are the bar the
 * spec argued and live beside the gate that reads them rather than in prose.
 */
export const AGENT_LINE_BUDGETS: Readonly<Record<string, number>> = {
  'agent/rules/basalt-tokens.md': 45,
  'agent/rules/basalt-ui.md': 41,
  'agent/rules/basalt-page.md': 60,
  'agent/rules/basalt-state.md': 45,
  'agent/rules/basalt-charts.md': 40,
  'agent/skills/basalt-app/SKILL.md': 102,
  'agent/skills/basalt-design/SKILL.md': 49, // a map of short lines; AGENT_BYTE_BUDGETS is the bar that binds
  'agent/skills/basalt-charts/SKILL.md': 25,
  'agent/templates/AGENTS-block.md.tpl': 50, // imports nothing; names every skill
  'agent/templates/AGENTS-block.tokens.md.tpl': 15, // the tokens-profile variant
  // Outside the layer total: a subagent loads only when invoked, not into every session.
  'agent/reviewer/basalt-design-reviewer.md': 31, // the thin wrapper; agent/reviewer/rubric.md carries the items
  'agent/templates/DESIGN.md.tpl': 36,
}

/**
 * A skill body is budgeted in bytes as well. A line budget alone is met by long lines:
 * `basalt-design/SKILL.md` held 22 KB on 32 lines. 8,000 bytes is the bar for a body; `basalt-app`
 * sits at its landed value until it is split.
 */
export const AGENT_BYTE_BUDGETS: Readonly<Record<string, number>> = {
  'agent/skills/basalt-app/SKILL.md': 12_886,
  'agent/skills/basalt-design/SKILL.md': 6_951,
  'agent/skills/basalt-charts/SKILL.md': 7_972,
  'agent/templates/AGENTS-block.md.tpl': 4_618,
  'agent/reviewer/rubric.md': 18_443,
}

/**
 * Every skill reference at its landed size: a page build reads the references its route names, so a
 * reference grows only by losing a line elsewhere. A reference with no row here fails, so a new one is
 * sized on purpose. `parts.md` is generated from the docs and grows with the parts, so it has none.
 */
export const REFERENCE_BYTE_BUDGETS: Readonly<Record<string, number>> = {
  'agent/skills/basalt-app/references/live.md': 9_007,
  'agent/skills/basalt-app/references/migrate.md': 6_691,
  'agent/skills/basalt-app/references/performance.md': 3_094,
  'agent/skills/basalt-app/references/recipes.md': 5_842,
  'agent/skills/basalt-app/references/testing.md': 2_176,
  'agent/skills/basalt-charts/references/custom-marks.md': 3_403,
  'agent/skills/basalt-charts/references/linked-parts.md': 6_860,
  'agent/skills/basalt-design/references/ai.md': 7_092,
  'agent/skills/basalt-design/references/anti-defaults.md': 7_117,
  'agent/skills/basalt-design/references/cards.md': 8_430,
  'agent/skills/basalt-design/references/chart-color.md': 2_817,
  'agent/skills/basalt-design/references/chart-form.md': 4_785,
  'agent/skills/basalt-design/references/chart-honest.md': 3_596,
  'agent/skills/basalt-design/references/chart-labels.md': 4_054,
  'agent/skills/basalt-design/references/chart-view.md': 4_555,
  'agent/skills/basalt-design/references/charts.md': 1_565,
  'agent/skills/basalt-design/references/concept.md': 4_630,
  'agent/skills/basalt-design/references/controls.md': 3_089,
  'agent/skills/basalt-design/references/copy.md': 6_465,
  'agent/skills/basalt-design/references/encoding.md': 4_739,
  'agent/skills/basalt-design/references/forms.md': 10_807,
  'agent/skills/basalt-design/references/motion.md': 5_834,
  'agent/skills/basalt-design/references/state.md': 2_266,
  'agent/skills/basalt-design/references/states.md': 4_921,
  'agent/skills/basalt-design/references/table.md': 15_728,
}

/** Generated references, outside {@link REFERENCE_BYTE_BUDGETS}. */
export const GENERATED_REFERENCES: ReadonlySet<string> = new Set([
  'agent/skills/basalt-design/references/parts.md',
])

/**
 * The whole-layer bar — rules + skills + the AGENTS block together, since a per-file budget alone
 * can be satisfied by adding a sixth rule file or a fourth skill. The seeded `DESIGN.md.tpl` is
 * the consumer's own file after `init`, so it is outside the sum.
 */
export const AGENT_LAYER_TOTAL_BUDGET = 456 // rules 230, skills 176, block 50

/**
 * Assert the 9 invariants against the live SURFACES + the shipped agent layer.
 * Returns 0 when all pass; 1 when any fail (console.error each failure). `--check` is accepted for
 * the Makefile's call; every assertion always runs. `--write` is retired and fails.
 *
 * Seven assertions (the numbers 2–10 stay stable; 1, 9 and 11 covered the retired text-lane guard and
 * the retired 2.x lint plugin):
 *  2. `agent/rules/` lists exactly the five {@link SHIPPED_RULES} files, totalling at most
 *     {@link RULES_TOTAL_BUDGET} lines.
 *  3. Every doctrine skill (deduped) maps to agent/skills/{skill}/SKILL.md on disk.
 *  4. Every non-#, non-'.' JS-subpath SURFACES key has a package.json exports entry.
 *  5. Every real package.json exports key has a SURFACES entry.
 *  6. Every surface with non-empty forbiddenImports has a globs field.
 *  8. Every doctrine optionalPeers entry exists in peerDependencies AND peerDependenciesMeta.
 * 10. Every shipped agent-layer file is inside its line budget, every skill body inside its byte budget, and rules + skills + the AGENTS block are inside the
 *     whole-layer total (`AGENT_LINE_BUDGETS` / `AGENT_LAYER_TOTAL_BUDGET`). *
 * Tooling surfaces are exempt from assertions 2–3 by the discriminant.
 * Synthetic #-keys participate in assertion 2 but feed assertion 3 only
 * via the deduped skill union (no independent per-#-surface skill row).
 */
export function checkCoverage(flags: readonly string[] = [], pkgRoot: string = PKG_ROOT): number {
  const failures: string[] = []

  const allSpecs = Object.entries(SURFACES) as [string, SurfaceSpec][]
  const doctrineSpecs = (Object.values(SURFACES) as SurfaceSpec[]).filter(
    (s): s is DoctrineSpec => s.kind === 'doctrine',
  )

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

  // ── Assertion 10: the agent layer stays inside its line budgets ─────────────
  for (const [rel, budget] of Object.entries(AGENT_LINE_BUDGETS)) {
    const abs = resolve(pkgRoot, rel)
    if (!existsSync(abs)) continue // assertions 2/3 already report a missing rule or skill
    const lines = readFileSync(abs, 'utf8').split('\n').length - 1
    if (lines > budget) failures.push(`${rel}: ${lines} lines exceeds its ${budget}-line budget`)
  }
  for (const [rel, budget] of Object.entries(AGENT_BYTE_BUDGETS)) {
    const abs = resolve(pkgRoot, rel)
    if (!existsSync(abs)) continue
    const bytes = Buffer.byteLength(readFileSync(abs, 'utf8'))
    if (bytes > budget) failures.push(`${rel}: ${bytes} bytes exceeds its ${budget}-byte budget`)
  }
  for (const skill of SKILL_NAMES) {
    const refDir = resolve(pkgRoot, `agent/skills/${skill}/references`)
    if (!existsSync(refDir)) continue
    for (const name of readdirSync(refDir).filter((n) => n.endsWith('.md'))) {
      const rel = `agent/skills/${skill}/references/${name}`
      if (GENERATED_REFERENCES.has(rel)) continue
      const budget = REFERENCE_BYTE_BUDGETS[rel]
      if (budget === undefined) {
        failures.push(
          `${rel}: no byte budget (add it to REFERENCE_BYTE_BUDGETS at its landed size)`,
        )
        continue
      }
      const bytes = Buffer.byteLength(readFileSync(resolve(refDir, name), 'utf8'))
      if (bytes > budget) failures.push(`${rel}: ${bytes} bytes exceeds its ${budget}-byte budget`)
    }
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

  // ── The retired coverage-header writer ──────────────────────────────────────
  if (flags.includes('--write')) {
    failures.push(
      '--write is retired: the generated coverage header is gone; a rule bullet carries its own ' +
        'tag and check-rule-tags.ts holds it',
    )
  }

  // ── Report ──────────────────────────────────────────────────────────────────

  if (failures.length === 0) {
    console.log('✓ check-coverage: all 7 assertions pass.')
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
