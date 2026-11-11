/** A `Bars` legend swatch wears the shade its bars draw (per-datum `opacity`, the shared-colour step, the 0.85 default), not a flat colour. */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { SeriesColor } from '../contract'
import { Bars } from './bars'
import type { BarsSeries } from './bars'

type Row = { t: Date; a: number; b: number; c: number }
const data: Row[] = [1, 2, 3].map((d) => ({ t: new Date(Date.UTC(2026, 8, d)), a: d, b: d, c: d }))
const accent: SeriesColor = { light: 'var(--vx-accent)', dark: 'var(--vx-accent)' }
const line: SeriesColor = { light: 'var(--vx-line)', dark: 'var(--vx-line)' }
const bar = (
  key: 'a' | 'b' | 'c',
  extra: Partial<Extract<BarsSeries<Row>, { mark: 'bar' }>> = {},
  color: SeriesColor = accent,
): BarsSeries<Row> => ({
  mark: 'bar',
  key,
  label: key.toUpperCase(),
  color,
  y: (d) => d[key],
  ...extra,
})

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function swatchOpacities(node: React.ReactNode): Promise<Record<string, string>> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(node)
  })
  const out: Record<string, string> = {}
  for (const entry of el.querySelectorAll<HTMLElement>('[data-legend-key]')) {
    const chip = entry.querySelector<HTMLElement>('span[aria-hidden]')
    out[entry.getAttribute('data-legend-key') ?? ''] = chip?.style.opacity ?? ''
  }
  return out
}

describe('Bars legend swatches', () => {
  test('per-datum opacity reaches the swatch, sampled on the first row', async () => {
    const shades = { a: 0.3, b: 0.9 }
    const got = await swatchOpacities(
      <Bars
        ariaLabel="shades"
        data={data}
        height={200}
        x={{ value: (d) => d.t }}
        series={[
          bar('a', { opacity: () => shades.a }, accent),
          bar('b', { opacity: () => shades.b }, line),
        ]}
      />,
    )
    expect(got).toMatchObject({ a: '0.3', b: '0.9' })
  })

  test('same-coloured bars step down in the legend as on the plot', async () => {
    const got = await swatchOpacities(
      <Bars
        ariaLabel="steps"
        data={data}
        height={200}
        x={{ value: (d) => d.t }}
        series={[bar('a'), bar('b')]}
      />,
    )
    expect(got).toMatchObject({ a: '1', b: '0.4' })
  })

  test('distinct colours keep the 0.85 default', async () => {
    const got = await swatchOpacities(
      <Bars
        ariaLabel="defaults"
        data={data}
        height={200}
        x={{ value: (d) => d.t }}
        series={[bar('a', {}, accent), bar('b', {}, line)]}
      />,
    )
    expect(got).toMatchObject({ a: '0.85', b: '0.85' })
  })
})
