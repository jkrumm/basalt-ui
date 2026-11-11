import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createFormat } from './format'
import type { CalendarDate } from './format'

const AT = new Date('2026-09-02T23:30:00Z')

/** Every method over a fixed input table, as one comparable string. */
function render(locale: string, timeZone: string): string {
  const f = createFormat({ locale, timeZone })
  return JSON.stringify([
    f.number(1234567.891),
    f.percent(0.4234, { maximumFractionDigits: 1 }),
    f.money(1234.5, 'EUR'),
    f.date(AT),
    f.date(AT, 'long'),
    f.date('2026-09-02', 'month'),
    f.dateTime(AT),
    f.time(AT),
    f.relative(AT, AT.getTime() + 3 * 3_600_000),
    f.duration(3_723_000),
    f.plural(1),
  ])
}

describe('format law', () => {
  test('a fixed locale and zone prints the same on every instance (server and client)', () => {
    for (const [locale, zone] of [
      ['en', 'UTC'],
      ['de-DE', 'Europe/Berlin'],
      ['en-GB', 'Asia/Tokyo'],
    ] as const) {
      expect(render(locale, zone)).toBe(render(locale, zone))
    }
  })

  test('the zone moves a Date and never a CalendarDate', () => {
    const berlin = createFormat({ locale: 'en', timeZone: 'Europe/Berlin' })
    const la = createFormat({ locale: 'en', timeZone: 'America/Los_Angeles' })
    expect(berlin.date(AT)).toBe('Sep 3, 2026')
    expect(la.date(AT)).toBe('Sep 2, 2026')
    const day: CalendarDate = '2026-09-02'
    expect(berlin.date(day)).toBe('Sep 2, 2026')
    expect(la.date(day)).toBe('Sep 2, 2026')
  })

  test('a CalendarDate prints the same day under TZ=America/Los_Angeles', () => {
    const script = `
      import { createFormat } from ${JSON.stringify(join(import.meta.dirname, 'format.ts'))}
      const f = createFormat({ locale: 'en', timeZone: 'host' })
      console.log(f.date('2026-09-02'), '|', f.date('2026-01-01', 'long'))
    `
    const run = (tz: string): string => {
      const result = Bun.spawnSync(['bun', '-e', script], { env: { ...process.env, TZ: tz } })
      expect(result.exitCode).toBe(0)
      return result.stdout.toString().trim()
    }
    expect(run('America/Los_Angeles')).toBe('Sep 2, 2026 | January 1, 2026')
    expect(run('Pacific/Kiritimati')).toBe('Sep 2, 2026 | January 1, 2026')
  })

  test('the default is English and UTC whatever the host says', () => {
    const f = createFormat()
    expect(f.number(1234.5)).toBe('1,234.5')
    expect(f.time(new Date('2026-09-02T23:30:00Z'))).toMatch(/^11:30\sPM$/)
  })

  test("'host' is the one way to read the runtime zone", () => {
    const script = `
      import { createFormat } from ${JSON.stringify(join(import.meta.dirname, 'format.ts'))}
      const at = new Date('2026-09-02T23:30:00Z')
      console.log(createFormat({ timeZone: 'host' }).date(at), '|', createFormat().date(at))
    `
    const result = Bun.spawnSync(['bun', '-e', script], {
      env: { ...process.env, TZ: 'Asia/Tokyo' },
    })
    expect(result.stdout.toString().trim()).toBe('Sep 3, 2026 | Sep 2, 2026')
  })

  test('the module never reads navigator or the host locale', () => {
    const source = readFileSync(join(import.meta.dirname, 'format.ts'), 'utf8')
      .replace(/\/\*[^]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(source).not.toMatch(/\bnavigator\b/)
    expect(source).not.toMatch(/resolvedOptions\(\)/)
    // Every Intl constructor is handed the explicit locale: no `undefined` host fallback.
    expect(source).not.toMatch(/new Intl\.\w+\(undefined/)
    expect(source.match(/new Intl\.\w+\(locale/g)?.length).toBe(4)
    expect(source.match(/new Intl\./g)?.length).toBe(4)
  })

  test('decimal comma and group dot under de-DE', () => {
    const f = createFormat({ locale: 'de-DE' })
    expect(f.number(1234.5)).toBe('1.234,5')
    expect(f.percent(0.425, { maximumFractionDigits: 1 })).toBe('42,5 %')
    expect(f.money(1234.5, 'EUR')).toBe('1.234,50 €')
  })
})

describe('non-finite input', () => {
  const f = createFormat()
  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'prints an em dash for %p',
    (n) => {
      expect(f.number(n)).toBe('—')
      expect(f.percent(n)).toBe('—')
      expect(f.money(n, 'USD')).toBe('—')
      expect(f.duration(n)).toBe('—')
      expect(f.date(n)).toBe('—')
      expect(f.dateTime(n)).toBe('—')
      expect(f.time(n)).toBe('—')
      expect(f.relative(n, 0)).toBe('—')
    },
  )

  test('an invalid CalendarDate prints an em dash', () => {
    expect(f.date('2026-02-31' as CalendarDate)).toBe('—')
    expect(f.date('nope' as CalendarDate)).toBe('—')
  })

  test('money without a currency does not type-check', () => {
    // @ts-expect-error the currency is required: there is no default
    expect(() => f.money(1)).toThrow()
  })
})
