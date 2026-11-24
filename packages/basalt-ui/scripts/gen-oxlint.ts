/**
 * Generates the repo's own `.oxlintrc.json` `overrides` (the import bans of `packages/basalt-ui/src`)
 * from SURFACES. The hand-maintained base (plugins, categories, rules, ignorePatterns) is read from the
 * current file and spliced in unchanged — only the overrides array is replaced. Unknown top-level keys
 * are stripped on read: oxlint hard-errors on any field outside its known schema (e.g. a doc-comment
 * `"//"` key), so the base must be whitelisted before re-emitting.
 *
 * It also writes the v3 shipped presets from the rule table (`src/lint/preset.ts`): one
 * `configs/oxlint-<profile>.json` per shipped profile (`tokens` ships none) and the oxfmt
 * `sortTailwindcss` preset. Those files are byte-compared by `--check`, not parsed.
 *
 * Usage: bun packages/basalt-ui/scripts/gen-oxlint.ts
 *        bun packages/basalt-ui/scripts/gen-oxlint.ts --check  (CI drift gate)
 *        --configs-dir=<dir>  with --check, compare the v3 presets against that directory
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import plugin from '../src/lint'
import { tableOf } from '../src/lint/factory'
import type { Contract } from '../src/lint/preset'
import { oxfmtPreset, SHIPPED_PROFILES, shippedPreset } from '../src/lint/preset'
import type { ForbiddenImport, RuleOverride } from '../src/surfaces'
import { SURFACES } from '../src/surfaces'
import { SLOTS } from '../src/ui/slots'

// The exact set oxlint's own config parser accepts at the top level (per oxlint 1.68.0's
// "unknown field" parse error) — anything else (e.g. a doc-comment `"//"` key) is stripped
// before re-emitting so the repo config stays parseable by oxlint itself.
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

type OxlintPath = { name: string; message: string }
type OxlintPattern = { group: readonly [string]; message: string }
type NoRestrictedImports = { paths?: OxlintPath[]; patterns?: OxlintPattern[] }

type OverrideBlock = {
  files: string[]
  rules: Record<string, unknown>
}

// ── Core projection — derive the overrides array for a given target ───────────────────────────────

/**
 * Derives the repo's `overrides` array from SURFACES.
 * A surface emits a block when it has a `globs` field AND (non-empty forbiddenImports OR a
 * ruleOverride relevant to `target` — see `hasRelevantRuleOverride`).
 *
 * Emission order is LOAD-BEARING — oxlint resolves per-glob `no-restricted-imports`
 * last-writer-wins (a later matching block REPLACES an earlier one). The broad `#app` (src/**)
 * block must come FIRST so narrower overrides win for files they match. The one narrower re-allow
 * is the chart host file, emitted last (`CHART_HOST_FILE`).
 *
 * The SURFACES insertion order already reflects this: #app is last in the dict but first in
 * EMIT_ORDER. We derive EMIT_ORDER from SURFACES key order, but move #app to the front.
 */
/**
 * True when `surface` carries a non-no-console ruleOverride for the repo — the signal a candidate
 * surface needs an override block even with empty forbiddenImports (e.g. `./charts`'s
 * `no-underscore-dangle: off`).
 */
function hasRelevantRuleOverride(ruleOverrides: readonly RuleOverride[] | undefined): boolean {
  return (ruleOverrides ?? []).some(
    (ro) => ro.rule !== 'no-console' && (ro.target === undefined || ro.target === 'repo'),
  )
}

// ── React-compiler rule exemptions (repo-only) ────────────────────────────────────────────────────
// The compiler rules are `error` repo-wide. Each entry below is a file that predates them and
// legitimately reads a ref in render / sets state in an effect (measure-then-render, hydration
// seeds, test harnesses that reassign a module-level spy). One block per rule, listed by file —
// never a blanket off. Delete an entry when its file is reworked; the sync test pins the output.
export const PKG_ROOT = 'packages/basalt-ui/'

/** The React-compiler rules plus its sibling, `error` at the top level of the repo configs. */
export const COMPILER_RULES = [
  'react/globals',
  'react/immutability',
  'react/incompatible-library',
  'react/preserve-manual-memoization',
  'react/refs',
  'react/set-state-in-effect',
  'no-constant-binary-expression',
] as const

type CompilerRuleExemption = { rule: string; reason: string; files: OverrideBlock['files'] }

export const REPO_COMPILER_RULE_EXEMPTIONS: readonly CompilerRuleExemption[] = []

/** Paths are relative to `apps/playground` (oxlint resolves a nested config's globs from its dir). */
export const PLAYGROUND_COMPILER_RULE_EXEMPTIONS: readonly CompilerRuleExemption[] = []

/** The playground's `overrides`, pinned against `apps/playground/.oxlintrc.json` by the sync test. */
export function projectPlaygroundOverrides(): OverrideBlock[] {
  return PLAYGROUND_COMPILER_RULE_EXEMPTIONS.map(({ rule, files }) => ({
    files,
    rules: { [rule]: 'off' },
  }))
}

/** The one file allowed to import the chart engine's DOM host (`@tanstack/charts/react`). */
export const CHART_HOST_FILE = `${PKG_ROOT}src/charts/host.tsx`

const CHART_HOST_SPECS: ReadonlySet<string> = new Set([
  '@tanstack/charts/react',
  '@tanstack/charts/react/*',
])

export function projectBanList(): OverrideBlock[] {
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
        (spec.forbiddenImports.length > 0 || hasRelevantRuleOverride(spec.ruleOverrides)),
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

    const files = [...surface.globs.repo]
    if (files.length === 0) continue

    const paths: OxlintPath[] = []
    const patterns: OxlintPattern[] = []

    for (const fi of surface.forbiddenImports as readonly ForbiddenImport[]) {
      if (fi.shippedOnly === true) continue

      const { message } = fi

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
      if (ro.target === 'shipped') continue
      extraRules[ro.rule] = ro.level
    }

    const rules: Record<string, unknown> = { ...extraRules }
    if (paths.length > 0 || patterns.length > 0) {
      const nriValue: NoRestrictedImports = {}
      if (paths.length > 0) nriValue.paths = paths
      if (patterns.length > 0) nriValue.patterns = patterns
      rules['no-restricted-imports'] = ['error', nriValue]
    }

    // Nothing left to enforce for this surface — skip rather than emit a vestigial empty block.
    if (Object.keys(rules).length === 0) continue

    blocks.push({ files, rules })
  }

  // Emit the cli/bin/scripts no-console:off block.
  // Source signal: #app ruleOverride { rule: 'no-console', level: 'off', target: 'repo' }.
  // The design notes this is MIS-SCOPED if placed on the #app glob — the real scope is cli/bin/scripts.
  {
    const appSurface = SURFACES['#app']
    const hasNoConsole = (appSurface.ruleOverrides ?? []).some(
      (ro): ro is RuleOverride =>
        ro.rule === 'no-console' && (ro.target === 'repo' || ro.target === undefined),
    )
    if (hasNoConsole) {
      blocks.push({
        files: [`${PKG_ROOT}src/cli/**`, `${PKG_ROOT}bin/**`, `${PKG_ROOT}scripts/**`],
        rules: { 'no-console': 'off' },
      })
    }
  }

  for (const { rule, files } of REPO_COMPILER_RULE_EXEMPTIONS) {
    blocks.push({ files, rules: { [rule]: 'off' } })
  }

  // Last, so it wins over `#app`: the host file gets `#app`'s bans minus the host ban.
  const app = blocks.find((block) => block.files.includes(`${PKG_ROOT}src/**`))
  const appBans = app?.rules['no-restricted-imports'] as [string, NoRestrictedImports] | undefined
  if (appBans !== undefined) {
    const [level, { paths = [], patterns = [] }] = appBans
    blocks.push({
      files: [CHART_HOST_FILE],
      rules: {
        'no-restricted-imports': [
          level,
          {
            paths: paths.filter((entry) => !CHART_HOST_SPECS.has(entry.name)),
            patterns: patterns.filter((entry) => !CHART_HOST_SPECS.has(entry.group[0])),
          },
        ],
      },
    })
  }

  return blocks
}

// ── File paths ────────────────────────────────────────────────────────────────────────────────────

const root = join(import.meta.dirname, '..', '..', '..')
const pkgRoot = join(root, 'packages/basalt-ui')
const repoPath = join(root, '.oxlintrc.json')

// ── v3 presets — generated from the rule table ───────────────────────────────────────────────────

/** Exact `x.y.z`: a patch can add findings, so a range is not a pin (guardrails section 9). */
function exactPin(label: string, spec: string | undefined): string {
  if (spec === undefined || !/^\d+\.\d+\.\d+$/.test(spec)) {
    throw new Error(
      `${label} must be an exact pin in the package peerDependencies, found ${spec ?? 'nothing'}`,
    )
  }
  return spec
}

type Manifest = { peerDependencies?: Record<string, string> }
const readManifest = (path: string): Manifest => JSON.parse(readFileSync(path, 'utf8')) as Manifest

/** The pins are read, never written here: the package's `peerDependencies` is their one source (MAINTAINING.md § Peers). */
export function readPins(): { oxlint: string; shadcnLint: string } {
  const peers = readManifest(join(pkgRoot, 'package.json')).peerDependencies
  return {
    oxlint: exactPin('oxlint', peers?.['oxlint']),
    shadcnLint: exactPin('@shadcn/lint', peers?.['@shadcn/lint']),
  }
}

function readContracts(): Contract[] {
  const path = join(pkgRoot, 'src/ui/no-restyle.generated.json')
  const file = JSON.parse(readFileSync(path, 'utf8')) as { contracts: Contract[] }
  return file.contracts.map(({ pattern, allow, deny, message }) => ({
    pattern,
    allow,
    deny,
    message,
  }))
}

/** oxfmt writes the files the repo's `fmt:check` reads, so the bytes `--check` compares are stable. */
function format(text: string, name: string): string {
  const run = Bun.spawnSync(['oxfmt', `--stdin-filepath=${name}`], {
    cwd: root,
    stdin: new TextEncoder().encode(text),
    env: {
      ...process.env,
      PATH: `${join(root, 'node_modules/.bin')}:${process.env['PATH'] ?? ''}`,
    },
  })
  if (run.exitCode !== 0) throw new Error(`oxfmt failed on ${name}: ${run.stderr.toString()}`)
  return run.stdout.toString()
}

/** Where each generated v3 file lives, relative to the repository root. */
export const V3_PRESET_PATHS = {
  profile: (profile: string): string => `packages/basalt-ui/configs/oxlint-${profile}.json`,
  oxfmt: 'packages/basalt-ui/configs/oxfmt-tailwind.json',
} as const

/** The v3 files as repo-relative path → exact bytes. `tokens` is absent: it ships no preset. */
export function projectV3Files(): Map<string, string> {
  const files = new Map<string, string>()
  const table = tableOf(plugin)
  const inputs = { table, pins: readPins(), contracts: readContracts(), uiSlots: SLOTS }
  for (const profile of SHIPPED_PROFILES) {
    const path = V3_PRESET_PATHS.profile(profile)
    files.set(path, format(JSON.stringify(shippedPreset(profile, inputs), null, 2), path))
  }
  const base = JSON.parse(readFileSync(join(pkgRoot, 'configs/oxfmt.json'), 'utf8')) as Record<
    string,
    unknown
  >
  files.set(
    V3_PRESET_PATHS.oxfmt,
    format(JSON.stringify(oxfmtPreset(base), null, 2), V3_PRESET_PATHS.oxfmt),
  )
  return files
}

/** `configsDir` points the comparison at another copy of `configs/` (the drift test edits one). */
function v3Drift(files: ReadonlyMap<string, string>, configsDir: string | undefined): string[] {
  const drift: string[] = []
  for (const [path, text] of files) {
    let committed: string | undefined
    try {
      committed = readFileSync(
        configsDir === undefined ? join(root, path) : join(configsDir, basename(path)),
        'utf8',
      )
    } catch {
      committed = undefined
    }
    if (committed !== text) drift.push(path)
  }
  return drift
}

// ── Main — regenerate the repo config and the v3 presets ─────────────────────────────────────────

/** The repo config: its hand-maintained base plus the projected `overrides`. */
function generateRepo(): Record<string, unknown> {
  // Unknown top-level keys (e.g. a stray doc-comment key) are dropped, never re-emitted.
  const base = stripUnknownTopLevelKeys(
    JSON.parse(readFileSync(repoPath, 'utf8')) as Record<string, unknown>,
  )
  return { ...base, overrides: projectBanList() }
}

function main(): void {
  const args = process.argv.slice(2)
  const repoResult = generateRepo()
  const v3Files = projectV3Files()

  if (args.includes('--check')) {
    // Deep-compare parsed JSON (format-agnostic) against the generated output.
    const committed = JSON.parse(readFileSync(repoPath, 'utf8')) as Record<string, unknown>
    let driftFound = false

    if (JSON.stringify(repoResult) !== JSON.stringify(committed)) {
      console.error('✖ gen-oxlint --check: .oxlintrc.json is out of sync.')
      console.error('  Run: bun packages/basalt-ui/scripts/gen-oxlint.ts')
      driftFound = true
    }

    const dirFlag = args.find((arg) => arg.startsWith('--configs-dir='))
    for (const path of v3Drift(v3Files, dirFlag?.slice('--configs-dir='.length))) {
      console.error(`✖ gen-oxlint --check: ${path} is out of sync with the rule table.`)
      console.error('  Run: bun packages/basalt-ui/scripts/gen-oxlint.ts')
      driftFound = true
    }

    if (driftFound) process.exit(1)
    console.log(
      `✓ gen-oxlint --check: .oxlintrc.json matches SURFACES, ${v3Files.size} v3 presets match the rule table.`,
    )
    return
  }

  // Compared as parsed JSON (oxfmt lays the committed file out): rewrite only on a semantic change,
  // so a regeneration never reformats a file that is already right.
  const committed = JSON.stringify(JSON.parse(readFileSync(repoPath, 'utf8')))
  if (committed !== JSON.stringify(repoResult)) {
    writeFileSync(repoPath, JSON.stringify(repoResult, null, 2) + '\n', 'utf8')
    console.log(`wrote ${repoPath}`)
  }
  for (const [path, text] of v3Files) {
    writeFileSync(join(root, path), text, 'utf8')
    console.log(`wrote ${join(root, path)}`)
  }
}

// Only run when executed directly (not when imported by the test suite)
if (import.meta.path === Bun.main) {
  main()
}
