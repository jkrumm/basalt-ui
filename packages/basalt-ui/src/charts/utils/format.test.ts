/**
 * The number-format law. Every assertion pins `locale: 'en-US'` on purpose: the shipped default is
 * `undefined` (the RUNTIME's locale, which is the right default for a reader) and a test asserting
 * against that would pass or fail by machine.
 */
import { describe, expect, test } from 'bun:test'
import {
  fmtCompact,
  fmtCurrency,
  fmtInt,
  fmtPercent,
  formatters,
  fmtAxisDate,
  fmtTooltipDate,
  NON_FINITE,
} from './format'

const en = { locale: 'en-US' } as const

describe('fmtCompact', () => {
  test('thousands and millions get a compact suffix', () => {
    expect(fmtCompact(1200, en)).toBe('1.2k')
    expect(fmtCompact(3_400_000, en)).toBe('3.4M')
  })

  test('the k is lowercased; every other locale word is left alone', () => {
    expect(fmtCompact(1200, en)).not.toContain('K')
    expect(fmtCompact(1_200_000_000, en)).toBe('1.2B')
  })

  test('small numbers are not compacted into a lie', () => {
    expect(fmtCompact(820, en)).toBe('820')
    expect(fmtCompact(-820, en)).toBe('-820')
    expect(fmtCompact(0, en)).toBe('0')
  })

  test('digits controls the fraction on the compacted number', () => {
    expect(fmtCompact(1234, { ...en, digits: 0 })).toBe('1k')
    expect(fmtCompact(1234, { ...en, digits: 2 })).toBe('1.23k')
  })
})

describe('fmtPercent', () => {
  test('a sub-1% ratio still reads as a percentage, not as zero-ish noise', () => {
    expect(fmtPercent(0.004, { ...en, digits: 1 })).toBe('0.4%')
    expect(fmtPercent(0.4, { ...en, input: 'percent', digits: 1 })).toBe('0.4%')
    // At the default 0 digits it rounds, which is the documented behaviour, not a bug.
    expect(fmtPercent(0.004, en)).toBe('0%')
  })

  test('negatives keep their sign in both input modes', () => {
    expect(fmtPercent(-0.42, en)).toBe('-42%')
    expect(fmtPercent(-42, { ...en, input: 'percent' })).toBe('-42%')
  })

  test('a ratio is the default input — 0.42 reads 42%', () => {
    expect(fmtPercent(0.42, en)).toBe('42%')
  })

  test("input: 'percent' takes an already-scaled number", () => {
    expect(fmtPercent(42, { ...en, input: 'percent' })).toBe('42%')
  })

  test('the two inputs are 100x apart — which is why it is declared, never guessed', () => {
    expect(fmtPercent(1.2, en)).toBe('120%')
    expect(fmtPercent(1.2, { ...en, input: 'percent', digits: 1 })).toBe('1.2%')
  })

  test('digits are exact, not a maximum — an axis of percentages must not ladder', () => {
    expect(fmtPercent(0.5, { ...en, digits: 2 })).toBe('50.00%')
  })
})

describe('fmtCurrency', () => {
  test('symbol, grouping, and no cents by default', () => {
    expect(fmtCurrency(1234, { ...en, currency: 'USD' })).toBe('$1,234')
  })

  test('compact money keeps the symbol and lowercases the k', () => {
    expect(fmtCurrency(1234, { ...en, currency: 'USD', compact: true })).toBe('$1.2k')
  })

  test('a currency whose SYMBOL contains a K keeps it — the lowercasing is digit-anchored', () => {
    const hk = fmtCurrency(1200, { ...en, currency: 'HKD', compact: true })
    expect(hk).toContain('HK')
    expect(hk).toContain('1.2k')
  })

  test('digits opts back into cents', () => {
    expect(fmtCurrency(1234.5, { ...en, currency: 'EUR', digits: 2 })).toBe('€1,234.50')
  })

  test('a negative amount keeps its sign and its symbol', () => {
    expect(fmtCurrency(-1234, { ...en, currency: 'USD' })).toBe('-$1,234')
    expect(fmtCurrency(-1234, { ...en, currency: 'USD', compact: true })).toBe('-$1.2k')
  })
})

/**
 * `Intl.NumberFormat` renders `NaN` as the literal `"NaN"` and `Infinity` as `"∞"`, so a collapsed
 * domain or a 0/0 rate used to reach the axis as its own arithmetic accident. Every formatter
 * answers with an em dash instead — a chart may say it does not know, it may not print a number
 * that is not one (`docs/CHARTS-SPEC.md` §9).
 */
describe('non-finite input — one law, every formatter', () => {
  test('the sentinel is the em dash the tooltip already uses for a missing value', () => {
    expect(NON_FINITE).toBe('\u2014')
  })

  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    test(`${value} never reaches a label from any numeric formatter`, () => {
      const rendered = [
        fmtCompact(value, en),
        fmtPercent(value, en),
        fmtPercent(value, { ...en, input: 'percent' }),
        fmtCurrency(value, { ...en, currency: 'USD' }),
        fmtCurrency(value, { ...en, currency: 'USD', compact: true }),
        fmtInt(value, en),
      ]
      expect(rendered).toEqual(Array<string>(rendered.length).fill(NON_FINITE))
      for (const out of rendered) {
        expect(out).not.toContain('NaN')
        expect(out).not.toContain('∞')
      }
    })
  }

  test('the date formatters answer the same way for an Invalid Date and a non-finite number', () => {
    expect(fmtAxisDate(new Date(Number.NaN))).toBe(NON_FINITE)
    expect(fmtTooltipDate(new Date(Number.NaN))).toBe(NON_FINITE)
    expect(fmtAxisDate(Number.NaN)).toBe(NON_FINITE)
    expect(fmtTooltipDate(Number.POSITIVE_INFINITY)).toBe(NON_FINITE)
  })

  test('a finite zero is untouched — the guard is non-finite, not falsy', () => {
    expect(fmtCompact(0, en)).toBe('0')
    expect(fmtPercent(0, en)).toBe('0%')
    expect(fmtInt(0, en)).toBe('0')
    expect(fmtCurrency(0, { ...en, currency: 'USD' })).toBe('$0')
  })
})

describe('fmtInt', () => {
  test('groups thousands', () => {
    expect(fmtInt(12480, en)).toBe('12,480')
  })

  test('rounds — an integer formatter that printed a fraction would be lying about its name', () => {
    expect(fmtInt(12480.4, en)).toBe('12,480')
    expect(fmtInt(12480.6, en)).toBe('12,481')
  })
})

describe('formatters', () => {
  test('is the same set as the named exports, never a second implementation', () => {
    expect(formatters.compact).toBe(fmtCompact)
    expect(formatters.percent).toBe(fmtPercent)
    expect(formatters.currency).toBe(fmtCurrency)
    expect(formatters.int).toBe(fmtInt)
    expect(formatters.axisDate).toBe(fmtAxisDate)
    expect(formatters.tooltipDate).toBe(fmtTooltipDate)
  })

  test('a formatter is usable as an AxisConfig.format — (v: number) => string', () => {
    const format: (v: number) => string = (v) => formatters.compact(v, en)
    expect(format(2500)).toBe('2.5k')
  })
})
