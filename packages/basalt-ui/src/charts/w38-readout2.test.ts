/**
 * Wave 38, hosted tooltip: the engine tooltip is painted on an opaque surface in both schemes.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'

describe('the engine tooltip', () => {
  test('layers the tooltip tint over the opaque elevated surface, through the one override', () => {
    const tip = readFileSync(new URL('./chart-box.module.css', import.meta.url), 'utf8')
    const rule = tip.match(/:global\(\.ts-chart-tooltip\)\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule.replaceAll(/\s+/g, ' ')).toContain(
      'var(--basalt-tooltip-surface, var(--vx-raised))',
    )
    expect(rule).toContain('var(--vx-raised) !important')
  })
})
