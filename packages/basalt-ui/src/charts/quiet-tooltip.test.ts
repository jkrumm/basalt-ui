/**
 * `quietWhileFollowing` against the bare extension contract (create → update → paint), no chart:
 * the cases the mounted cursor tests (`engine.test.tsx`) cannot reach.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import type {
  ChartTooltipExtension,
  ChartTooltipOptions,
  ChartTooltipPaintContext,
} from '@tanstack/charts/tooltip'
import {
  TOOLTIP_READOUT,
  chartCursor,
  followerOptions,
  quietWhileFollowing,
  withTooltipRole,
} from './cursor'

let release: (() => void) | undefined
afterEach(() => {
  release?.()
  release = undefined
  chartCursor().setState(null)
  document.body.innerHTML = ''
})

const mountHost = () => {
  const container = document.createElement('div')
  document.body.append(container)
  const host = quietWhileFollowing.create({
    container,
    dismiss: () => {},
    bodyChange: () => undefined,
  })
  return { container, host }
}
/** Only reached if the wrapper wrongly defers to the real host, which would throw on it. */
const paintContext = {} as ChartTooltipPaintContext
const tooltipsIn = (el: Element): number => el.querySelectorAll(TOOLTIP_READOUT).length

/** A state no chart stamped: foreign to every chart. */
const foreignState = (): void => {
  // A group's entry exists only while something subscribes; a write to none is dropped.
  release?.()
  release = chartCursor().subscribe(() => {})
  chartCursor().setState({
    anchor: 'value',
    value: { x: new Date(Date.UTC(2026, 8, 1)) },
    source: 'programmatic',
    pinned: false,
  })
}

describe('quietWhileFollowing', () => {
  test('a paint before the first update hides: nobody has said who leads', () => {
    foreignState()
    const { container, host } = mountHost()
    expect(() => host.paint(paintContext)).not.toThrow()
    expect(tooltipsIn(container)).toBe(0)
  })

  test('a follower (foreign state, group named or not) never creates its element', () => {
    foreignState()
    for (const group of [undefined, 'default']) {
      const { container, host } = mountHost()
      host.update(followerOptions({}, group, 'chart-1') as ChartTooltipOptions)
      expect(() => host.paint(paintContext)).not.toThrow()
      expect(tooltipsIn(container)).toBe(0)
    }
  })

  test('followerOptions: none for onFollow, a tooltip of null or false still follows', () => {
    expect(followerOptions({ onFollow: true }, undefined, 'c')).toEqual({})
    expect(followerOptions(false, 'g', 'c')).toEqual({ follower: { group: 'g', chartId: 'c' } })
    expect(followerOptions(null, undefined, 'c')).toEqual({
      follower: { group: undefined, chartId: 'c' },
    })
  })
})

describe('withTooltipRole', () => {
  /** An engine host stand-in: every paint writes `role="status"` again, as the real one does. */
  const engine = (calls: string[]): ChartTooltipExtension => ({
    create: (context) => ({
      update: () => void calls.push('update'),
      paint: () => {
        calls.push('paint')
        let el = context.container.querySelector(TOOLTIP_READOUT)
        if (!el) {
          el = document.createElement('div')
          el.className = TOOLTIP_READOUT.slice(1)
          context.container.append(el)
        }
        el.setAttribute('role', 'status')
      },
      hide: () => void calls.push('hide'),
      destroy: () => void calls.push('destroy'),
    }),
  })

  test('re-stamps role="tooltip" on every paint, after the engine writes status again', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const host = withTooltipRole(engine([])).create({
      container,
      dismiss: () => {},
      bodyChange: () => undefined,
    })
    for (let i = 0; i < 3; i += 1) {
      host.paint(paintContext)
      expect(container.querySelector(TOOLTIP_READOUT)?.getAttribute('role')).toBe('tooltip')
    }
  })

  test('every other host method passes straight through', () => {
    const calls: string[] = []
    const container = document.createElement('div')
    const host = withTooltipRole(engine(calls)).create({
      container,
      dismiss: () => {},
      bodyChange: () => undefined,
    })
    host.update({} as ChartTooltipOptions)
    host.hide()
    host.destroy?.()
    expect(calls).toEqual(['update', 'hide', 'destroy'])
  })
})
