/**
 * Meter parts: the separator between categorical parts, the forecast end mark and caption, the caption
 * gap at narrow widths, and a bar that fills its container.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Meter } from './meter'
import type { MeterProps } from './meter'
import { resetValidatedProps } from '../common/validate'
import { layoutSegments, modelBar } from './meter-model'

afterEach(cleanup)

const mount = (props: MeterProps) =>
  render(
    <MantineProvider>
      <Meter {...props} />
    </MantineProvider>,
  )
const css = readFileSync(new URL('./meter.module.css', import.meta.url), 'utf8')

describe('parts are told apart by a separator', () => {
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

  test('a zero-size part leaves no neighbour for the next one to be separated from', () => {
    const parts = layoutSegments(
      [
        { value: 0, label: 'A', color: 'red' },
        { value: 20, label: 'B', color: 'blue' },
      ],
      100,
    )
    expect(parts.map((p) => p.seam)).toEqual([false, false])
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

  test('the seam is a 2px separator, not a hairline', () => {
    expect(css).toMatch(/\[data-meter-seam\]\s*\{[^}]*border-inline-start:\s*2px solid/)
  })
})

describe('an all-muted parts bar', () => {
  const muted = (label: string) => ({ value: 20, label, tone: 'muted' as const })
  const warnings = () => errors.filter((c) => String(c[0]).includes('one slab')).length
  let errors: unknown[][] = []
  let original = console.error
  beforeEach(() => {
    resetValidatedProps()
    errors = []
    original = console.error
    console.error = (...a: unknown[]) => void errors.push(a)
  })
  afterEach(() => {
    console.error = original
  })

  test('warns once for three muted parts, however often it renders', () => {
    mount({ label: 'P', segments: [muted('A'), muted('B'), muted('C')] })
    mount({ label: 'P', segments: [muted('A'), muted('B'), muted('C')] })
    expect(warnings()).toBe(1)
  })
  test('two muted parts do not warn', () => {
    mount({ label: 'P', segments: [muted('A'), muted('B')] })
    expect(warnings()).toBe(0)
  })
  test('three muted parts and one coloured part do not warn', () => {
    mount({
      label: 'P',
      segments: [muted('A'), muted('B'), muted('C'), { value: 20, label: 'D', color: 'red' }],
    })
    expect(warnings()).toBe(0)
  })
  test('a forecast part is not counted', () => {
    mount({
      label: 'P',
      segments: [muted('A'), muted('B'), { ...muted('C'), forecast: true }],
    })
    expect(warnings()).toBe(0)
  })
  test('production is silent', () => {
    const env = process.env.NODE_ENV ?? 'test'
    process.env.NODE_ENV = 'production'
    try {
      mount({ label: 'P', segments: [muted('A'), muted('B'), muted('C')] })
    } finally {
      process.env.NODE_ENV = env
    }
    expect(warnings()).toBe(0)
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
