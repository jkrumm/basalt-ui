/**
 * Tests for the `basalt doctor` subcommand.
 * Run: bun test packages/basalt-ui/tests/doctor.test.ts
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { doctor, MANIFEST_PATH, RULE_NAMES } from '../src/cli/index'

const CLI_VERSION = (
  JSON.parse(
    readFileSync(resolve(fileURLToPath(new URL('../', import.meta.url)), 'package.json'), 'utf8'),
  ) as { version: string }
).version

// ── Fixture helpers ───────────────────────────────────────────────────────────

let tmpDir: string

function writeFixture(relPath: string, content: string): void {
  const abs = join(tmpDir, relPath)
  mkdirSync(join(tmpDir, relPath.split('/').slice(0, -1).join('/')), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

function setupPassingLayout(): void {
  // 0. the wiring doctor now also asserts: a resolvable install, a root the guard can scan, and an
  //    oxlint config that actually extends the shipped preset. A green exit has to mean all of it —
  //    each of these was a false-green a consumer shipped for weeks.
  writeFixture('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
  writeFixture('src/app.tsx', 'export const App = () => null\n')
  writeFixture('.oxlintrc.json', '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }')
  writeFixture(
    'node_modules/basalt-ui/package.json',
    JSON.stringify({ name: 'basalt-ui', version: CLI_VERSION }),
  )
  // The preset the `extends` above names has to BE there: matching the string alone passed in the
  // exact tree where oxlint died with `NotFound`.
  writeFixture('node_modules/basalt-ui/configs/oxlint.json', '{}')

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
    // Placed-file drift is `sync --check`'s job, not doctor's — a missing CLAUDE.md is not a
    // doctor failure. Built from the passing layout minus that one file so the assertion is about
    // CLAUDE.md and not about some other check the fixture happens to be missing.
    setupPassingLayout()
    rmSync(join(tmpDir, 'CLAUDE.md'), { force: true })
    expect(doctor(tmpDir)).toBe(0)
  })

  it('returns 0 (warn only) when some rule files are missing', () => {
    setupPassingLayout()
    for (const name of RULE_NAMES.slice(0, 2)) {
      rmSync(join(tmpDir, `.claude/rules/basalt-${name}.md`), { force: true })
    }
    expect(doctor(tmpDir)).toBe(0)
  })
})

describe('basalt doctor — ai-major-parity within one package.json', () => {
  /** Run doctor, capturing stdout/stderr so the emitted lines can be asserted on either way. */
  function runDoctor(): { code: number; out: string } {
    const originalLog = console.log
    const originalError = console.error
    let out = ''
    console.log = (...args: unknown[]) => {
      out += `${args.join(' ')}\n`
    }
    console.error = (...args: unknown[]) => {
      out += `${args.join(' ')}\n`
    }
    try {
      return { code: doctor(tmpDir), out }
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  }

  /** The skewed layout every case below starts from: dependencies@5 vs peerDependencies@7. */
  function writeSkewedPackage(basalt?: Record<string, unknown>): void {
    writeFixture(
      'package.json',
      JSON.stringify({
        name: 'fixture',
        basalt: { roots: ['src'], ...basalt },
        dependencies: { ai: '5.0.196' },
        peerDependencies: { ai: '^7.0.18' },
      }),
    )
  }

  it('still hard-fails a skew with no aiMajorSkewReason key at all (default unweakened)', () => {
    setupPassingLayout()
    writeSkewedPackage()
    const { code, out } = runDoctor()
    expect(code).toBe(1)
    expect(out).toContain('ai package major version mismatch within this package.json')
    expect(out).not.toContain('aiMajorSkewReason')
  })

  it('still hard-fails when aiMajorSkewReason is present but not a non-empty string (bare true)', () => {
    setupPassingLayout()
    writeSkewedPackage({ aiMajorSkewReason: true })
    const { code, out } = runDoctor()
    expect(code).toBe(1)
    expect(out).toContain('ai package major version mismatch within this package.json')
    expect(out).toContain('aiMajorSkewReason')
  })

  it('still hard-fails when aiMajorSkewReason is an empty string', () => {
    setupPassingLayout()
    writeSkewedPackage({ aiMajorSkewReason: '' })
    const { code, out } = runDoctor()
    expect(code).toBe(1)
    expect(out).toContain('ai package major version mismatch within this package.json')
  })
})

/**
 * `sync` refuses in a non-install package by NAMING the parent install (1.22.0's "stop scaffolding
 * a second consumer" fix); `doctor` in the same directory kept prescribing `basalt-ui init`, so
 * following it literally performed the exact mistake that fix prevents.
 */
describe('basalt doctor — a package under a configured repo is not an unscaffolded consumer', () => {
  function runDoctorIn(dir: string): { code: number; out: string } {
    const originalLog = console.log
    const originalError = console.error
    let out = ''
    const sink = (...args: unknown[]) => {
      out += `${args.join(' ')}\n`
    }
    console.log = sink
    console.error = sink
    try {
      return { code: doctor(dir), out }
    } finally {
      console.log = originalLog
      console.error = originalError
    }
  }

  it('names the parent install instead of recommending init', () => {
    setupPassingLayout()
    // A sub-package carrying its own basalt config, so resolveProjectDir stays put rather than
    // relocating: the "standing in apps/web" shape every consumer reported.
    writeFixture(
      'apps/web/package.json',
      JSON.stringify({ name: 'web', basalt: { profile: 'framework', roots: ['src'] } }),
    )
    writeFixture('apps/web/src/app.tsx', 'export const App = () => null\n')

    const { code, out } = runDoctorIn(join(tmpDir, 'apps/web'))
    expect(code).toBe(1)
    expect(out).toContain("This repo's install is at ../..")
    expect(out).toContain('run doctor there, or set BASALT_CWD to it')
    expect(out).toContain('`basalt-ui init` is NOT the fix')
    expect(out).not.toContain('Run `basalt-ui init` to seed it.')
  })

  it('a genuinely unscaffolded repo still gets the init advice', () => {
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'fixture', basalt: { profile: 'framework', roots: ['src'] } }),
    )
    writeFixture('src/app.tsx', 'export const App = () => null\n')
    const { out } = runDoctorIn(tmpDir)
    expect(out).toContain('run `basalt-ui init` to scaffold the consumer repo')
  })
})
