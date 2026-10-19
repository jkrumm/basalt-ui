/**
 * Wave 38, hosted readouts: tightening only shrinks the chip's padding (the separator and the air
 * round it never drop), and the chip is painted on an opaque surface in both schemes.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'

const css = readFileSync(new URL('./sparkline.module.css', import.meta.url), 'utf8')
const rule = (selector: string): string =>
  css.match(new RegExp(`${selector.replaceAll(/[.[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

describe('the Sparkline readout chip', () => {
  test('tight mode touches padding and nothing on the separator', () => {
    expect(rule('.readout[data-tight]')).toContain('padding-inline')
    expect(css).not.toContain('.readout[data-tight] .sep')
    expect(css).not.toMatch(/letter-spacing|word-spacing/)
  })

  test('the chip background layers the tooltip tint over the opaque elevated surface', () => {
    const bg = rule('.readout').replaceAll(/\s+/g, ' ')
    expect(bg).toContain('var(--basalt-tooltip-surface, var(--vx-tooltip-bg))')
    expect(bg).toMatch(/\) var\(--vx-surface-elevated\);/)
  })

  test('the engine tooltip gets the same layering, through the one override', () => {
    const tip = readFileSync(new URL('./chart-box.module.css', import.meta.url), 'utf8')
    const rule2 = tip.match(/:global\(\.ts-chart-tooltip\)\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule2.replaceAll(/\s+/g, ' ')).toContain(
      'var(--basalt-tooltip-surface, var(--vx-tooltip-bg))',
    )
    expect(rule2).toContain('var(--vx-surface-elevated) !important')
  })
})
