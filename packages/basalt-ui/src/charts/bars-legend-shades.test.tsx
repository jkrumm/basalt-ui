/** A `Bars` legend swatch wears the shade its bars draw (`barOpacity` / `fillOpacity`), not a flat colour. */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Bars } from './Bars'
import type { BarsBar } from './Bars'

type Row = { t: Date; a: number; b: number; c: number }
const data: Row[] = [1, 2, 3].map((d) => ({ t: new Date(Date.UTC(2026, 8, d)), a: d, b: d, c: d }))
const bar = (key: 'a' | 'b' | 'c', extra?: Partial<BarsBar<Row>>): BarsBar<Row> => ({
  key,
  label: key.toUpperCase(),
  color: 'var(--vx-accent)',
  getValue: (d) => d[key],
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
  test('per-bar shades from barOpacity reach the swatches', async () => {
    const shades = { a: 0.3, b: 0.9, c: 0.6 }
    const got = await swatchOpacities(
      <Bars
        ariaLabel="shades"
        data={data}
        height={200}
        x={(d) => d.t}
        bars={[bar('a'), bar('b'), bar('c')]}
        barOpacity={(_, key) => shades[key as 'a' | 'b' | 'c']}
      />,
    )
    expect(got).toMatchObject({ a: '0.3', b: '0.9', c: '0.6' })
  })

  test('without barOpacity the swatch uses fillOpacity, else the 0.85 default', async () => {
    const got = await swatchOpacities(
      <Bars
        ariaLabel="defaults"
        data={data}
        height={200}
        x={(d) => d.t}
        bars={[bar('a', { fillOpacity: 0.5 }), bar('b')]}
      />,
    )
    expect(got).toMatchObject({ a: '0.5', b: '0.85' })
  })
})
