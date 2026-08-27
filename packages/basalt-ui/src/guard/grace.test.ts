/**
 * The C16 version gate (`docs/CONTROLS-SPEC.md` §1): a `GRACE_PERIOD_KINDS` entry fails the build
 * once `package.json`'s version reaches its `promote`, and every entry must declare `since` before
 * `promote`. This is the mechanism that replaces the honor system — deleting an entry used to be
 * the ONLY enforcement of "warn for one minor", and nothing checked that anyone had (D4:
 * `docs/archive/CONTROLS-SYNTHESIS.md`). Five kinds landed together in the round-4 guard minor and sat
 * at `warn` for five minors before this test existed.
 *
 * `assertGraceLedger` is tested directly against synthetic entries below, since the real
 * `GRACE_PERIOD_KINDS` is empty today (every entry that lived here promoted or moved to
 * `PLUGIN_RULE_ADVISORY`'s guard-side sibling) — an `it.each` over an empty ledger runs zero
 * assertions, which proved nothing about the gate actually firing. The real-ledger check below
 * still runs, so a future entry is covered the moment it lands.
 *
 * Excluded from tsc (tsconfig exclude: src/**\/*.test.ts), run via `bun test`.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GRACE_PERIOD_KINDS } from './index'

const PACKAGE_JSON_PATH = resolve(import.meta.dirname, '..', '..', 'package.json')
const CURRENT_VERSION = (JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as { version: string })
  .version

type GraceEntry = { since: string; promote: string; why: string }

/**
 * Tiny local semver compare — no dependency. Assumes plain `x.y.z`, no pre-release identifiers
 * (basalt-ui bans majors and ships no pre-releases). Returns negative when `a` sorts before `b`,
 * positive when after, zero when equal. Compares each component numerically, not lexically, so
 * `'1.9.0' < '1.10.0'` and `'1.3.0' < '1.26.0'` — a string compare would get both backwards.
 */
export function compareSemver(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

/**
 * The C16 gate itself, extracted so it can be exercised against a synthetic ledger as well as the
 * real one. Throws naming the first offending entry when either invariant breaks: `since` must
 * precede `promote` for every entry, and no entry's `promote` may be `<=` the given `version`.
 */
export function assertGraceLedger(ledger: Record<string, GraceEntry>, version: string): void {
  for (const [id, entry] of Object.entries(ledger)) {
    if (compareSemver(entry.since, entry.promote) >= 0) {
      throw new Error(
        `${id}: \`since\` (${entry.since}) must be before \`promote\` (${entry.promote}).`,
      )
    }
    if (compareSemver(version, entry.promote) >= 0) {
      throw new Error(
        `${id}: package.json is at ${version}, which has reached its promote version ` +
          `${entry.promote} — promote to error or extend \`promote\` with a reason.`,
      )
    }
  }
}

describe('compareSemver', () => {
  it('orders multi-digit components numerically, not lexically', () => {
    expect(compareSemver('1.9.0', '1.10.0')).toBeLessThan(0)
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0)
    expect(compareSemver('1.3.0', '1.26.0')).toBeLessThan(0)
    expect(compareSemver('1.26.0', '1.3.0')).toBeGreaterThan(0)
  })

  it('treats equal versions as equal', () => {
    expect(compareSemver('1.25.0', '1.25.0')).toBe(0)
  })
})

describe('assertGraceLedger', () => {
  it('does not throw on a well-formed entry not yet due', () => {
    const ledger = { 'fake-kind': { since: '1.0.0', promote: '2.0.0', why: 'synthetic' } }
    expect(() => assertGraceLedger(ledger, '1.25.0')).not.toThrow()
  })

  it('throws once the given version reaches promote', () => {
    const ledger = { 'fake-kind': { since: '1.0.0', promote: '1.25.0', why: 'synthetic' } }
    expect(() => assertGraceLedger(ledger, '1.25.0')).toThrow(/fake-kind/)
  })

  it('throws once the given version is past promote', () => {
    const ledger = { 'fake-kind': { since: '1.0.0', promote: '1.9.0', why: 'synthetic' } }
    expect(() => assertGraceLedger(ledger, '1.10.0')).toThrow(/fake-kind/)
  })

  it('throws when since does not precede promote', () => {
    const ledger = { 'fake-kind': { since: '1.5.0', promote: '1.5.0', why: 'synthetic' } }
    expect(() => assertGraceLedger(ledger, '1.0.0')).toThrow(/since/)
  })
})

describe('GRACE_PERIOD_KINDS — version gate (C16)', () => {
  it('the real ledger passes the gate against the real package version', () => {
    expect(() =>
      assertGraceLedger(GRACE_PERIOD_KINDS as Record<string, GraceEntry>, CURRENT_VERSION),
    ).not.toThrow()
  })
})
