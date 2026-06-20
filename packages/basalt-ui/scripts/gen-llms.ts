/**
 * Generates packages/basalt-ui/llms.txt from the SURFACES SSOT + package.json.
 * The file is machine-readable for AI agents: package purpose, then one entry per published
 * subpath with import specifier, description, layer, and optional peers.
 *
 * Usage: bun packages/basalt-ui/scripts/gen-llms.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type DoctrineSpec, SURFACES } from '../src/surfaces'

const root = join(import.meta.dirname, '..', '..', '..')
const pkgPath = join(root, 'packages/basalt-ui/package.json')
const outPath = join(root, 'packages/basalt-ui/llms.txt')

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

// ── Per-subpath descriptions ──────────────────────────────────────────────────

const DESCRIPTIONS: Record<string, string> = {
  '.': 'BasaltProvider, createBasaltTheme, BasaltShell + sidebar/mobile-nav/breadcrumbs, NavCountBadge',
  './charts': 'visx chart primitives, sparklines, hooks, and token re-exports (Mantine-free)',
  './tokens':
    'VX token refs, buildPaletteCss, defineSeries, seriesTokens, groupTokens, alpha (Mantine-free)',
  './theme-lab': 'ThemeLabControls, applyOverrides, COLOR_GROUPS for live theme inspection',
  './vite': 'basaltViteConfig(opts) — Vite preset for basalt-ui consumer apps',
  './guard': 'checkSource, GUARD_RULES, Finding types — the headless theme-guard core',
  './query': 'createBasaltQueryClient, transport-agnostic unwrap, lazy BasaltQueryDevtools',
  './router-tanstack': 'TanStack Router bridge: useBasaltNav (active route) + useRouterBreadcrumbs',
  './forms':
    'Mantine form adapter: createForm, field, FormErrorSummary, useFormDraft (Standard Schema)',
  './notifications':
    'Mantine notifications: notify helpers, typed registry, persisted history, NotificationBell',
  './commands':
    'typed command bus + overlay controller, toSpotlightActions, ShortcutsHelp, BasaltOverlays',
  './data': 'TanStack Table + Virtual kinds: BasaltDataTable, BasaltVirtualList (Mantine-rendered)',
  './agent':
    'Headless streaming-chat layer: useAgentStream, edenTransport, PartList (Mantine-free)',
  './state': 'createPersistedState — versioned localStorage state primitive (Mantine-free)',
}

// ── Optional peer mapping per rule name ───────────────────────────────────────

function deriveOptionalPeers(rule: string | null): string[] {
  const prefixes: string[] = []
  switch (rule) {
    case 'query':
      prefixes.push('@tanstack/react-query', '@tanstack/react-query-devtools')
      break
    case 'router':
      prefixes.push('@tanstack/react-router')
      break
    case 'forms':
      prefixes.push('@mantine/form')
      break
    case 'notifications':
      prefixes.push('@mantine/notifications')
      break
    case 'commands':
      prefixes.push('@mantine/spotlight', '@mantine/modals')
      break
    case 'data':
      prefixes.push('@tanstack/react-table', '@tanstack/react-virtual')
      break
    case 'agent':
      prefixes.push('react-markdown', 'remark-gfm', 'use-stick-to-bottom')
      break
    default:
      break
  }
  return prefixes
    .filter((p) => optionalPeerSet.has(p) && p in peerDeps)
    .map((p) => `${p}@${peerDeps[p]}`)
}

// ── Build rows from SURFACES ──────────────────────────────────────────────────

type Row = {
  importSpec: string
  description: string
  layer: string
  optionalPeers: string[]
}

const rows: Row[] = []

for (const [key, spec] of Object.entries(SURFACES)) {
  if (key.startsWith('#')) continue
  if (!publishedExportKeys.has(key)) continue

  const importSpec = `basalt-ui${key === '.' ? '' : key.slice(1)}`
  const docSpec = spec.kind === 'doctrine' ? (spec as DoctrineSpec) : null
  const rule = docSpec?.rule ?? null

  rows.push({
    importSpec,
    description: DESCRIPTIONS[key] ?? `basalt-ui${key === '.' ? '' : key} subpath`,
    layer: spec.layer,
    optionalPeers: deriveOptionalPeers(rule),
  })
}

// Also add ./state (synthetic #state key, published export).
if (publishedExportKeys.has('./state') && !rows.some((r) => r.importSpec === 'basalt-ui/state')) {
  rows.push({
    importSpec: 'basalt-ui/state',
    description: DESCRIPTIONS['./state'] ?? 'basalt-ui/state subpath',
    layer: 'mantine-coupled',
    optionalPeers: [],
  })
}

// ── Emit llms.txt ─────────────────────────────────────────────────────────────

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
  lines.push(`Import: import { ... } from '${row.importSpec}'`)
  lines.push(`Description: ${row.description}`)
  lines.push(`Layer: ${row.layer}`)
  if (row.optionalPeers.length > 0) {
    lines.push(`OptionalPeers: ${row.optionalPeers.join(', ')}`)
  }
  lines.push('')
}

const content = lines.join('\n')
writeFileSync(outPath, content, 'utf8')
console.log(`wrote ${outPath}`)
