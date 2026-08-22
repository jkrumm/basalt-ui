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
import { deriveSpacing } from '../src/tokens'

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

describe('basalt doctor — ai-major-parity', () => {
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

  it('hard-fails and names both packages when workspace packages disagree on the ai major', () => {
    setupPassingLayout()
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'consumer-monorepo', workspaces: ['packages/*'] }),
    )
    writeFixture(
      'packages/api/package.json',
      JSON.stringify({ name: 'api', dependencies: { ai: '5.0.196' } }),
    )
    writeFixture(
      'packages/dashboard/package.json',
      JSON.stringify({ name: 'dashboard', dependencies: { ai: '^7.0.18' } }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(1)
    expect(out).toContain('ai package major version mismatch')
    expect(out).toContain('api@ai5')
    expect(out).toContain('dashboard@ai7')
  })

  it('passes when every workspace package agrees on the ai major', () => {
    setupPassingLayout()
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'consumer-monorepo', workspaces: ['packages/*'] }),
    )
    writeFixture(
      'packages/api/package.json',
      JSON.stringify({ name: 'api', dependencies: { ai: '^7.0.15' } }),
    )
    writeFixture(
      'packages/dashboard/package.json',
      JSON.stringify({ name: 'dashboard', dependencies: { ai: '^7.0.18' } }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).toContain('ai package major matches across 2 workspace package(s)')
  })

  it('is silent (no line, no failure) for a repo with no workspaces field', () => {
    setupPassingLayout()
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).not.toContain('ai package major')
  })

  it('skips a workspace package that declares no ai dependency at all', () => {
    setupPassingLayout()
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'consumer-monorepo', workspaces: ['packages/*'] }),
    )
    writeFixture('packages/api/package.json', JSON.stringify({ name: 'api', dependencies: {} }))
    writeFixture(
      'packages/dashboard/package.json',
      JSON.stringify({ name: 'dashboard', dependencies: { ai: '^7.0.18' } }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).toContain('ai package major matches across 1 workspace package(s)')
  })

  it('hard-fails when the ROOT manifest itself skews against a workspace package (hoisted dev dep)', () => {
    setupPassingLayout()
    writeFixture(
      'package.json',
      JSON.stringify({
        name: 'consumer-monorepo',
        workspaces: ['packages/*'],
        devDependencies: { ai: '5.0.196' },
      }),
    )
    writeFixture(
      'packages/dashboard/package.json',
      JSON.stringify({ name: 'dashboard', dependencies: { ai: '^7.0.18' } }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(1)
    expect(out).toContain('ai package major version mismatch')
    expect(out).toContain('consumer-monorepo (root)@ai5')
    expect(out).toContain('dashboard@ai7')
  })

  it('walks a "packages/**" workspaces pattern instead of silently skipping it', () => {
    setupPassingLayout()
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'consumer-monorepo', workspaces: ['packages/**'] }),
    )
    writeFixture(
      'packages/nested/service/package.json',
      JSON.stringify({ name: 'nested-service', dependencies: { ai: '5.0.196' } }),
    )
    writeFixture(
      'packages/dashboard/package.json',
      JSON.stringify({ name: 'dashboard', dependencies: { ai: '^7.0.18' } }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(1)
    expect(out).toContain('ai package major version mismatch')
    expect(out).toContain('nested-service@ai5')
    expect(out).toContain('dashboard@ai7')
  })

  it('does not descend into node_modules when walking a "packages/**" workspaces pattern', () => {
    setupPassingLayout()
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'consumer-monorepo', workspaces: ['packages/**'] }),
    )
    writeFixture(
      'packages/api/package.json',
      JSON.stringify({ name: 'api', dependencies: { ai: '^7.0.18' } }),
    )
    writeFixture(
      'packages/api/node_modules/skewed-dep/package.json',
      JSON.stringify({ name: 'skewed-dep', dependencies: { ai: '5.0.196' } }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).not.toContain('ai package major version mismatch')
    expect(out).not.toContain('skewed-dep')
  })

  it('honours a "!"-prefixed exclusion entry: the excluded package is invisible to ai-major-parity while a non-excluded skew still fails', () => {
    setupPassingLayout()
    writeFixture(
      'package.json',
      JSON.stringify({
        name: 'consumer-monorepo',
        workspaces: ['packages/*', '!packages/legacy'],
      }),
    )
    writeFixture(
      'packages/api/package.json',
      JSON.stringify({ name: 'api', dependencies: { ai: '5.0.196' } }),
    )
    writeFixture(
      'packages/dashboard/package.json',
      JSON.stringify({ name: 'dashboard', dependencies: { ai: '^7.0.18' } }),
    )
    writeFixture(
      'packages/legacy/package.json',
      JSON.stringify({ name: 'legacy', dependencies: { ai: '3.0.0' } }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(1)
    expect(out).toContain('ai package major version mismatch')
    expect(out).toContain('api@ai5')
    expect(out).toContain('dashboard@ai7')
    expect(out).not.toContain('legacy')
  })

  it('reports pass() naming the reason when workspaces exist but none declare ai', () => {
    setupPassingLayout()
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'consumer-monorepo', workspaces: ['packages/*'] }),
    )
    writeFixture('packages/api/package.json', JSON.stringify({ name: 'api', dependencies: {} }))
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).toContain('ai-major-parity')
    expect(out).toContain('nothing to compare')
  })
})

describe('basalt doctor — ai-major-parity, aiMajorSkewReason exemption', () => {
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

  /** The skewed-workspace layout every case below starts from: root config + two skewed packages. */
  function writeSkewedWorkspace(basalt?: Record<string, unknown>): void {
    writeFixture(
      'package.json',
      JSON.stringify({
        name: 'consumer-monorepo',
        workspaces: ['packages/*'],
        ...(basalt !== undefined ? { basalt } : {}),
      }),
    )
    writeFixture(
      'packages/api/package.json',
      JSON.stringify({ name: 'api', dependencies: { ai: '5.0.196' } }),
    )
    writeFixture(
      'packages/dashboard/package.json',
      JSON.stringify({ name: 'dashboard', dependencies: { ai: '^7.0.18' } }),
    )
  }

  it('still hard-fails a skew with no aiMajorSkewReason key at all (default unweakened)', () => {
    setupPassingLayout()
    writeSkewedWorkspace()
    const { code, out } = runDoctor()
    expect(code).toBe(1)
    expect(out).toContain('ai package major version mismatch')
    expect(out).not.toContain('aiMajorSkewReason')
  })

  it('passes and echoes the skew + the reason when aiMajorSkewReason is a non-empty string', () => {
    setupPassingLayout()
    writeSkewedWorkspace({
      aiMajorSkewReason:
        'apps/api on ai@5, apps/dashboard on ai@7 — neutralized by a producer-side TransformStream',
    })
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).toContain('api@ai5')
    expect(out).toContain('dashboard@ai7')
    expect(out).toContain(
      'apps/api on ai@5, apps/dashboard on ai@7 — neutralized by a producer-side TransformStream',
    )
  })

  it('still hard-fails when aiMajorSkewReason is present but not a non-empty string (bare true)', () => {
    setupPassingLayout()
    writeSkewedWorkspace({ aiMajorSkewReason: true })
    const { code, out } = runDoctor()
    expect(code).toBe(1)
    expect(out).toContain('ai package major version mismatch')
    expect(out).toContain('aiMajorSkewReason')
  })

  it('still hard-fails when aiMajorSkewReason is an empty string', () => {
    setupPassingLayout()
    writeSkewedWorkspace({ aiMajorSkewReason: '' })
    const { code, out } = runDoctor()
    expect(code).toBe(1)
    expect(out).toContain('ai package major version mismatch')
  })

  it('warns that a declared aiMajorSkewReason is stale when the majors already agree', () => {
    setupPassingLayout()
    writeFixture(
      'package.json',
      JSON.stringify({
        name: 'consumer-monorepo',
        workspaces: ['packages/*'],
        basalt: { aiMajorSkewReason: 'no longer skewed, forgot to delete this' },
      }),
    )
    writeFixture(
      'packages/api/package.json',
      JSON.stringify({ name: 'api', dependencies: { ai: '^7.0.18' } }),
    )
    writeFixture(
      'packages/dashboard/package.json',
      JSON.stringify({ name: 'dashboard', dependencies: { ai: '^7.0.18' } }),
    )
    const { code, out } = runDoctor()
    expect(code).toBe(0)
    expect(out).toContain('aiMajorSkewReason')
    expect(out).toContain('no longer needed')
  })
})
