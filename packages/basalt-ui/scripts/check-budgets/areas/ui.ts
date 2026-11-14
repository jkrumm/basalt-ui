/**
 * Area: ui — the `./ui/*` modules' size (docs/v3/ARCHITECTURE.md section 3, quality-contract section 6).
 * G1 freeze. Every ceiling is the first complete build, measured by `../ui-bundle` (React `createRoot`
 * plus the modules, peers bundled, Vite production, `gzipSync` over every chunk, minus `base0`),
 * plus 5 percent, rounded up to 0.5 KB; it ratchets down only. Bytes, 1 KB = 1000 B.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { RowDef } from '../lib'
import { SRC, measureSource, reExportAll } from '../ui-bundle'

const TEN = [
  'button',
  'input',
  'select',
  'dialog',
  'tabs',
  'tooltip',
  'checkbox',
  'switch',
  'badge',
  'card',
]
const REST_OF_25 = [
  'menu',
  'popover',
  'combobox',
  'accordion',
  'alert',
  'field',
  'progress',
  'radio-group',
  'scroll-area',
  'separator',
  'sheet',
  'skeleton',
  'slider',
  'textarea',
  'toast',
]

const page = (names: readonly string[]): string =>
  reExportAll(Object.fromEntries(names.map((n) => [n.replaceAll('-', '_'), `ui/${n}`])))

/** Per primitive: that module's whole export surface over `base0` (a regression catch for a wrapper). */
const PER_PRIMITIVE: Readonly<Record<string, number>> = {
  accordion: 15000, // 14195 B
  alert: 6000, // 5300 B
  badge: 6000, // 5625 B
  button: 9500, // 8574 B
  card: 10000, // 9446 B
  checkbox: 15000, // 14142 B
  collapsible: 13000, // 11967 B
  combobox: 61500, // 58535 B
  'date-picker': 73500, // 69556 B
  dialog: 32000, // 30378 B
  field: 15000, // 13972 B
  input: 10000, // 9326 B
  kbd: 5500, // 5000 B
  menu: 62500, // 59304 B
  meter: 10500, // 9767 B
  num: 7000, // 6236 B
  'number-field': 18000, // 16912 B
  popover: 47000, // 44567 B
  progress: 10500, // 9676 B
  'radio-group': 18500, // 17153 B
  'scroll-area': 6000, // 5254 B
  segmented: 15000, // 14087 B
  select: 54500, // 51614 B
  separator: 7500, // 6767 B
  sheet: 44000, // 41473 B
  skeleton: 7000, // 6522 B
  slider: 21000, // 19636 B
  status: 5500, // 4999 B
  switch: 11500, // 10848 B
  table: 6000, // 5240 B
  tabs: 17500, // 16277 B
  textarea: 10000, // 9313 B
  toast: 18000, // 16709 B
  toolbar: 14000, // 12982 B
  tooltip: 39000, // 37123 B
  'virtual-list': 15000, // 13886 B
}

/** Value exports of one `src/ui/<name>.tsx`, by the bundler's own export scan (types erased). */
function valueExports(): number {
  const transpiler = new Bun.Transpiler({ loader: 'tsx' })
  return readdirSync(join(SRC, 'ui'))
    .filter((f) => /^[a-z-]+\.tsx$/.test(f))
    .reduce(
      (sum, f) => sum + transpiler.scan(readFileSync(join(SRC, 'ui', f), 'utf8')).exports.length,
      0,
    )
}

export const rows: readonly RowDef[] = [
  {
    id: 'ui-page-ten',
    order: 300,
    label: 'ui ten-primitive page (gzip B minus base0, src/ui, peers bundled)',
    // 81600 B measured. Informative target 95 KB (gap-perf 6.1); the seed is the measurement.
    ceiling: 86000,
    measure: () => measureSource(page(TEN)),
  },
  {
    id: 'ui-page-25',
    order: 301,
    label: 'ui 25-part argo-shaped page (gzip B minus base0, src/ui, peers bundled)',
    // 149718 B measured. Informative target 118 KB.
    ceiling: 157500,
    measure: () => measureSource(page([...TEN, ...REST_OF_25])),
  },
  ...Object.entries(PER_PRIMITIVE).map(([name, ceiling], i): RowDef => ({
    id: `ui-prim-${name}`,
    order: 310 + i,
    label: `ui/${name} (gzip B minus base0, peers bundled)`,
    ceiling,
    measure: () => measureSource(page([name])),
  })),
  {
    id: 'ui-value-exports',
    order: 350,
    label: 'ui value exports, every src/ui module (exact)',
    // 215 measured. Exact: a new value export is a row here and a consumer named for it; a lower
    // number ratchets the ceiling down in the same commit.
    ceiling: 215,
    measure: valueExports,
  },
]
