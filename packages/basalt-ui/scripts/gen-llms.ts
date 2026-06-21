/**
 * Generates packages/basalt-ui/llms.txt from the SURFACES SSOT + package.json.
 * The file is machine-readable for AI agents: package purpose, then one entry per published
 * subpath with import specifier, description, layer, and optional peers.
 *
 * Usage: bun packages/basalt-ui/scripts/gen-llms.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SURFACES } from '../src/surfaces'

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

// ── Build rows from SURFACES ──────────────────────────────────────────────────

type Row = {
  importSpec: string
  description: string
  layer: string
  optionalPeers: string[]
  /** true for non-JS assets (styles.css, configs/*, llms.txt) — no import line emitted */
  isAsset?: boolean
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
  const resolvedPeers = specPeers
    .filter((p) => optionalPeerSet.has(p) && p in peerDeps)
    .map((p) => `${p}@${peerDeps[p]}`)

  rows.push({
    importSpec,
    description: spec.description ?? `basalt-ui${key === '.' ? '' : key} subpath`,
    layer: spec.layer,
    optionalPeers: resolvedPeers,
    isAsset,
  })
}

// ── Emit llms.txt ─────────────────────────────────────────────────────────────

export function generateLlmsTxt(): string {
  const lines: string[] = [
    `# ${pkg.name} v${pkg.version}`,
    `# ${pkg.description ?? 'Opinionated framework for Mantine-based React apps'}`,
    '#',
    '# basalt-ui is an opinionated framework for Mantine-based React apps.',
    '# It provides a theme + cssVariablesResolver, a BasaltProvider, an app shell',
    '# (BasaltShell + sidebar/mobile-nav/breadcrumbs), a visx chart system with a',
    '# three-tier --vx-* CSS-variable token system, adapter batteries for TanStack',
    '# Query/Router, Mantine forms/notifications/commands, a streaming-chat agent',
    '# layer, and toolchain presets (oxlint, oxfmt, tsconfig, lefthook, CI).',
    '# BasaltRegister is the unifying type-augmentation interface for consumer-side',
    '# extension (series tokens, command registry, notification registry).',
    '#',
    '# Subpaths: use the exact import specifier below — do not guess.',
    '# Charts and tokens are Mantine-free; the root (.) is Mantine-coupled.',
    '# Optional peers are listed per subpath; install only what you use.',
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
    if (row.optionalPeers.length > 0) {
      lines.push(`OptionalPeers: ${row.optionalPeers.join(', ')}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// Only run when executed directly (not when imported by the test suite)
if (import.meta.path === Bun.main) {
  const content = generateLlmsTxt()
  writeFileSync(outPath, content, 'utf8')
  console.log(`wrote ${outPath}`)
}
