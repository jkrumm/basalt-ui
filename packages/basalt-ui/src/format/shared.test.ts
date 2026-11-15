import { afterEach, describe, expect, test } from 'bun:test'
import { integer } from './number'
import { dateFormat, setFormatDefaults, numberFormat, resetFormatDefaults } from './shared'

afterEach(resetFormatDefaults)

describe('setFormatDefaults', () => {
  test('sets the default locale every formatter reads; per-call locale wins', () => {
    setFormatDefaults({ locale: 'en-US' })
    expect(integer(1112)).toBe('1,112')
    expect(integer(1112, { locale: 'de-DE' })).toBe('1.112')
    setFormatDefaults({ locale: 'de-DE' })
    expect(integer(1112)).toBe('1.112')
  })

  test('is idempotent and resettable', () => {
    setFormatDefaults({ locale: 'de-DE' })
    setFormatDefaults({ locale: 'de-DE' })
    expect(integer(1112)).toBe('1.112')
    resetFormatDefaults()
    expect(numberFormat(undefined, {}).resolvedOptions().locale).toBe(
      new Intl.NumberFormat().resolvedOptions().locale,
    )
  })

  test('merges: an undefined field keeps the earlier value', () => {
    const at = new Date('2026-09-02T23:30:00Z')
    const opts = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const
    setFormatDefaults({ timeZone: 'Asia/Tokyo' })
    setFormatDefaults({ locale: 'en-US' })
    expect(dateFormat(undefined, opts).format(at)).toBe('08:30')
    setFormatDefaults({ locale: undefined })
    expect(integer(1112)).toBe('1,112')
  })

  test('the default timeZone reaches date formatters; per-call timeZone wins', () => {
    const at = new Date('2026-09-02T23:30:00Z')
    const opts = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const
    setFormatDefaults({ locale: 'en-US', timeZone: 'Asia/Tokyo' })
    expect(dateFormat(undefined, opts).format(at)).toBe('08:30')
    expect(dateFormat(undefined, { ...opts, timeZone: 'UTC' }).format(at)).toBe('23:30')
    setFormatDefaults({ locale: 'en-US', timeZone: 'UTC' })
    expect(dateFormat(undefined, opts).format(at)).toBe('23:30')
  })

  test('formatters are cached per resolved locale', () => {
    expect(numberFormat('en-US', { style: 'percent' })).toBe(
      numberFormat('en-US', { style: 'percent' }),
    )
    setFormatDefaults({ locale: 'en-US' })
    expect(numberFormat(undefined, { style: 'percent' })).toBe(
      numberFormat('en-US', { style: 'percent' }),
    )
  })
})

describe('dateFormat short September', () => {
  test('English short month prints Sep whatever the region, other languages keep their own', () => {
    const d = new Date(Date.UTC(2026, 8, 15))
    const opts = { day: 'numeric', month: 'short', timeZone: 'UTC' } as const
    expect(dateFormat('en-GB', opts).format(d)).toBe('15 Sep')
    expect(dateFormat('en-US', opts).format(d)).toBe('Sep 15')
    expect(
      dateFormat('en-GB', opts)
        .formatToParts(d)
        .find((p) => p.type === 'month')?.value,
    ).toBe('Sep')
    expect(dateFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(d)).toBe(
      '15 Sep 2026',
    )
    expect(dateFormat('en-GB', opts).formatRange(d, new Date(Date.UTC(2026, 8, 20)))).not.toContain(
      'Sept',
    )
    expect(dateFormat('de', opts).format(d)).toBe(new Intl.DateTimeFormat('de', opts).format(d))
  })
})
