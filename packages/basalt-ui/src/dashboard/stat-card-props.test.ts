/**
 * Adopting the `WidgetHeader` slices (audit B #2) must not REMOVE anything from `StatCardProps`.
 * The audit's complaint was that four composers published four accidental subsets of the same base;
 * a fix that quietly drops a prop while tidying the type just moves the accident.
 *
 * A TYPE test that also runs. `FULL_STAT_CARD` is every prop the component accepted before the
 * slices landed, plus the one it gained this minor, assigned to the type — a dropped prop is a
 * compile error at that assignment, and the runtime key list makes the same claim readable and puts
 * the failure in the test run rather than only in a typecheck someone may not have run yet.
 */
import { describe, expect, test } from 'bun:test'
import type { StatCardProps } from './stat-card'

const FULL_STAT_CARD: StatCardProps = {
  // the title slice
  title: 'Active users',
  icon: null,
  subtitle: '7-day rolling',
  info: 'How this is computed.',
  // the metric slice, `value` redeclared as required
  value: '12,483',
  unit: 'TSS',
  // the delta slice
  delta: 4.2,
  deltaPeriod: 'MoM',
  deltaPolarity: 'up-good',
  deltaFormat: (d) => `${d}`,
  deltaGlyph: false,
  // StatCard's own
  breakdown: [{ label: 'Web', value: '61%', tone: 'good' }],
  sparkline: null,
  sparklinePlacement: 'right',
  actions: null,
  tone: 'good',
  // added by this minor
  query: {
    data: undefined,
    isError: false,
    error: null,
    fetchStatus: 'idle',
    refetch: () => undefined,
  },
  // BasaltProps + the slot seam
  className: 'mine',
  style: { marginTop: 8 },
  classNames: { root: 'r', header: 'h', body: 'b', sparkline: 's' },
}

describe('StatCardProps still admits everything it did', () => {
  test('no prop was removed by the slice adoption', () => {
    expect(Object.keys(FULL_STAT_CARD).toSorted()).toEqual([
      'actions',
      'breakdown',
      'className',
      'classNames',
      'delta',
      'deltaFormat',
      'deltaGlyph',
      'deltaPeriod',
      'deltaPolarity',
      'icon',
      'info',
      'query',
      'sparkline',
      'sparklinePlacement',
      'style',
      'subtitle',
      'title',
      'tone',
      'unit',
      'value',
    ])
  })
})
