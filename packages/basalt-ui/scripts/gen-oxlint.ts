/**
 * Generates the no-restricted-imports overrides for both oxlint configs from SURFACES.
 * The hand-maintained base (plugins, categories, rules, ignorePatterns) is read from the
 * current files and spliced in unchanged — only the overrides array is replaced. Unknown
 * top-level keys are stripped on read: oxlint hard-errors on any field outside its known
 * schema (e.g. a doc-comment `"//"` key), so the base must be whitelisted before re-emitting.
 *
 * Usage: bun packages/basalt-ui/scripts/gen-oxlint.ts
 *        bun packages/basalt-ui/scripts/gen-oxlint.ts --check  (CI drift gate)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ForbiddenImport, RuleOverride } from '../src/surfaces'
import { SURFACES } from '../src/surfaces'

// The exact set oxlint's own config parser accepts at the top level (per oxlint 1.68.0's
// "unknown field" parse error) — anything else (e.g. a doc-comment `"//"` key) is stripped
// before re-emitting so the shipped/repo configs stay parseable by oxlint itself.
const ALLOWED_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  '$schema',
  'plugins',
  'jsPlugins',
  'categories',
  'rules',
  'settings',
  'env',
  'globals',
  'overrides',
  'options',
  'ignorePatterns',
  'extends',
])

function stripUnknownTopLevelKeys(base: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(base)) {
    if (ALLOWED_TOP_LEVEL_KEYS.has(key)) result[key] = value
  }
  return result
}

// ── Types ────────────────────────────────────────────────────────────────────────────────────────

export type Target = 'shipped' | 'repo'

type OxlintPath = { name: string; message: string }
type OxlintPattern = { group: readonly [string]; message: string }
type NoRestrictedImports = { paths?: OxlintPath[]; patterns?: OxlintPattern[] }

type OverrideBlock = {
  files: string[]
  rules: Record<string, unknown>
}

// ── Context resolution — fills the {ctx} placeholder per import spec + target ────────────────────

function resolveCtx(spec: string, surfaceName: string): string {
  // @mantine/* paths and groups: ctx is the surface name (the boundary being protected). The
  // @visx/tooltip and @visx/* boundaries used to resolve a {ctx} here too, but they're enforced
  // by the `basalt/visx-boundary` and `basalt/visx-tooltip` plugin rules now (see surfaces.ts's
  // ./charts comment) — no ForbiddenImport in SURFACES carries those specs any more.
  if (spec.startsWith('@mantine/') || spec === '@mantine/*') return surfaceName
  // antd, framer-motion, and others carry no {ctx} placeholder; return empty string (no substitution needed)
  return ''
}

function fillCtx(message: string, ctx: string): string {
  return message.replace('{ctx}', ctx)
}

// ── Core projection — derive the overrides array for a given target ───────────────────────────────

/**
 * Derives the `overrides` array for the given target from SURFACES.
 * A surface emits a block when it has a `globs` field AND (non-empty forbiddenImports OR a
 * ruleOverride relevant to `target` — see `hasRelevantRuleOverride`).
 *
 * Emission order is LOAD-BEARING — oxlint resolves per-glob `no-restricted-imports`
 * last-writer-wins (a later matching block REPLACES an earlier one). The broad `#app` (src/**)
 * block must come FIRST so narrower overrides win for files they match. The @visx/*-only-in-charts
 * and Mantine-free charts/tokens boundaries no longer depend on this ordering at all — they're
 * enforced by the `basalt/visx-boundary` and `basalt/token-layer-boundary` plugin rules, which are
 * immune to override-clobbering by construction. `#app`'s remaining bans (antd, framer-motion)
 * have no narrower re-allow to out-order, but #app is still emitted first, both for readability
 * and in case a future ban needs it.
 *
 * The SURFACES insertion order already reflects this: #app is last in the dict but first in
 * EMIT_ORDER. We derive EMIT_ORDER from SURFACES key order, but move #app to the front.
 */
/**
 * True when `surface` carries a non-no-console ruleOverride that applies to `target` — the signal
 * a candidate surface needs an override block even with empty forbiddenImports (e.g. `./charts`'s
 * repo-only `no-underscore-dangle: off`, now that its import bans moved to the
 * `basalt/visx-boundary`/`basalt/token-layer-boundary` plugin rules instead of
 * no-restricted-imports).
 */
function hasRelevantRuleOverride(
  ruleOverrides: readonly RuleOverride[] | undefined,
  target: Target,
): boolean {
  return (ruleOverrides ?? []).some(
    (ro) => ro.rule !== 'no-console' && (ro.target === undefined || ro.target === target),
  )
}

export function projectBanList(target: Target): OverrideBlock[] {
  const blocks: OverrideBlock[] = []

  // Build the ordered emit list from SURFACES: surfaces with globs, and either non-empty
  // forbiddenImports or a ruleOverride relevant to this target (see hasRelevantRuleOverride).
  // #app is moved to the front (it is the broad src/** override that must come first).
  const candidates = (
    Object.entries(SURFACES) as [string, (typeof SURFACES)[keyof typeof SURFACES]][]
  )
    .filter(
      ([, spec]) =>
        spec.globs !== undefined &&
        (spec.forbiddenImports.length > 0 || hasRelevantRuleOverride(spec.ruleOverrides, target)),
    )
    .map(([key]) => key)

  const appIdx = candidates.indexOf('#app')
  if (appIdx > 0) {
    candidates.splice(appIdx, 1)
    candidates.unshift('#app')
  }

  for (const key of candidates) {
    const surface = SURFACES[key as keyof typeof SURFACES]
    if (!surface.globs) continue

    const files = [...surface.globs[target]]
    if (files.length === 0) continue

    // Derive the surface name for Mantine ban ctx (e.g. './charts' → 'charts', '#app' → 'app')
    const surfaceName = key.startsWith('#') ? key.slice(1) : key.replace(/^\.\//, '')

    const paths: OxlintPath[] = []
    const patterns: OxlintPattern[] = []

    for (const fi of surface.forbiddenImports as readonly ForbiddenImport[]) {
      if (fi.shippedOnly === true && target === 'repo') continue
      if (fi.repoOnly === true && target === 'shipped') continue

      const ctx = resolveCtx(fi.spec, surfaceName)
      const message = fillCtx(fi.message, ctx)

      if (fi.match === 'path') {
        paths.push({ name: fi.spec, message })
      } else {
        patterns.push({ group: [fi.spec], message })
      }
    }

    // Collect rule overrides scoped to this target, excluding no-console (handled separately below)
    const extraRules: Record<string, unknown> = {}
    for (const ro of (surface.ruleOverrides ?? []) as readonly RuleOverride[]) {
      if (ro.rule === 'no-console') continue
      if (ro.target !== undefined && ro.target !== target) continue
      extraRules[ro.rule] = ro.level
    }

    const rules: Record<string, unknown> = { ...extraRules }
    if (paths.length > 0 || patterns.length > 0) {
      const nriValue: NoRestrictedImports = {}
      if (paths.length > 0) nriValue.paths = paths
      if (patterns.length > 0) nriValue.patterns = patterns
      rules['no-restricted-imports'] = ['error', nriValue]
    }

    // Nothing left to enforce for this surface/target (e.g. ./charts under 'shipped', now that its
    // import bans moved to the basalt/visx-boundary and basalt/token-layer-boundary plugin rules) — skip
    // rather than emit a vestigial empty override block.
    if (Object.keys(rules).length === 0) continue

    blocks.push({ files, rules })
  }

  // Repo-local only: emit the cli/bin/scripts no-console:off block.
  // Source signal: #app ruleOverride { rule: 'no-console', level: 'off', target: 'repo' }.
  // The design notes this is MIS-SCOPED if placed on the #app glob — the real scope is cli/bin/scripts.
  if (target === 'repo') {
    const appSurface = SURFACES['#app']
    const hasNoConsole = (appSurface.ruleOverrides ?? []).some(
      (ro): ro is RuleOverride =>
        ro.rule === 'no-console' && (ro.target === 'repo' || ro.target === undefined),
    )
    if (hasNoConsole) {
      blocks.push({
        files: [
          'packages/basalt-ui/src/cli/**',
          'packages/basalt-ui/bin/**',
          'packages/basalt-ui/scripts/**',
        ],
        rules: { 'no-console': 'off' },
      })
    }
  }

  return blocks
}

// ── File paths ────────────────────────────────────────────────────────────────────────────────────

const root = join(import.meta.dirname, '..', '..', '..')
const shippedPath = join(root, 'packages/basalt-ui/configs/oxlint.json')
const repoPath = join(root, '.oxlintrc.json')

// ── Main — regenerate both config files ──────────────────────────────────────────────────────────

function generate(): {
  shippedResult: Record<string, unknown>
  repoResult: Record<string, unknown>
} {
  // Read and parse the hand-maintained base (preserves all known keys except overrides;
  // unknown top-level keys — e.g. a stray doc-comment key — are dropped, never re-emitted)
  const shippedBase = stripUnknownTopLevelKeys(
    JSON.parse(readFileSync(shippedPath, 'utf8')) as Record<string, unknown>,
  )
  const repoBase = stripUnknownTopLevelKeys(
    JSON.parse(readFileSync(repoPath, 'utf8')) as Record<string, unknown>,
  )

  return {
    shippedResult: { ...shippedBase, overrides: projectBanList('shipped') },
    repoResult: { ...repoBase, overrides: projectBanList('repo') },
  }
}

function main(): void {
  const args = process.argv.slice(2)
  const checkMode = args.includes('--check')

  const { shippedResult, repoResult } = generate()

  if (checkMode) {
    // Parse the committed files and deep-compare (format-agnostic) against generated output
    const committedShipped = JSON.parse(readFileSync(shippedPath, 'utf8')) as Record<
      string,
      unknown
    >
    const committedRepo = JSON.parse(readFileSync(repoPath, 'utf8')) as Record<string, unknown>

    const genShippedJson = JSON.stringify(shippedResult, null, 2) + '\n'
    const genRepoJson = JSON.stringify(repoResult, null, 2) + '\n'
    const committedShippedJson = JSON.stringify(committedShipped, null, 2) + '\n'
    const committedRepoJson = JSON.stringify(committedRepo, null, 2) + '\n'

    let driftFound = false

    if (genShippedJson !== committedShippedJson) {
      console.error('✖ gen-oxlint --check: packages/basalt-ui/configs/oxlint.json is out of sync.')
      console.error('  Run: bun packages/basalt-ui/scripts/gen-oxlint.ts')
      driftFound = true
    }
    if (genRepoJson !== committedRepoJson) {
      console.error('✖ gen-oxlint --check: .oxlintrc.json is out of sync.')
      console.error('  Run: bun packages/basalt-ui/scripts/gen-oxlint.ts')
      driftFound = true
    }

    if (driftFound) {
      process.exit(1)
    }
    console.log('✓ gen-oxlint --check: both oxlint configs are in sync with SURFACES.')
    return
  }

  writeFileSync(shippedPath, JSON.stringify(shippedResult, null, 2) + '\n', 'utf8')
  writeFileSync(repoPath, JSON.stringify(repoResult, null, 2) + '\n', 'utf8')

  console.log(`wrote ${shippedPath}`)
  console.log(`wrote ${repoPath}`)
}

// Only run when executed directly (not when imported by the test suite)
if (import.meta.path === Bun.main) {
  main()
}
