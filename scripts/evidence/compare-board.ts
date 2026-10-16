/**
 * `make compare` — the pure half: Keel inventory parsing, the metric/Δ table and the board page.
 * No browser, no file system; `compare.ts` feeds it. Keel is only ever read through the committed
 * `docs/waves/design-parity/keel/inventory.json`, which may be absent or partial.
 */
import { isAbsolute, relative, sep } from 'node:path'
import { EXPECTED_IDS, METRIC_KEYS, isMissing } from './compare-patterns'
import type { MetricKey, Metrics, PatternMapping } from './compare-patterns'

export const VIEWPORTS = ['desktop', 'mobile'] as const
export const SCHEMES = ['dark', 'light'] as const
export type Viewport = (typeof VIEWPORTS)[number]
export type Scheme = (typeof SCHEMES)[number]
export type PairKey = `${Scheme}-${Viewport}`

export const pairKey = (scheme: Scheme, viewport: Viewport): PairKey => `${scheme}-${viewport}`
/** Board order: both schemes of a viewport sit together. */
export const PAIR_KEYS: readonly PairKey[] = VIEWPORTS.flatMap((v) =>
  SCHEMES.map((s) => pairKey(s, v)),
)

export type InventoryPattern = {
  id: string
  name: string
  route: string
  selectorNote: string
  instances: number | null
  /** Repo-root-relative paths, e.g. `.design-parity/keel/patterns/<id>--dark--desktop.png`. */
  crops: Partial<Record<PairKey, string>>
  metrics: Partial<Record<Viewport, Metrics>>
  notes: string
}
export type Inventory = { capturedAt: string; origin: string; patterns: InventoryPattern[] }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function parseMetrics(raw: unknown): Metrics {
  const out: Metrics = {}
  if (!isRecord(raw)) return out
  for (const key of METRIC_KEYS) {
    const v = raw[key]
    if ((typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v !== '')) {
      out[key] = v
    }
  }
  return out
}

function parsePattern(raw: unknown): InventoryPattern | null {
  if (!isRecord(raw) || typeof raw['id'] !== 'string' || raw['id'] === '') return null
  const crops: Partial<Record<PairKey, string>> = {}
  if (isRecord(raw['crops'])) {
    for (const key of PAIR_KEYS) {
      const p = raw['crops'][key]
      if (typeof p === 'string' && p !== '') crops[key] = p
    }
  }
  const metrics: Partial<Record<Viewport, Metrics>> = {}
  if (isRecord(raw['metrics'])) {
    for (const v of VIEWPORTS)
      if (isRecord(raw['metrics'][v])) metrics[v] = parseMetrics(raw['metrics'][v])
  }
  const instances = raw['instances']
  return {
    id: raw['id'],
    name: str(raw['name']) || raw['id'],
    route: str(raw['route']),
    selectorNote: str(raw['selectorNote']),
    instances: typeof instances === 'number' ? instances : null,
    crops,
    metrics,
    notes: str(raw['notes']),
  }
}

/**
 * `null`/`undefined` (no file yet — the capture lands in parallel) is an empty inventory. A file that
 * IS present but unparseable or the wrong shape throws: silently rendering "reference pending" for a
 * corrupt reference would hide the breakage. Within a valid file, entries without an id are skipped.
 */
export function parseInventory(text: string | null | undefined): Inventory {
  if (text === null || text === undefined) return { capturedAt: '', origin: '', patterns: [] }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    throw new Error(
      `inventory.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
  if (!isRecord(raw) || !Array.isArray(raw['patterns'])) {
    throw new Error('inventory.json is invalid: expected an object with a "patterns" array')
  }
  const patterns = raw['patterns']
    .map(parsePattern)
    .filter((p): p is InventoryPattern => p !== null)
  return { capturedAt: str(raw['capturedAt']), origin: str(raw['origin']), patterns }
}

/** True when `target` resolves strictly inside `root` — a sibling sharing a name prefix is outside. */
export function isInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

/** The expected ids first, then whatever else the capture added, each once. */
export function patternIds(inventory: Inventory): string[] {
  const ids: string[] = [...EXPECTED_IDS]
  for (const p of inventory.patterns) if (!ids.includes(p.id)) ids.push(p.id)
  return ids
}

// ── Metrics table ─────────────────────────────────────────────────────────────────────────────

export type MetricRow = {
  metric: MetricKey
  keel: number | string
  basalt: number | string
  delta: string
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** `basalt − keel` for numbers (signed), `=`/`≠` for role strings, `–` when the types differ. */
export function metricDelta(keel: number | string, basalt: number | string): string {
  if (typeof keel === 'string' && typeof basalt === 'string') return keel === basalt ? '=' : '≠'
  if (typeof keel !== 'number' || typeof basalt !== 'number') return '–'
  const delta = round2(basalt - keel)
  // `String(-0)` is '0', so a negative zero cannot print as `-0`.
  return delta > 0 ? `+${delta}` : String(delta)
}

/** Only keys both sides measured, in contract order. */
export function metricRows(keel: Metrics | undefined, basalt: Metrics | undefined): MetricRow[] {
  const rows: MetricRow[] = []
  for (const metric of METRIC_KEYS) {
    const k = keel?.[metric]
    const b = basalt?.[metric]
    if (k === undefined || b === undefined) continue
    rows.push({ metric, keel: k, basalt: b, delta: metricDelta(k, b) })
  }
  return rows
}

// ── Board page ────────────────────────────────────────────────────────────────────────────────

export type BasaltResult = {
  crops: Partial<Record<PairKey, string>>
  metrics: Partial<Record<Viewport, Metrics>>
  errors: Partial<Record<PairKey, string>>
}
export type BoardEntry = {
  id: string
  mapping: PatternMapping
  keel: InventoryPattern | undefined
  /** Keel crops that exist on disk, relative to `board.html`. */
  keelCrops: Partial<Record<PairKey, string>>
  basalt: BasaltResult
}

export function esc(text: string | number): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const img = (src: string, alt: string): string =>
  `<img src="${esc(src)}" alt="${esc(alt)}" loading="eager">`
const note = (cls: string, text: string): string => `<div class="note ${cls}">${esc(text)}</div>`

function basaltCell(entry: BoardEntry, key: PairKey): string {
  if (isMissing(entry.mapping)) return note('missing', `missing: ${entry.mapping.missing}`)
  const crop = entry.basalt.crops[key]
  if (crop) return img(crop, `${entry.id} basalt ${key}`)
  const error = entry.basalt.errors[key]
  return note('failed', error ? `failed: ${error}` : 'not captured')
}

function keelCell(entry: BoardEntry, key: PairKey): string {
  const crop = entry.keelCrops[key]
  return crop ? img(crop, `${entry.id} keel ${key}`) : note('pending', 'reference pending')
}

function metricsTable(entry: BoardEntry, viewport: Viewport): string {
  const rows = metricRows(entry.keel?.metrics[viewport], entry.basalt.metrics[viewport])
  if (rows.length === 0) return ''
  const body = rows
    .map(
      (r) =>
        `<tr><td>${esc(r.metric)}</td><td>${esc(r.keel)}</td><td>${esc(r.basalt)}</td><td>${esc(r.delta)}</td></tr>`,
    )
    .join('')
  return `<table><caption>${viewport}</caption><thead><tr><th>metric</th><th>Keel</th><th>basalt</th><th>Δ</th></tr></thead><tbody>${body}</tbody></table>`
}

function section(entry: BoardEntry): string {
  const pairs = PAIR_KEYS.filter(
    (k) =>
      entry.keelCrops[k] !== undefined ||
      entry.basalt.crops[k] !== undefined ||
      entry.basalt.errors[k] !== undefined,
  )
  // Nothing captured on either side still renders one row per default pair, so the gap is visible.
  const shown = pairs.length > 0 ? pairs : PAIR_KEYS.filter((k) => k.startsWith('dark-'))
  const rows = shown
    .map(
      (k) =>
        `<div class="pair"><h3>${esc(k)}</h3><div class="cell"><h4>Keel</h4>${keelCell(entry, k)}</div><div class="cell"><h4>basalt</h4>${basaltCell(entry, k)}</div></div>`,
    )
    .join('')
  const name = entry.keel?.name ?? entry.id
  const mapNote = isMissing(entry.mapping)
    ? `basalt: missing — ${entry.mapping.missing}`
    : `basalt: ${entry.mapping.route} — ${entry.mapping.note}`
  const keelNote = [entry.keel?.selectorNote, entry.keel?.notes].filter(Boolean).join(' · ')
  return `<section id="${esc(entry.id)}"><h2>${esc(name)} <code>${esc(entry.id)}</code></h2><p class="meta">${esc(mapNote)}</p>${keelNote ? `<p class="meta">Keel: ${esc(keelNote)}</p>` : ''}${rows}${VIEWPORTS.map((v) => metricsTable(entry, v)).join('')}</section>`
}

const CSS = `
:root{color-scheme:light dark;font:13px/1.4 system-ui,sans-serif}
body{margin:0;padding:16px;background:#fff;color:#111}
h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:0 0 4px}h3,h4{margin:0;font-size:11px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
code{font-size:11px;background:#eee;padding:1px 4px;border-radius:3px}
section{border-top:1px solid #ccc;padding:16px 0}
.meta{margin:0 0 8px;color:#555}
.pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 16px;margin-bottom:12px}
.pair>h3{grid-column:1/-1}
.cell{min-width:0}.cell img{max-width:100%;height:auto;display:block;border:1px solid #ddd;margin-top:4px}
.note{margin-top:4px;padding:12px;border:1px dashed #aaa;color:#666}
.note.failed{border-color:#c33;color:#c33}
table{border-collapse:collapse;margin:8px 0;font-size:12px}caption{text-align:left;font-weight:600;padding:2px 0}
th,td{border:1px solid #ddd;padding:2px 8px;text-align:left}
@media(max-width:700px){.pair{grid-template-columns:minmax(0,1fr)}}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}code{background:#222}section{border-color:#333}.cell img,th,td{border-color:#333}.meta{color:#aaa}}
`

export function buildBoardHtml(params: {
  label: string
  inventory: Inventory
  entries: readonly BoardEntry[]
}): string {
  const { label, inventory, entries } = params
  const pending = entries.filter((e) => Object.keys(e.keelCrops).length === 0).length
  const keelLine = inventory.patterns.length
    ? `Keel inventory: ${inventory.patterns.length} patterns${inventory.capturedAt ? `, captured ${inventory.capturedAt}` : ''}`
    : 'Keel inventory: absent — every reference is pending'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Design parity — ${esc(label)}</title><style>${CSS}</style></head><body><h1>Design parity — ${esc(label)}</h1><p class="meta">${esc(keelLine)}. ${pending} of ${entries.length} patterns have no reference crop yet.</p>${entries.map(section).join('')}</body></html>`
}
