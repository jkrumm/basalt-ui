/**
 * Tests for the `basalt doctor` subcommand.
 * Run: bun test packages/basalt-ui/tests/doctor.test.ts
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { doctor, MANIFEST_PATH, RULE_NAMES } from '../src/cli/index'

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
