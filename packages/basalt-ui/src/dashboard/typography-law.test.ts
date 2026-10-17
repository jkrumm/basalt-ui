/**
 * The Wave 35 typography law (docs/DESIGN-CORE.md § Typography): hero values, row labels and body
 * text are the proportional sans with lining figures; `tabular-nums` only in table columns and axis
 * ticks; mono only for captions, times and code. Pinned against the shipped CSS text, the same way
 * `stat-card.test.tsx` pins its rules.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'

const read = (file: string): string =>
  readFileSync(resolve(import.meta.dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `${selector} rule exists`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

const statCard = read('dashboard/stat-card.module.css')
const widgetHeader = read('dashboard/widget-header.module.css')
const meter = read('dashboard/meter.module.css')
const barList = read('dashboard/bar-list.module.css')
const styles = read('styles.css')

const NUMERALS: ReadonlyArray<readonly [string, string, string]> = [
  ['StatCard hero value', statCard, '.value'],
  ['StatCard unit', statCard, '.unit'],
  ['StatCard breakdown value', statCard, '.breakdownValue'],
  ['WidgetHeader hero value', widgetHeader, '.value'],
  ['WidgetHeader unit', widgetHeader, '.unit'],
  ['WidgetHeader / Section count chip', widgetHeader, '.count'],
  ['DeltaBadge text', widgetHeader, '.deltaBadge'],
  ['BarList value', barList, '.value'],
  ['BarList secondary', barList, '.secondary'],
  ['Meter ring value', meter, '.ringValue'],
  ['Meter zone reading row', meter, '.zoneReadingRow'],
  ['Meter captions', meter, '.captions'],
  ['Meter part captions', meter, '.partCaptions'],
  ['Meter zone band', meter, '.zoneBand'],
  ['Meter zone list', meter, '.zoneList'],
]

describe('numerals are proportional sans with lining figures', () => {
  for (const [name, css, selector] of NUMERALS) {
    test(name, () => {
      const r = rule(css, selector)
      expect(r).toContain('font-family: var(--basalt-font-numeral')
      expect(r).toContain('font-variant-numeric: lining-nums')
      expect(r).not.toContain('--basalt-font-mono')
      expect(r).not.toContain('tabular-nums')
    })
  }

  test('the numeral face defaults to the sans, and is the one documented opt-out', () => {
    expect(styles).toMatch(/--basalt-font-numeral:\s*var\(--basalt-font-sans\)/)
  })
})

describe('mono stays for captions and times', () => {
  test('the StatCard uppercase caption and qualifier', () => {
    expect(rule(statCard, '.caption')).toContain('--basalt-font-mono')
    expect(rule(statCard, '.qualifier')).toContain('--basalt-font-mono')
  })
  test('the group-tier heading micro-label', () => {
    expect(rule(widgetHeader, ".root[data-tier='group'] .heading")).toContain('--basalt-font-mono')
  })
})

describe('the heading face', () => {
  test('does not enable the slashed zero and keeps lining figures', () => {
    const r = rule(styles, '.mantine-Title-root')
    expect(r).toContain("font-feature-settings: 'zero' 0")
    expect(r).toContain('font-variant-numeric: lining-nums')
  })
})
