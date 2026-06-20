/**
 * Generates the no-restricted-imports overrides for both oxlint configs from SURFACES.
 * The hand-maintained base (plugins, categories, rules, ignorePatterns, doc comment key) is
 * read from the current files and spliced in unchanged — only the overrides array is replaced.
 *
 * Usage: bun packages/basalt-ui/scripts/gen-oxlint.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ForbiddenImport, type RuleOverride, SURFACES } from '../src/surfaces'

// ── Types ────────────────────────────────────────────────────────────────────────────────────────

export type Target = 'shipped' | 'repo'

type OxlintPath = { name: string; message: string }
type OxlintPattern = { group: readonly [string]; message: string }
type NoRestrictedImports = { paths?: OxlintPath[]; patterns?: OxlintPattern[] }

type OverrideBlock = {
  files: string[]
  rules: Record<string, unknown>
}

// ── Glob lookup — derive per surface key + target ─────────────────────────────────────────────────

const GLOBS: Record<string, Record<Target, string[]>> = {
  './charts': {
    shipped: ['**/charts/**'],
    repo: ['packages/basalt-ui/src/charts/**'],
  },
  './tokens': {
    shipped: ['**/tokens/**'],
    repo: ['packages/basalt-ui/src/tokens/**'],
  },
  '#app': {
    shipped: ['src/**', 'app/**'],
    repo: ['packages/basalt-ui/src/**', 'apps/playground/src/**'],
  },
}

// ── Context resolution — fills the {ctx} placeholder per import spec + target ────────────────────

function resolveCtx(spec: string, surfaceName: string, target: Target): string {
  const chartsGlob = target === 'shipped' ? '**/charts/**' : 'packages/basalt-ui/src/charts/**'
  const chartsCtx = target === 'shipped' ? 'basalt-ui charts primitives' : 'charts primitives'
  if (spec === '@visx/tooltip') return chartsCtx
  if (spec === '@visx/*') return chartsGlob
  // @mantine/* paths and groups: ctx is the surface name (the boundary being protected)
  if (spec.startsWith('@mantine/') || spec === '@mantine/*') return surfaceName
  // antd and others carry no {ctx} placeholder; return empty string (no substitution needed)
  return ''
}

function fillCtx(message: string, ctx: string): string {
  return message.replace('{ctx}', ctx)
}

// ── Core projection — derive the overrides array for a given target ───────────────────────────────

/**
 * Derives the `overrides` array for the given target from SURFACES.
 * Only surfaces with non-empty forbiddenImports emit a no-restricted-imports block.
 * That is exactly: ./charts, ./tokens, #app.
 *
 * @example
 * const blocks = projectBanList('shipped') // → 3 override blocks
 * const repoBlocks = projectBanList('repo') // → 4 blocks (3 + cli/bin/scripts no-console:off)
 */
export function projectBanList(target: Target): OverrideBlock[] {
  const blocks: OverrideBlock[] = []

  // Emission order is LOAD-BEARING. oxlint resolves per-glob `no-restricted-imports` last-writer-wins
  // (a later matching block REPLACES an earlier one — it does not merge). The broad `#app` (src/**)
  // block must come FIRST so the narrower, re-allowing blocks (`./tokens`, then `./charts`) win for
  // files they match. In particular `./charts` (which OMITS the @visx/* ban = the re-allow) must be
  // LAST, or the `#app` @visx/* ban leaks into the charts boundary. Do NOT iterate SURFACES insertion
  // order here (it is charts-first, which inverts this and re-bans @visx inside charts).
  const EMIT_ORDER = ['#app', './tokens', './charts'] as const

  for (const key of EMIT_ORDER) {
    const surface = SURFACES[key]
    const globs = GLOBS[key as keyof typeof GLOBS]
    if (globs === undefined) continue
    if (surface.forbiddenImports.length === 0) continue

    const files = globs[target]

    // Derive the surface name for Mantine ban ctx (e.g. './charts' → 'charts', '#app' → 'app')
    const surfaceName = key.startsWith('#') ? key.slice(1) : key.replace(/^\.\//, '')

    const paths: OxlintPath[] = []
    const patterns: OxlintPattern[] = []

    for (const fi of surface.forbiddenImports as readonly ForbiddenImport[]) {
      if (fi.shippedOnly === true && target === 'repo') continue
      if (fi.repoOnly === true && target === 'shipped') continue

      const ctx = resolveCtx(fi.spec, surfaceName, target)
      const message = fillCtx(fi.message, ctx)

      if (fi.match === 'path') {
        paths.push({ name: fi.spec, message })
      } else {
        patterns.push({ group: [fi.spec], message })
      }
    }

    const nriValue: NoRestrictedImports = {}
    if (paths.length > 0) nriValue.paths = paths
    if (patterns.length > 0) nriValue.patterns = patterns

    // Collect rule overrides scoped to this target, excluding no-console (handled separately below)
    const extraRules: Record<string, unknown> = {}
    for (const ro of (surface.ruleOverrides ?? []) as readonly RuleOverride[]) {
      if (ro.rule === 'no-console') continue
      if (ro.target !== undefined && ro.target !== target) continue
      extraRules[ro.rule] = ro.level
    }

    blocks.push({
      files,
      rules: {
        ...extraRules,
        'no-restricted-imports': ['error', nriValue],
      },
    })
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

function main(): void {
  // Read and parse the hand-maintained base (preserves all keys except overrides)
  const shippedBase = JSON.parse(readFileSync(shippedPath, 'utf8')) as Record<string, unknown>
  const repoBase = JSON.parse(readFileSync(repoPath, 'utf8')) as Record<string, unknown>

  const shippedResult = { ...shippedBase, overrides: projectBanList('shipped') }
  const repoResult = { ...repoBase, overrides: projectBanList('repo') }

  writeFileSync(shippedPath, JSON.stringify(shippedResult, null, 2) + '\n', 'utf8')
  writeFileSync(repoPath, JSON.stringify(repoResult, null, 2) + '\n', 'utf8')

  console.log(`wrote ${shippedPath}`)
  console.log(`wrote ${repoPath}`)
}

// Only run when executed directly (not when imported by the test suite)
if (import.meta.path === Bun.main) {
  main()
}
