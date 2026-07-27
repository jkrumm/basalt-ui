/**
 * Tests for the `basalt doctor` subcommand.
 * Run: bun test packages/basalt-ui/tests/doctor.test.ts
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { doctor, MANIFEST_PATH, RULE_NAMES } from '../src/cli/index'
import { deriveSpacing } from '../src/tokens'

// ── Fixture helpers ───────────────────────────────────────────────────────────

let tmpDir: string

function writeFixture(relPath: string, content: string): void {
  const abs = join(tmpDir, relPath)
  mkdirSync(join(tmpDir, relPath.split('/').slice(0, -1).join('/')), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

function setupPassingLayout(): void {
  // 1. manifest
  writeFixture(MANIFEST_PATH, JSON.stringify({ version: 1, files: {} }, null, 2))

  // 2. CLAUDE.md with managed block
  writeFixture(
    'CLAUDE.md',
    '# My App\n\n<!-- basalt:begin 1.0.0 -->\nmanaged block\n<!-- basalt:end -->\n',
  )

  // 3. all 11 rule files
  for (const name of RULE_NAMES) {
    writeFixture(`.claude/rules/basalt-${name}.md`, `# basalt-${name}\n`)
  }
  // Note: plugin check is best-effort warn-only; we do not control ~/.claude/settings.json in tests
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'basalt-doctor-'))
})

afterEach(() => {
  // tmp dirs are cleaned up by the OS; no explicit removal needed for CI
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('basalt doctor', () => {
  it('passes (exit 0) on a minimal fully-scaffolded layout', () => {
    setupPassingLayout()
    // The plugin check is warn-only; exit code depends only on hard failures.
    const exitCode = doctor(tmpDir)
    expect(exitCode).toBe(0)
  })

  it('fails (exit 1) when manifest is missing', () => {
    // Omit the manifest — only set up CLAUDE.md and rule files
    writeFixture('CLAUDE.md', '<!-- basalt:begin 1.0.0 -->\nblock\n<!-- basalt:end -->\n')
    for (const name of RULE_NAMES) {
      writeFixture(`.claude/rules/basalt-${name}.md`, `# basalt-${name}\n`)
    }
    const exitCode = doctor(tmpDir)
    expect(exitCode).toBe(1)
  })

  it('returns 0 (warn only) when CLAUDE.md is missing', () => {
    // manifest present, rule files present, no CLAUDE.md → warning but no hard failure
    writeFixture(MANIFEST_PATH, JSON.stringify({ version: 1, files: {} }, null, 2))
    for (const name of RULE_NAMES) {
      writeFixture(`.claude/rules/basalt-${name}.md`, `# basalt-${name}\n`)
    }
    const exitCode = doctor(tmpDir)
    expect(exitCode).toBe(0) // warning only — no hard failure
  })

  it('returns 0 (warn only) when some rule files are missing', () => {
    writeFixture(MANIFEST_PATH, JSON.stringify({ version: 1, files: {} }, null, 2))
    writeFixture('CLAUDE.md', '<!-- basalt:begin 1.0.0 -->\nblock\n<!-- basalt:end -->\n')
    // Deliberately omit the first two rule files
    for (const name of RULE_NAMES.slice(2)) {
      writeFixture(`.claude/rules/basalt-${name}.md`, `# basalt-${name}\n`)
    }
    const exitCode = doctor(tmpDir)
    expect(exitCode).toBe(0) // warning only
  })
})

describe('basalt doctor — spacing-scale drift', () => {
  /** Run doctor, capturing stdout so the emitted lines can be asserted on. */
  function runDoctor(): { code: number; out: string } {
    const original = console.log
    let out = ''
    console.log = (...args: unknown[]) => {
      out += `${args.join(' ')}\n`
    }
    try {
      return { code: doctor(tmpDir), out }
    } finally {
      console.log = original
    }
  }

  it('warns when the recorded scale differs from the installed one', () => {
    setupPassingLayout()
    // A scale one notch off the shipped level-0 ladder — what a consumer's manifest looks like the
    // moment after a retune lands and before they have looked at their app.
    writeFixture(
      MANIFEST_PATH,
      JSON.stringify({
        version: 1,
        files: {},
        spacingScale: { ...deriveSpacing(0).scale, md: deriveSpacing(0).scale.md + 2 },
      }),
    )
    const { code, out } = runDoctor()
    // A warning, never a hard failure: nothing is broken, the app just looks different.
    expect(code).toBe(0)
    expect(out).toContain('spacing scale moved')
    expect(out).toContain(`md ${deriveSpacing(0).scale.md + 2}→${deriveSpacing(0).scale.md}`)
    expect(out).toContain('createBasaltTheme() bare')
  })

  it('passes silently when the recorded scale matches', () => {
    setupPassingLayout()
    writeFixture(
      MANIFEST_PATH,
      JSON.stringify({ version: 1, files: {}, spacingScale: { ...deriveSpacing(0).scale } }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).toContain('spacing scale matches the last sync')
    expect(out).not.toContain('spacing scale moved')
  })

  it('does not double-warn a manifest written before the field existed', () => {
    // The version check already tells them to sync; a second warning for the same cause is noise.
    setupPassingLayout()
    const { out } = runDoctor()
    expect(out).not.toContain('spacing scale moved')
    expect(out).toContain('spacing scale not yet recorded')
  })

  it('skips the comparison when this CLI is not the installed package', () => {
    // A stale `bunx basalt-ui` fetch: the CLI's own scale is not the one the app renders with, so
    // any verdict it reaches is about the wrong package. Claiming a match here is the false pass
    // this skip exists to prevent.
    setupPassingLayout()
    writeFixture(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', version: '0.0.0-not-this-cli' }),
    )
    writeFixture(
      MANIFEST_PATH,
      JSON.stringify({ version: 1, files: {}, spacingScale: { ...deriveSpacing(0).scale } }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).toContain('spacing scale not compared')
    expect(out).not.toContain('spacing scale matches the last sync')
    expect(out).not.toContain('spacing scale moved')
  })

  it('ignores a null spacingScale instead of indexing it', () => {
    // `typeof null === 'object'` — a hand-edited manifest must not crash doctor.
    setupPassingLayout()
    writeFixture(MANIFEST_PATH, JSON.stringify({ version: 1, files: {}, spacingScale: null }))
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).toContain('spacing scale not yet recorded')
  })

  it('ignores a spacingScale whose values are not numbers', () => {
    // `"4" !== 4` would otherwise report every single step as moved.
    setupPassingLayout()
    writeFixture(
      MANIFEST_PATH,
      JSON.stringify({ version: 1, files: {}, spacingScale: { xs: '4', sm: 8 } }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).toContain('spacing scale not yet recorded')
    expect(out).not.toContain('spacing scale moved')
  })

  it('reports a step the recorded scale has and the current one no longer does', () => {
    // Iterating only the CURRENT keys would miss a removed step entirely and call it a match.
    setupPassingLayout()
    writeFixture(
      MANIFEST_PATH,
      JSON.stringify({
        version: 1,
        files: {},
        spacingScale: { ...deriveSpacing(0).scale, retiredStep: 12 },
      }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).toContain('spacing scale moved')
    expect(out).toContain('retiredStep 12→(removed)')
  })
})
