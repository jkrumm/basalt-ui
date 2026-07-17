/**
 * Regression tests for the `classify()` ledger widening (see `./index.ts`'s `normalizeForLedger` +
 * `writeUnit` + `classify`).
 *
 * `writeUnit` now records a NORMALIZED hash in the manifest (instead of a raw one) for every sync
 * it performs, going forward — that closes the false-positive gap for any consumer whose manifest
 * entry was written by a CLI carrying this fix. But a manifest entry written by an OLDER
 * (pre-1.0.2) CLI holds a RAW hash — `classify`'s legacy path (`sha256(current) === manifestHash`)
 * exists to keep matching that raw entry directly, and it is faithfully exercised below by seeding
 * the manifest with a genuine `sha256(olderBlock)`, not `sha256(normalizeForLedger(olderBlock))`.
 *
 * Two scenarios collide differently against that raw legacy entry:
 *  - reformat ONLY (template body unchanged since the entry was written) → the same-version
 *    fallback (`normalizeForLedger(current) === normalizeForLedger(desired)`) still catches it,
 *    independent of the manifest hash → `unchanged`, healed silently, no `--force` — and the
 *    healing sync rewrites the manifest with the NORMALIZED hash, closing the gap for good for
 *    that consumer.
 *  - reformat AND a cross-version word change (the CLI bin rename baked into the block's own
 *    prose) together → NONE of `classify`'s three paths match a raw legacy hash → `drifted`, a
 *    real transitional gap that needs one `--force` to heal. See the comment above the legacy-hash
 *    path in `classify` (`./index.ts`) for the documented tradeoff.
 *
 * Also proves the two pre-existing same-version guarantees still hold:
 *  2. a real word-level edit at the SAME version → still `drifted` → skipped without `--force`.
 *  3. reformatting + a real edit together → still `drifted`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { init, MANIFEST_PATH, normalizeForLedger, sync } from './index.ts'

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

let dir: string

function read(relPath: string): string {
  return readFileSync(join(dir, relPath), 'utf8')
}

function write(relPath: string, content: string): void {
  writeFileSync(join(dir, relPath), content, 'utf8')
}

/** Captures both console.log and console.error — sync() reports drift on either depending on flags. */
function capture(fn: () => number): { code: number; log: string } {
  const originalLog = console.log
  const originalError = console.error
  let log = ''
  console.log = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  console.error = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  try {
    return { code: fn(), log }
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

function silenced<T>(fn: () => T): T {
  const originalLog = console.log
  const originalError = console.error
  console.log = () => {}
  console.error = () => {}
  try {
    return fn()
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

/**
 * The exact argo repro: lefthook's oxfmt inserted an EXTRA blank line after
 * `<!-- basalt:begin … -->` and another before `<!-- basalt:end -->` (a 35-line template rendered
 * as 37 lines post-oxfmt) — a pure formatting delta, zero word changes. Inserted unconditionally
 * (not just when absent) so the fixture reproduces the delta regardless of how many blank lines the
 * live template already ships around its markers.
 */
function simulateOxfmtReformat(host: string): string {
  const beginLineEnd = host.indexOf('\n', host.indexOf('<!-- basalt:begin')) + 1
  const endMarkerStart = host.indexOf('<!-- basalt:end -->')
  return (
    host.slice(0, beginLineEnd) +
    '\n' +
    host.slice(beginLineEnd, endMarkerStart) +
    '\n' +
    host.slice(endMarkerStart)
  )
}

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-ledger-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fixture' }))
  silenced(() => init(dir))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('classify ledger: cross-version format-only drift vs a real edit', () => {
  it('a raw legacy manifest hash + reformat + a cross-version word change classifies drifted — the documented transitional gap, healed by one --force', () => {
    const currentBlock = read('CLAUDE.md').trimEnd() // == today's desired (v1.0.1-shaped) block
    expect(currentBlock).toContain('basalt-ui')

    // Simulate the v1.0.0 body: genuinely different WORDS (the pre-rename bin name), not just an
    // older version token — this is what makes the scenario cross-version, not same-version.
    const olderBlock = currentBlock.replace(/basalt-ui/g, 'basalt')
    expect(olderBlock).not.toBe(currentBlock)
    expect(olderBlock).toContain('bunx basalt sync')

    // What a PRE-1.0.2 CLI's writeUnit actually recorded at that sync: a RAW hash of the exact
    // bytes it wrote — the fix only normalizes hashes written by a CLI carrying it, so a genuine
    // legacy manifest entry looks like this, not `sha256(normalizeForLedger(olderBlock))`.
    const manifestHash = sha256(olderBlock)
    write(
      MANIFEST_PATH,
      JSON.stringify(
        { version: 1, basaltVersion: '1.0.0', files: { 'CLAUDE.md': manifestHash } },
        null,
        2,
      ),
    )

    // What actually sits on disk: the older body, reformatted by the consumer's own lefthook
    // oxfmt AFTER that older sync — the real argo repro shape.
    const onDisk = simulateOxfmtReformat(olderBlock)
    expect(onDisk).not.toBe(olderBlock)
    write('CLAUDE.md', `${onDisk}\n`)

    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(0)
    // NOT healed — none of classify's three paths match a raw legacy hash once the words have
    // also changed cross-version. This is the residual transitional gap documented on `classify`.
    expect(read('CLAUDE.md')).toBe(`${onDisk}\n`)
    expect(log).toContain('locally edited')

    expect(silenced(() => sync({ check: true }, dir))).toBe(1)

    // One --force heals it straight to the CURRENT (v1.0.1-shaped) rendering.
    silenced(() => sync({ force: true }, dir))
    expect(read('CLAUDE.md').trimEnd()).toBe(currentBlock)
  })

  it('a raw legacy manifest hash + reformat only (no word change) still classifies unchanged via the same-version fallback, heals without --force, and the manifest is rewritten with the normalized hash', () => {
    const currentBlock = read('CLAUDE.md').trimEnd() // == today's desired block; body unchanged

    // What a PRE-1.0.2 CLI's writeUnit recorded for THIS SAME body: a raw hash, not normalized.
    const manifestHash = sha256(currentBlock)
    write(
      MANIFEST_PATH,
      JSON.stringify(
        { version: 1, basaltVersion: '1.0.0', files: { 'CLAUDE.md': manifestHash } },
        null,
        2,
      ),
    )

    // What sits on disk: the SAME body, reformatted by the consumer's own lefthook oxfmt — no
    // template-body change since the manifest entry was written.
    const onDisk = simulateOxfmtReformat(currentBlock)
    expect(onDisk).not.toBe(currentBlock)
    write('CLAUDE.md', `${onDisk}\n`)

    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(0)
    // Healed straight to the current rendering, no --force needed: the same-version fallback
    // (`normalizeForLedger(current) === normalizeForLedger(desired)`) matches regardless of what
    // the manifest hash says.
    expect(read('CLAUDE.md').trimEnd()).toBe(currentBlock)
    expect(log).not.toContain('locally edited')

    // The gap is now closed for good for this consumer: the healing sync rewrote the manifest
    // entry with the NORMALIZED hash (writeUnit's form), not the raw legacy one.
    const manifest = JSON.parse(read(MANIFEST_PATH)) as { files: Record<string, string> }
    expect(manifest.files['CLAUDE.md']).toBe(sha256(normalizeForLedger(currentBlock)))

    expect(silenced(() => sync({ check: true }, dir))).toBe(0)
  })

  it('a genuine word-level edit inside the block classifies drifted and is skipped without --force', () => {
    const original = read('CLAUDE.md')
    const edited = original.replace('React 19', 'React 18 (pinned by our team)')
    expect(edited).not.toBe(original)
    write('CLAUDE.md', edited)

    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(0)
    // Untouched — a real edit is never silently overwritten.
    expect(read('CLAUDE.md')).toBe(edited)
    expect(log).toContain('locally edited')

    expect(silenced(() => sync({ check: true }, dir))).toBe(1)

    silenced(() => sync({ force: true }, dir))
    expect(read('CLAUDE.md')).toBe(original)
  })

  it('reformatting AND a real edit together still classifies drifted (whitespace normalization never masks word changes)', () => {
    const original = read('CLAUDE.md')
    const reformattedAndEdited = simulateOxfmtReformat(original).replace(
      'React 19',
      'React 18 (pinned by our team)',
    )
    write('CLAUDE.md', reformattedAndEdited)

    expect(silenced(() => sync({ check: true }, dir))).toBe(1)
    expect(read('CLAUDE.md')).toBe(reformattedAndEdited)
  })
})
