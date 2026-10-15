/** `foldBands` through the public barrel: the grouping `BandStrip` and `MirroredBars` run. */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { BandStrip, foldBands } from './index'

type Slot = { t: string; s: string }
const slots = (n: number): Slot[] =>
  Array.from({ length: n }, (_, i) => ({ t: `s${String(i).padStart(3, '0')}`, s: 'up' }))

describe('foldBands', () => {
  test('groups exactly as BandStrip hands them to merge', () => {
    const data = slots(600)
    const seen: string[][] = []
    renderToString(
      <BandStrip
        ariaLabel="Availability"
        data={data}
        x={(d) => d.t}
        states={[{ key: 'up', label: 'Up', color: 'var(--vx-good)' }]}
        getBand={(d) => ({ state: d.s })}
        fold={{
          merge: (g) => {
            seen.push(g.map((d) => d.t))
            return g[0] as Slot
          },
        }}
      />,
    )
    expect(seen.length).toBeGreaterThan(0)
    // 640px / 3px floor = 213 slots.
    const folded: string[][] = []
    foldBands(data, 213, (g) => {
      folded.push(g.map((d) => d.t))
      return g[0] as Slot
    })
    expect(folded).toEqual(seen)
  })

  test('merges equal runs, keeps the first datum, and passes short data through', () => {
    const data = slots(7)
    expect(foldBands(data, 3, (g) => g[0] as Slot).map((d) => d.t)).toEqual([
      's000',
      's003',
      's006',
    ])
    expect(foldBands(data, 7, () => ({ t: 'x', s: 'x' }))).toEqual(data)
    expect(foldBands(data, 0, (g) => g[0] as Slot)).toEqual([])
  })
})
