/**
 * Generates packages/basalt-ui/llms.txt from the SURFACES SSOT + package.json.
 * The file is machine-readable for AI agents: package purpose, then one entry per published
 * subpath with import specifier, description, layer, and optional peers.
 *
 * Usage: bun packages/basalt-ui/scripts/gen-llms.ts
 *        bun packages/basalt-ui/scripts/gen-llms.ts --check  (CI drift gate)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SURFACES } from '../src/surfaces'
import { readSignatures, readTypeGlossary } from './llms-signatures'
import { SUBPATH_REQUIRED_PEERS } from './surface-gates'

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

const publishedExportKeys = new Set(Object.keys(pkgExports))

// ── Signatures ───────────────────────────────────────────────────────────────────────────────────
// One line per public value export of every JS subpath, read from source by the TS checker.

const SUBPATH_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(pkgExports).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null && 'types' in value
      ? [[key, String((value as { types: string }).types)]]
      : [],
  ),
)
const SIGNATURES = readSignatures(SUBPATH_TYPES)

// Literal-union aliases a signature names but cannot show (`kind?: CalloutKind`). Read AFTER the
// signatures, from a program of its own, so it cannot change how they print.
const TYPE_GLOSSARY = readTypeGlossary(SUBPATH_TYPES, Object.values(SIGNATURES).flat().join('\n'))

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

  rows.push({
    importSpec,
    ...(install === undefined ? {} : { install }),
    ...(signatures === undefined ? {} : { signatures }),
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
  [
    'basalt-ui',
    ['BasaltProvider', 'createBasaltRouter', 'BasaltShell', 'defineNav', 'PageBar', 'Section'],
  ],
  ['basalt-ui/tokens', ['VX', 'defineSeries', 'groupTokens', 'buildPaletteCss']],
  ['basalt-ui/charts', ['CartesianChart', 'Lines', 'Bars', 'ChartCard']],
  ['basalt-ui/controls', ['FilterSet', 'ViewTabs', 'RangeFilter', 'SelectFilter']],
  ['basalt-ui/state', ['createSearchStore', 'createPersistedState']],
  ['basalt-ui/vite', ['basaltViteConfig', 'basaltAppPlugin']],
]

// ── Emit llms.txt ─────────────────────────────────────────────────────────────

export function generateLlmsTxt(): string {
  const lines: string[] = [
    `# ${pkg.name} v${pkg.version}`,
    `# ${pkg.description ?? 'Opinionated framework for Mantine-based React apps'}`,
    '#',
    '# Entry points: use the exact import specifier below; do not guess.',
    ...ENTRY_POINTS.map(([spec, names]) => `# ${spec.padEnd(20)} ${names.join(', ')}`),
    '# Required peers (install for `.`): react, react-dom, @mantine/{core,hooks,modals,notifications,spotlight},',
    '# @tanstack/react-router, @tanstack/react-query and the three @fontsource-variable faces.',
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
  const args = process.argv.slice(2)
  const checkMode = args.includes('--check')
  const content = generateLlmsTxt()

  if (checkMode) {
    const committed = readFileSync(outPath, 'utf8')
    if (content !== committed) {
      console.error('✖ gen-llms --check: packages/basalt-ui/llms.txt is out of sync.')
      console.error('  Run: bun packages/basalt-ui/scripts/gen-llms.ts')
      process.exit(1)
    }
    console.log('✓ gen-llms --check: llms.txt is in sync with SURFACES.')
    return
  }

  writeFileSync(outPath, content, 'utf8')
  console.log(`wrote ${outPath}`)
}

// Only run when executed directly (not when imported by the test suite)
if (import.meta.path === Bun.main) {
  main()
}
