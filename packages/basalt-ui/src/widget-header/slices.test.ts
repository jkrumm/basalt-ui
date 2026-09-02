/**
 * The `WidgetHeader` slices (audit B #2) — a TYPE test that also runs.
 *
 * A `Pick` has no runtime shape, so the mechanism here is a `Record<keyof Slice, true>` written out
 * by hand: `tsc` fails on a missing key AND on a surplus one, so the literal below is the slice's
 * membership stated in a place a reviewer can read, and the runtime `expect` makes the failure land
 * in the test run rather than only in a typecheck someone may not have run yet.
 *
 * The composers' half — that adopting a slice REMOVED nothing — is
 * `../dashboard/stat-card-props.test.ts`, next to the composer it is about.
 */
import { describe, expect, test } from 'bun:test'
import type {
  WidgetHeaderDeltaProps,
  WidgetHeaderMetricProps,
  WidgetHeaderTitleProps,
} from './widget-header'

const TITLE_KEYS: Record<keyof WidgetHeaderTitleProps, true> = {
  title: true,
  icon: true,
  subtitle: true,
  info: true,
}

const METRIC_KEYS: Record<keyof WidgetHeaderMetricProps, true> = {
  value: true,
  unit: true,
}

const DELTA_KEYS: Record<keyof WidgetHeaderDeltaProps, true> = {
  delta: true,
  deltaPeriod: true,
  deltaPolarity: true,
  deltaFormat: true,
  deltaGlyph: true,
}

describe('the three slices are cut along the three rows WidgetHeader paints', () => {
  test('title row', () => {
    expect(Object.keys(TITLE_KEYS).toSorted()).toEqual(['icon', 'info', 'subtitle', 'title'])
  })

  test('hero metric', () => {
    expect(Object.keys(METRIC_KEYS).toSorted()).toEqual(['unit', 'value'])
  })

  test('delta chip — all five together, never a subset', () => {
    expect(Object.keys(DELTA_KEYS).toSorted()).toEqual([
      'delta',
      'deltaFormat',
      'deltaGlyph',
      'deltaPeriod',
      'deltaPolarity',
    ])
  })
})
