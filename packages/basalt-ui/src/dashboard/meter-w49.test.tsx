/**
 * Wave 49 Meter: a visible gap between adjacent parts, the forecast end mark and caption, the caption
 * gap at narrow widths, and a bar that fills its container.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, test } from 'bun:test'
import { Meter } from './meter'
import type { MeterProps } from './meter'
import { layoutSegments, modelBar } from './meter-model'

afterEach(cleanup)

const mount = (props: MeterProps) =>
  render(
    <MantineProvider>
      <Meter {...props} />
    </MantineProvider>,
  )
const css = readFileSync(new URL('./meter.module.css', import.meta.url), 'utf8')

describe('parts are told apart by a gap', () => {
  test('every part after a categorical one is seamed, coloured or muted', () => {
    const parts = layoutSegments(
      [
        { value: 30, label: 'A', color: 'red' },
        { value: 20, label: 'B', tone: 'muted' },
        { value: 20, label: 'C', color: 'blue' },
      ],
      100,
    )
    expect(parts.map((p) => p.seam)).toEqual([false, true, true])
  })

  test('a forecast part is not seamed: the boundary tick separates it', () => {
    const parts = layoutSegments(
      [
        { value: 30, label: 'A' },
        { value: 20, label: 'B', forecast: true },
      ],
      100,
    )
    expect(parts.map((p) => p.seam)).toEqual([false, false])
  })

  test('the seam is a 2px gap, not a hairline', () => {
    expect(css).toMatch(/\[data-meter-seam\]\s*\{[^}]*border-inline-start:\s*2px solid/)
  })
})

describe('an all-muted parts bar', () => {
  test('warns once in development', () => {
    const calls: unknown[][] = []
    const original = console.warn
    console.warn = (...a: unknown[]) => void calls.push(a)
    try {
      const muted = (label: string) => ({ value: 20, label, tone: 'muted' as const })
      mount({ label: 'P', segments: [muted('A'), muted('B'), muted('C')] })
      mount({ label: 'P', segments: [muted('A'), muted('B'), muted('C')] })
    } finally {
      console.warn = original
    }
    expect(calls.filter((c) => String(c[0]).includes('one slab')).length).toBe(1)
  })
})

describe('forecast end', () => {
  const segments = [
    { value: 50, label: 'Done' },
    { value: 20, label: 'Planned', forecast: true },
  ]

  test('a tick marks where the forecast ends, besides the boundary tick', () => {
    const { container } = mount({ label: 'C', segments })
    const at = (kind: string) =>
      container.querySelector<HTMLElement>(`[data-meter-tick="${kind}"]`)?.style.insetInlineStart
    expect(at('boundary')).toBe('50%')
    expect(at('forecastEnd')).toBe('70%')
  })

  test('no end tick when the forecast fills the track', () => {
    const { container } = mount({
      label: 'C',
      segments: [
        { value: 50, label: 'Done' },
        { value: 50, label: 'Planned', forecast: true },
      ],
    })
    expect(container.querySelector('[data-meter-tick="forecastEnd"]')).toBeNull()
  })

  test('the model anchors the forecast at its end and the reading at the boundary', () => {
    const m = modelBar({
      reading: 50,
      min: 0,
      max: 100,
      format: String,
      segments,
    })
    expect(m.forecastEndPct).toBe(70)
    expect(m.fillEndPct).toBe(50)
  })
})

describe('narrow widths and width', () => {
  test('captions keep at least one caption em between them', () => {
    expect(css).toMatch(
      /\.captions\s*\{[^}]*gap:\s*max\(var\(--vx-space-control-gap, 0\.375rem\), 1em\)/,
    )
  })

  test('a bar fills its container', () => {
    expect(css).toMatch(/\.root:has\(> \.trackBox\)\s*\{[^}]*inline-size:\s*100%/)
  })
})
