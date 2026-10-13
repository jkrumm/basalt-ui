import { describe, expect, it } from 'bun:test'
import { BUCKET_COUNT, chartViews } from './charts-store'

describe('chartViews.validateSearch', () => {
  it('resolves every field to its fallback on an empty search', () => {
    expect(chartViews.validateSearch({})).toMatchObject({ tab: 'linked', buckets: '288' })
  })

  it('passes a valid deep link through', () => {
    expect(chartViews.validateSearch({ tab: 'strips', buckets: '48' })).toMatchObject({
      tab: 'strips',
      buckets: '48',
    })
  })

  it('falls back on a value outside the options (including the retired "kinds" tab)', () => {
    expect(chartViews.validateSearch({ tab: 'kinds', buckets: '7' })).toMatchObject({
      tab: 'linked',
      buckets: '288',
    })
  })
})

describe('BUCKET_COUNT', () => {
  it('names a slot count for each bucket option', () => {
    expect(BUCKET_COUNT).toEqual({ '48': 48, '144': 144, '288': 288 })
  })
})
