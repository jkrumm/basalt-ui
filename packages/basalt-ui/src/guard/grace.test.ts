/**
 * The C16 version gate (`docs/CONTROLS-SPEC.md` §1): a `GRACE_PERIOD_KINDS` entry fails the build
 * once `package.json`'s version reaches its `promote`, and every entry must declare `since` before
 * `promote`. This is the mechanism that replaces the honor system — deleting an entry used to be
 * the ONLY enforcement of "warn for one minor", and nothing checked that anyone had (D4:
 * `docs/archive/CONTROLS-SYNTHESIS.md`). Five kinds landed together in the round-4 guard minor and sat
 * at `warn` for five minors before this test existed.
 *
 * `assertGraceLedger` is tested directly against synthetic entries below rather than only through
 * the real ledger: every pre-existing entry promoted or moved to `PLUGIN_RULE_ADVISORY`'s guard-side
 * sibling, and an `it.each` over the empty ledger that left behind ran zero assertions, which proved
 * nothing about the gate actually firing. Since 1.33.0 the ledger carries ONE kind,
 * `unknown-vx-token` (promote 1.36.0 — widened at 1.34.0, which restarts its grace) — the C1 pair and `raw-media-query` promoted — and the
 * real-ledger check below runs against it.
 *
 * This gate measures the version already PUBLISHED, so it can only go red after the release that
 * shipped a due entry. `scripts/check-grace.ts` is the other end — `scripts/release.sh` runs it
 * against the version the dry run computed, before the release is cut.
 *
 * Excluded from tsc (tsconfig exclude: src/**\/*.test.ts), run via `bun test`.
 */
import { describe, expect, it, spyOn } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BP, groupTokens, p } from '../tokens/index'
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

// ── the release-time half: scripts/check-grace.ts ────────────────────────────
// Exercised as a PROCESS, because that is how `scripts/release.sh` consumes it — the exit code is
// the whole interface, and a script that printed the right words with status 0 would gate nothing.

const CHECK_GRACE = resolve(import.meta.dirname, '..', '..', 'scripts', 'check-grace.ts')

function runCheckGrace(...args: string[]): { code: number; stderr: string; stdout: string } {
  const result = Bun.spawnSync(['bun', CHECK_GRACE, ...args])
  return {
    code: result.exitCode,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  }
}

describe('scripts/check-grace.ts', () => {
  it('passes for a version below every promote', () => {
    const { code, stdout } = runCheckGrace('1.0.0')
    expect([code, stdout.includes('clear of all')]).toEqual([0, true])
  })

  it('refuses a version that has reached a promote, naming the entries', () => {
    const { code, stderr } = runCheckGrace('9.9.9')
    expect(code).toBe(1)
    expect(stderr).toContain('unknown-vx-token')
  })

  // 1.27.0 promoted five of the six wave-6 plugin rules and one of the two guard kinds; 1.30.0
  // promoted four more, all measured at zero incumbents across the fleet. 1.33.0 promoted the last
  // four — the C1 pair (`raw-selection-control` + `basalt/control-outside-home`) and the breakpoint
  // pair (`raw-media-query` + `basalt/raw-breakpoint`) — against nine consumers measured at zero on
  // 1.32.1. What is LEFT is `unknown-vx-token`, new in 1.33.0 and widened in 1.34.0 (in-family
  // names), so 1.34.x and 1.35.x must now PASS.
  it.each([
    '1.30.0',
    '1.31.0',
    '1.32.0',
    '1.32.9',
    '1.33.0',
    '1.33.9',
    '1.34.0',
    '1.34.9',
    '1.35.0',
    '1.35.9',
  ])('passes %s — nothing is due until 1.36.0', (v) => {
    expect(runCheckGrace(v).code).toBe(0)
  })

  it('refuses the version unknown-vx-token is due in (1.36.0)', () => {
    expect(runCheckGrace('1.36.0').code).toBe(1)
  })

  // The 1.36.0 form-layout aliases are dated 1.37.0: the release that reaches that date refuses
  // until they are deleted (their own commit) — which is when this case moves to the next date.
  it('refuses 1.37.0 while the form-layout aliases still ship', () => {
    const { code, stderr } = runCheckGrace('1.37.0')
    expect([code, stderr.includes('FormRow (basalt-ui/forms)')]).toEqual([1, true])
  })

  it('exits 2 on a missing or malformed version rather than passing vacuously', () => {
    expect(runCheckGrace().code).toBe(2)
    expect(runCheckGrace('not-a-version').code).toBe(2)
  })
})

// The token factories WARN on a ref inside a basalt family while unknown-vx-token is graced; the
// promotion that deletes the entry must also make them throw, or the guard's soundness rests on a
// console line. This goes red on that promotion until tokens/index.ts throws.
describe('unknown-vx-token promotion reaches the token factories', () => {
  // The warning names the version it starts throwing in; that number is hand-written in tokens
  // (which cannot import the guard), so it is pinned to the ledger here.
  it('warns with the version the ledger promotes in', () => {
    const entry = GRACE_PERIOD_KINDS['unknown-vx-token']
    if (entry === undefined) return
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      groupTokens('surface', { graceVersionProbe: p(BP.gray) })
      expect(String(warn.mock.calls[0]?.[0]).match(/Throws from (\d+\.\d+\.\d+)/)?.[1]).toBe(
        entry.promote,
      )
    } finally {
      warn.mockRestore()
    }
  })

  it('groupTokens throws on a basalt family once the kind has left the ledger', () => {
    if (Object.hasOwn(GRACE_PERIOD_KINDS, 'unknown-vx-token')) return
    expect(() => groupTokens('surface', { x: p(BP.gray) })).toThrow('--vx-surface')
  })
})
