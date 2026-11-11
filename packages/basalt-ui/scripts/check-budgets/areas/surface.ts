/**
 * Area: surface — the public API's size. Value symbols outside `./charts`, barrel type exports,
 * published subpaths. (docs/V2-SPEC.md § 1: 140 public value symbols = 92 non-chart + § 9's chart
 * allowance of 48.) A ceiling falls to its target in the commit that lands the work.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CHART_SUBPATH } from '../../surface-gates'
import type { Manifest, Surface } from '../../surface-gates'
import { PKG_ROOT, Unmeasured, readManifest, readSurface } from '../lib'
import type { Raise, RowDef } from '../lib'

/** Value exports of every subpath except `./charts`, which is budgeted apart. */
function nonChartSymbols(surface: Surface): number {
  return Object.entries(surface)
    .filter(([subpath]) => subpath !== CHART_SUBPATH)
    .reduce((sum, [, names]) => sum + names.length, 0)
}

/**
 * Non-chart barrel type exports: names in `export type { … }` / `export { type X }` clauses of each
 * non-chart subpath's source entry. Counted from source so it needs no build; unmeasured when an
 * entry is missing (a half-moved tree cannot vouch for the number).
 */
function barrelTypeExports(manifest: Manifest): number {
  let total = 0
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    const js = typeof target === 'object' && target !== null ? target.import : undefined
    // A wildcard entry (`./ui/*`) has no single barrel to count types from, and `./shell` is the 2.x
    // shell barrel the root already re-exports (counted there) until the v3 shell swaps it.
    if (
      js === undefined ||
      js.includes('*') ||
      subpath === CHART_SUBPATH ||
      subpath === './shell'
    ) {
      continue
    }
    const base = join(PKG_ROOT, 'src', js.replace(/^\.\/dist\//, '').replace(/\.js$/, ''))
    const entry = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find(existsSync)
    if (entry === undefined) throw new Unmeasured(`no source entry for ${subpath}`)
    const source = readFileSync(entry, 'utf8')
    for (const m of source.matchAll(/export\s+type\s*\{([^}]*)\}/g)) {
      total += (m[1] ?? '').split(',').filter((name) => name.trim() !== '').length
    }
    for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
      total += (m[1] ?? '').split(',').filter((name) => /^\s*type\s/.test(name)).length
    }
  }
  return total
}

export const rows: readonly RowDef[] = [
  {
    id: 'non-chart-symbols',
    order: 10,
    label: 'public value symbols, non-chart (export-surface shards)',
    // 2.0 target 92.
    ceiling: 112, // v3 cards-1: `StatCard` from `./cards` (linewatch StatusBar, console; the 2.x root `StatCard` retires with the dashboard barrel); v3 state-1b: root `externalField` (the 2.x `./state` one stays until the state subpath retires); W45: `Board` (argo warden board prototype, SPEC § 6.8); W44: `EventList` (argo narratives-section + home activity feed prototype, warden item timeline; rb journal; linewatch transition timeline; SPEC § 6.7); W37: `PageSummary` (argo components/upstream/page-summary.tsx, SPEC § 6.9; UPSTREAM Waves 24-26); 2.19 (W35): `StatusDot`, `StatusVerdict` (argo warden/agents status chips; status is a dot plus a word, D28); 2.18 (W34): `Meter` (argo reading card, warden dispatch budget, usage cache hit; rb course + ingest; linewatch link vs ceiling; ledger rows 143–145, 152, 158), `BarList` (argo top projects, weatherorb factor bars; rows 146, 160); 2.14: `date`/`time`/`dateTime`/`duration` (rb + linewatch format.ts, argo walking-pad; consumer-05); `bytes`/`compact`/`delta`/`defineFormat` (linewatch + rb format.ts, argo sparkline; maturation-v2 consumer-05); 2.13: `basaltRouterOptions` (weatherorb `getRouter()`, maturation-v2 provider-01); 2.6: `externalField` (argo timer-card.tsx, row 39); was 93 for `toAgentError` (row 18)
    measure: () => nonChartSymbols(readSurface()),
  },
  {
    id: 'barrel-types',
    order: 30,
    label: 'barrel type exports, non-chart (src entries)',
    // 2.0 target 60.
    ceiling: 73, // v3 cards-1: `StatCardProps` from `./cards`; W45: `BoardProps` (card and column shapes stay inline: `BoardProps['columns'][number]`); W44: `EventListProps` (argo/rb/linewatch read the item shape off `EventListProps['items'][number]`; it stays inline); W37: `PageSummaryProps`; 2.19 (W35): `MeterSegment`, `MeterZone`, `MeterTick` (argo types its zone/segment helpers off them, UPSTREAM § basalt friction); 2.19 (W35): `StatusDotProps`, `StatusVerdictProps` (the two status primitives); `StatStripCell`, `StatStripRow` (argo strip prototypes: garmin-health, agents, warden stat-strip.tsx; rows 147, 156); 2.18 (W34): `MeterProps`, `BarListProps` (the two W34 primitives; segment/item shapes stay inline)
    measure: () => barrelTypeExports(readManifest()),
  },
  {
    id: 'subpaths',
    order: 40,
    label: 'published subpaths (package.json exports)',
    // 2.0 target 15.
    ceiling: 31, // v3 skeleton: 15 (2.x) + 16 additive entries (see docs/v3/ARCHITECTURE.md § 3); consumers: rollhook for CSS, lint, testing; linewatch for ui, page, cards, data, router; ratchets down as 2.x subpaths retire
    measure: () => Object.keys(readManifest().exports ?? {}).length,
  },
]

export const raises: readonly Raise[] = [
  {
    ceiling: 'non-chart-symbols',
    from: 110,
    to: 111,
    consumer: 'root `externalField`, the ControlHandle bridge for the shutterflow memory store',
    repo: 'shutterflow',
  },
  {
    ceiling: 'non-chart-symbols',
    from: 111,
    to: 112,
    consumer: '`StatCard` from `./cards`, the stat card anatomy linewatch StatusBar hand-rolls',
    repo: 'linewatch',
  },
  {
    ceiling: 'barrel-types',
    from: 72,
    to: 73,
    consumer: '`StatCardProps` from `./cards`, read by linewatch to type its status cells',
    repo: 'linewatch',
  },
]
