import { describe, expect, test } from 'bun:test'
import { formatRelativeTime } from './relative-time'

// Unit boundaries (ms) mirrored from relative-time.ts — kept in sync deliberately rather than
// importing the private table, so a drift between the two shows up as a test failure.
const YEAR_MS = 31_536_000_000
const MONTH_MS = 2_628_000_000
const WEEK_MS = 604_800_000
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

describe('formatRelativeTime', () => {
  test('sub-minute past → "just now"', () => {
    expect(formatRelativeTime(Date.now() - 1)).toBe('just now')
    expect(formatRelativeTime(Date.now() - 30_000)).toBe('just now')
    expect(formatRelativeTime(Date.now() - (MINUTE_MS - 1_000))).toBe('just now')
  })

  test('sub-minute future → "just now" (the threshold is symmetric on |diff|)', () => {
    expect(formatRelativeTime(Date.now() + 1)).toBe('just now')
    expect(formatRelativeTime(Date.now() + (MINUTE_MS - 1))).toBe('just now')
  })

  test('minute boundary', () => {
    expect(formatRelativeTime(Date.now() - MINUTE_MS)).toBe('1 minute ago')
  })

  test('hour boundary', () => {
    expect(formatRelativeTime(Date.now() - HOUR_MS)).toBe('1 hour ago')
  })

  test('day boundary', () => {
    expect(formatRelativeTime(Date.now() - DAY_MS)).toBe('yesterday')
  })

  test('week boundary', () => {
    expect(formatRelativeTime(Date.now() - WEEK_MS)).toBe('last week')
  })

  test('month boundary', () => {
    expect(formatRelativeTime(Date.now() - MONTH_MS)).toBe('last month')
  })

  test('year boundary', () => {
    expect(formatRelativeTime(Date.now() - YEAR_MS)).toBe('last year')
  })

  test('future timestamp: the function handles negative diffMs (diff = timestamp - Date.now())', () => {
    // diffMs is positive here (timestamp is ahead of "now"), so Math.round(diffMs / unit.ms) is
    // positive too, and Intl.RelativeTimeFormat's 'auto' numeric mode renders the "in X" / "next
    // X" / "tomorrow" forms rather than the "X ago" / "last X" forms used for the past.
    expect(formatRelativeTime(Date.now() + HOUR_MS)).toBe('in 1 hour')
    expect(formatRelativeTime(Date.now() + DAY_MS)).toBe('tomorrow')
    expect(formatRelativeTime(Date.now() + WEEK_MS)).toBe('next week')
  })

  test('non-finite/wrong-type inputs degrade to empty string instead of throwing', () => {
    // Intl.RelativeTimeFormat.format throws a RangeError on any of these. The pre-fix code called
    // it unguarded, so each of the following would have thrown out of formatRelativeTime — except
    // `null`, which coerces to 0 via `timestamp - Date.now()` and produced a nonsense-but-non-
    // throwing "X years ago" string. The guard now normalizes all six to the same '' result.
    expect(formatRelativeTime(NaN)).toBe('')
    expect(formatRelativeTime(Infinity)).toBe('')
    expect(formatRelativeTime(-Infinity)).toBe('')
    // @ts-expect-error — runtime type violation (undefined at a `number`-typed call site), the exact
    // shape a `ThreadsStoreAdapter` bug or corrupted localStorage JSON would produce.
    expect(formatRelativeTime(undefined)).toBe('')
    // @ts-expect-error — runtime type violation (ISO string), the single most likely real-world
    // adapter mistake (a server returning `created_at` as a string).
    expect(formatRelativeTime('2024-01-01T00:00:00Z')).toBe('')
    // @ts-expect-error — runtime type violation (null); previously coerced to 0 rather than
    // throwing, now normalized to the same '' as every other non-finite input.
    expect(formatRelativeTime(null)).toBe('')
  })

  test('finite-but-absurd timestamps still format instead of throwing', () => {
    // Number.isFinite is true for both, so these fall through the new guard unchanged — the guard
    // must not over-trigger on merely-extreme (but valid) input.
    expect(() => formatRelativeTime(8_640_000_000_000_000)).not.toThrow() // year 275760, JS Date max
    expect(() => formatRelativeTime(-8_640_000_000_000_000)).not.toThrow() // symmetric min
    expect(() => formatRelativeTime(-1_000_000_000_000)).not.toThrow() // pre-1970 epoch
  })

  test('"at(-1)!" fallback path — documented as effectively unreachable', () => {
    // RELATIVE_TIME_UNITS.find(...) ?? RELATIVE_TIME_UNITS.at(-1)! only falls through to the
    // fallback when .find returns undefined. The array's last (smallest) entry is 'minute' at
    // 60_000ms, exactly the threshold the "just now" early-return already guards below — so for
    // every absMs that reaches the .find call (absMs >= 60_000), 'minute' itself always matches
    // first-or-later, and the ?? branch is defensive dead code under the current threshold table.
    // This test exercises the boundary that the fallback would produce if it were ever reachable
    // (it currently is not, verified by construction): the same 'minute' unit as the last table row.
    expect(formatRelativeTime(Date.now() - MINUTE_MS)).toBe('1 minute ago')
  })
})
