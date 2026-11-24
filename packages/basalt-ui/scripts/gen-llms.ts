/**
 * Generates packages/basalt-ui/llms.txt from the SURFACES SSOT + package.json.
 * The file is machine-readable for AI agents: package purpose, then one entry per published
 * subpath with import specifier, description, layer, and optional peers.
 *
 * The output is derived data: untracked and gitignored, written by the package build and by the
 * release `prepareCmd`. `scripts/gen-llms-assert.mjs` (run by pack-test) asserts the packed copy
 * names every `exports` subpath.
 *
 * Usage: bun packages/basalt-ui/scripts/gen-llms.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SURFACES } from '../src/surfaces'
import {
  readOptionTypes,
  readSignatures,
  readTypeGlossary,
  releaseEntryProgram,
} from './llms-signatures'
import { SUBPATH_REQUIRED_PEERS } from './surface-gates'
import { isEjectPath, subpathFamilies } from './export-keys'

const root = join(import.meta.dirname, '..', '..', '..')
const pkgPath = join(root, 'packages/basalt-ui/package.json')

export const outPath = join(root, 'packages/basalt-ui/llms.txt')

// ── Read package metadata ─────────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
  name: string
  version: string
  description?: string
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
  exports?: Record<string, unknown>
}

const peerDeps: Record<string, string> = pkg.peerDependencies ?? {}
const peerMeta: Record<string, { optional?: boolean }> = pkg.peerDependenciesMeta ?? {}
const pkgExports: Record<string, unknown> = pkg.exports ?? {}

const optionalPeerSet = new Set(
  Object.entries(peerMeta)
    .filter(([, m]) => m.optional === true)
    .map(([name]) => name),
)

const publishedExportKeys = new Set(subpathFamilies(pkgExports))

// ── Signatures ───────────────────────────────────────────────────────────────────────────────────
// One line per public value export of every JS subpath, read from source by the TS checker.

const SUBPATH_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(pkgExports).flatMap(([key, value]) =>
    !isEjectPath(key) && typeof value === 'object' && value !== null && 'types' in value
      ? [[key, String((value as { types: string }).types)]]
      : [],
  ),
)
// The three readers share one TypeScript program, in this order (llms-signatures.ts `entryProgram`): a process
// importing this module peaked at 1.5 GiB with a program per reader and at 0.95 GiB with one.
const SIGNATURES = readSignatures(SUBPATH_TYPES)
const OPTION_TYPES = readOptionTypes(SUBPATH_TYPES)

// Literal-union aliases a signature names but cannot show (`rowHeight?: RowHeight`). Read AFTER the
// signatures, so it cannot change how they print.
const TYPE_GLOSSARY = readTypeGlossary(SUBPATH_TYPES, Object.values(SIGNATURES).flat().join('\n'))
releaseEntryProgram()

/** Peer ranges like `^7 || ^8` contain spaces and pipes; quote any spec the shell would split. */
const SHELL_SAFE_RE = /^[\w@/.^~-]+$/

// ── Build rows from SURFACES ──────────────────────────────────────────────────

type Row = {
  importSpec: string
  description: string
  layer: string
  optionalPeers: string[]
  /** true for non-JS assets (styles.css, configs/*, llms.txt) — no import line emitted */
  isAsset?: boolean
  /** The one `bun add` line for this subpath's subpath-required peers (V2-SPEC § 1 "Peers"). */
  install?: string
  /** One-line signature per public value export, generated from source. */
  signatures?: readonly string[]
  /** `Type:` blocks for the option types those signatures name. */
  optionTypes?: readonly string[]
  /** Doctrine rule name — present only for doctrine surfaces */
  rule?: string
}

const rows: Row[] = []

for (const [key, spec] of Object.entries(SURFACES)) {
  if (key.startsWith('#')) continue
  if (!publishedExportKeys.has(key)) continue

  const isAsset = spec.layer === 'non-js-asset'
  // For ./configs/* the importSpec uses the glob form; others strip the leading './'
  const importSpec = key === '.' ? 'basalt-ui' : `basalt-ui${key.slice(1)}`

  // Resolve optional peers: names come from spec.optionalPeers (single source), versions from package.json
  const specPeers: readonly string[] =
    'optionalPeers' in spec && Array.isArray(spec.optionalPeers) ? spec.optionalPeers : []
  const subpathRequired = SUBPATH_REQUIRED_PEERS[key] ?? []
  const resolvedPeers = specPeers
    .filter((p) => optionalPeerSet.has(p) && p in peerDeps && !subpathRequired.includes(p))
    .map((p) => `${p}@${peerDeps[p]}`)

  // `SURFACES` is a `satisfies` literal, so a surface that simply omits `description` has no such
  // property on its inferred type — `in` narrows where a `?.` cannot. Same reason `rule` is spread
  // conditionally rather than set to `undefined`: `exactOptionalPropertyTypes` is on.
  const description =
    ('description' in spec ? spec.description : undefined) ??
    `basalt-ui${key === '.' ? '' : key} subpath`

  const install =
    subpathRequired.length === 0
      ? undefined
      : `bun add ${subpathRequired
          .map((name) => {
            const range = peerDeps[name]
            if (range === undefined)
              throw new Error(
                `gen-llms: ${key}: subpath-required peer ${name} is not a peerDependency`,
              )
            const installSpec = `${name}@${range}`
            return SHELL_SAFE_RE.test(installSpec) ? installSpec : `'${installSpec}'`
          })
          .join(' ')}`
  const signatures = SIGNATURES[key]
  const optionTypes = OPTION_TYPES[key]

  rows.push({
    importSpec,
    ...(install === undefined ? {} : { install }),
    ...(signatures === undefined ? {} : { signatures }),
    ...(optionTypes === undefined ? {} : { optionTypes }),
    description,
    layer: spec.layer,
    optionalPeers: resolvedPeers,
    isAsset,
    ...(spec.kind === 'doctrine' ? { rule: spec.rule } : {}),
  })
}

// ── Entry points: the headline symbols per subpath ───────────────────────────────────────────────
// Emitted in one fixed shape; `check-agent-doc-drift` (Check H) resolves every name against THAT
// subpath's published exports, so a rename fails the gate.

const ENTRY_POINTS: readonly (readonly [string, readonly string[]])[] = [
  ['basalt-ui/router', ['routerDefaults', 'defineNav', 'navTarget']],
  ['basalt-ui/data', ['createQueryClient', 'unwrap', 'liveQuery']],
  ['basalt-ui/shell', ['AppShell']],
  ['basalt-ui/page', ['Page', 'PageBar', 'Section', 'QueryState']],
  ['basalt-ui/cards', ['StatCard', 'StatGroup', 'BarList']],
  ['basalt-ui/table', ['DataTable', 'col', 'useDataTable']],
  ['basalt-ui/charts', ['CartesianChart', 'Lines', 'Bars', 'ChartCard']],
  ['basalt-ui/vite', ['basalt']],
]

// ── Emit llms.txt ─────────────────────────────────────────────────────────────

export function generateLlmsTxt(): string {
  const lines: string[] = [
    `# ${pkg.name} v${pkg.version}`,
    `# ${pkg.description ?? 'Opinionated framework for React apps on Base UI, Tailwind 4 and TanStack'}`,
    '# Entry points (the v3 app; the `basalt-ui` root holds the state seams: `persisted`, `externalField`, `notify`, `useNow`, `useFormat`):',
    ...ENTRY_POINTS.map(([spec, names]) => `# ${spec.padEnd(20)} ${names.join(', ')}`),
    '# Peers of an `app` profile install: react, react-dom, @tanstack/react-router, @tanstack/react-query,',
    '# @base-ui/react, tailwindcss, @tailwindcss/vite; dev: vite, @tanstack/router-plugin. `basalt-ui init --profile app` writes main.tsx, _app.tsx, nav.tsx.',
    "# A frame's `phase` is `Phase | QueryStateLike`, and the frame's types (`Empty`, `FrameState`, `Phase`, `QueryStateLike`, `CardMenu`, `Delta`, `Verdict`, `Tone`, `FootFacts`) import from `basalt-ui/cards`: `import type { Phase, QueryStateLike } from 'basalt-ui/cards'`.",
    "# A subpath's `Install:` line is its required peers; `OptionalPeers:` are import()-only, install on use.",
    '',
    `Package: ${pkg.name}`,
    `Version: ${pkg.version}`,
    '',
  ]

  for (const row of rows) {
    lines.push(`## ${row.importSpec}`)
    if (row.isAsset) {
      lines.push(`Asset: ${row.importSpec}`)
    } else {
      lines.push(`Import: import { ... } from '${row.importSpec}'`)
    }
    lines.push(`Description: ${row.description}`)
    lines.push(`Layer: ${row.layer}`)
    if (row.rule !== undefined) {
      lines.push(`Rule: basalt-${row.rule}`)
    }
    for (const signature of row.signatures ?? []) lines.push(`Signature: ${signature}`)
    for (const block of row.optionTypes ?? []) lines.push(block)
    if (row.install !== undefined) lines.push(`Install: ${row.install}`)
    if (row.optionalPeers.length > 0) {
      lines.push(`OptionalPeers: ${row.optionalPeers.join(', ')}`)
    }
    lines.push('')
  }

  if (TYPE_GLOSSARY.length > 0) {
    lines.push(
      '## Types',
      'Description: literal unions the signatures above name (members in declaration order)',
    )
    for (const line of TYPE_GLOSSARY) lines.push(line)
    lines.push('')
  }

  return lines.join('\n')
}

function main(): void {
  writeFileSync(outPath, generateLlmsTxt(), 'utf8')
  console.log(`wrote ${outPath}`)
}

// Only run when executed directly (not when imported by the test suite)
if (import.meta.path === Bun.main) {
  main()
}
