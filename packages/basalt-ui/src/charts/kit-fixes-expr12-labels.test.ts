/**
 * Expression cycle 12 kit fixes (`v3-expr-12-kit-fixes` 7): `chartLabels.place` keeps a label
 * beside its anchor in a dense dot cloud, and a dropped label says so in a dev build.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { chartLabels } from './chart-labels'
import type { ChartLabel, LabelBox } from './chart-labels'

const FRAME = { width: 400, height: 200 }

/** A grid of 6 px dots every 7 px over the whole frame: no spot of any label is free. */
const CLOUD: LabelBox[] = Array.from({ length: 28 * 57 }, (_, i) => ({
  left: (i % 57) * 7,
  top: Math.floor(i / 57) * 7,
  width: 6,
  height: 6,
}))

const label = (key: string, x: number, y: number, priority = 0): ChartLabel => ({
  key,
  text: key,
  x,
  y,
  priority,
})

afterEach(() => {
  spyOn(console, 'warn').mockRestore()
})

describe('place in a dense cloud of point marks', () => {
  test('a label stays beside its anchor instead of dropping', () => {
    const { placed, dropped } = chartLabels.place([label('Fitness First', 200, 100)], FRAME, {
      obstacles: CLOUD,
    })
    expect(dropped).toEqual([])
    const [at] = placed
    expect(at).toBeDefined()
    // Within a label's width and a few lines of the anchor, never 100 px away.
    expect(Math.abs(at!.dx)).toBeLessThanOrEqual(at!.width + 8)
    expect(Math.abs(at!.dy)).toBeLessThanOrEqual(at!.height * 1.5)
  })

  test('two labels in the cloud still never overlap each other', () => {
    const { placed } = chartLabels.place(
      [label('Lieferando', 200, 100), label('dm', 210, 104)],
      FRAME,
      {
        obstacles: CLOUD,
      },
    )
    expect(placed).toHaveLength(2)
    const [a, b] = placed as [(typeof placed)[number], (typeof placed)[number]]
    const apart =
      a.left + a.width <= b.left ||
      b.left + b.width <= a.left ||
      a.top + a.height <= b.top ||
      b.top + b.height <= a.top
    expect(apart).toBe(true)
  })

  test('a free spot still wins over a crowded one', () => {
    const { placed } = chartLabels.place([label('Edge', 20, 20)], FRAME, {
      obstacles: [{ left: 25, top: 14, width: 6, height: 6 }],
    })
    expect(placed[0]?.spot).not.toBe('right')
  })

  test('a larger obstacle on every spot still drops the label', () => {
    const wall: LabelBox = { left: 0, top: 0, width: FRAME.width, height: FRAME.height }
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    const { placed, dropped } = chartLabels.place([label('Walled', 200, 100)], FRAME, {
      obstacles: [wall],
    })
    expect(placed).toEqual([])
    expect(dropped.map((l) => l.key)).toEqual(['Walled'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('Walled')
  })
})

describe('a dropped label in a dev build', () => {
  test('warns once per key and frame, and a placed label stays silent', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    const wall: LabelBox = { left: 0, top: 0, width: 300, height: 120 }
    const frame = { width: 300, height: 120 }
    chartLabels.place([label('Quiet', 150, 60)], { width: 600, height: 400 })
    expect(warn).not.toHaveBeenCalled()
    chartLabels.place([label('Twice', 150, 60)], frame, { obstacles: [wall] })
    chartLabels.place([label('Twice', 150, 60)], frame, { obstacles: [wall] })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
