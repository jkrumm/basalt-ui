/**
 * Tests for `basalt init` / `basalt sync` scaffold behavior:
 *  - the `.oxfmtrc.json` scaffold filename (oxfmt auto-discovers this name, not `oxfmt.json`)
 *  - the legacy `oxfmt.json` → `.oxfmtrc.json` manifest/file migration
 *  - the `basalt doctor` CLI-vs-installed version-mismatch warning
 *  - the `basalt init` first-run hint to run `check-theme` and tune per-rule config
 *  - pruning managed rule/skill files a newer basalt-ui no longer ships
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { doctor, init, MANIFEST_PATH, sync } from './index.ts'

const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SHIPPED_OXFMT = readFileSync(resolve(PKG_ROOT, 'configs/oxfmt.json'), 'utf8')

let dir: string

function writeFixture(relPath: string, content: string): void {
  const abs = join(dir, relPath)
  mkdirSync(resolve(abs, '..'), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

/** Captures both console.log and console.error — doctor()/init() pick one or the other by outcome. */
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

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-init-sync-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('oxfmt scaffold filename', () => {
  it('init writes .oxfmtrc.json, not oxfmt.json', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    init(dir)
    expect(existsSync(resolve(dir, '.oxfmtrc.json'))).toBe(true)
    expect(existsSync(resolve(dir, 'oxfmt.json'))).toBe(false)
  })

  it('sync migrates an untouched legacy oxfmt.json: deletes the stale file, drops the manifest key, writes .oxfmtrc.json', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    writeFixture('oxfmt.json', SHIPPED_OXFMT)
    writeFixture(
      MANIFEST_PATH,
      JSON.stringify({ version: 1, files: { 'oxfmt.json': 'irrelevant-legacy-hash' } }, null, 2),
    )

    sync({}, dir)

    expect(existsSync(resolve(dir, 'oxfmt.json'))).toBe(false)
    expect(existsSync(resolve(dir, '.oxfmtrc.json'))).toBe(true)
    expect(readFileSync(resolve(dir, '.oxfmtrc.json'), 'utf8')).toBe(SHIPPED_OXFMT)

    const manifest = JSON.parse(readFileSync(resolve(dir, MANIFEST_PATH), 'utf8')) as {
      files: Record<string, string>
    }
    expect(manifest.files['oxfmt.json']).toBeUndefined()
    expect(manifest.files['.oxfmtrc.json']).toBeDefined()
  })

  it('sync preserves a locally-edited legacy oxfmt.json but still drops the manifest key and scaffolds .oxfmtrc.json', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    writeFixture('oxfmt.json', '{\n  "printWidth": 120\n}\n')
    writeFixture(
      MANIFEST_PATH,
      JSON.stringify({ version: 1, files: { 'oxfmt.json': 'irrelevant-legacy-hash' } }, null, 2),
    )

    sync({}, dir)

    // Locally-edited file is left in place — never silently discarded.
    expect(existsSync(resolve(dir, 'oxfmt.json'))).toBe(true)
    expect(readFileSync(resolve(dir, 'oxfmt.json'), 'utf8')).toBe('{\n  "printWidth": 120\n}\n')
    // The new scaffold is created independently, so no dead duplicate keeps being managed forever.
    expect(existsSync(resolve(dir, '.oxfmtrc.json'))).toBe(true)

    const manifest = JSON.parse(readFileSync(resolve(dir, MANIFEST_PATH), 'utf8')) as {
      files: Record<string, string>
    }
    expect(manifest.files['oxfmt.json']).toBeUndefined()
  })

  it('sync is a no-op for the legacy dest when there is no manifest entry (fresh consumer)', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    writeFixture(MANIFEST_PATH, JSON.stringify({ version: 1, files: {} }, null, 2))

    sync({}, dir)

    expect(existsSync(resolve(dir, 'oxfmt.json'))).toBe(false)
    expect(existsSync(resolve(dir, '.oxfmtrc.json'))).toBe(true)
  })
})

describe('doctor — CLI vs installed basalt-ui version', () => {
  const cliVersion = (
    JSON.parse(readFileSync(resolve(PKG_ROOT, 'package.json'), 'utf8')) as { version: string }
  ).version

  it('warns when node_modules/basalt-ui version differs from the running CLI', () => {
    // A Mantine dependency puts doctor in the framework profile — without one it reads as a
    // tokens-only consumer, where the missing scaffold is not a failure at all.
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'fixture', dependencies: { '@mantine/core': '^9' } }),
    )
    writeFixture(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', version: '0.4.2' }),
    )
    const { code, log } = capture(() => doctor(dir))
    // Only a warning — doctor's exit code is driven by hard failures (manifest missing here too,
    // so exit is 1 regardless; assert on the message rather than the code).
    expect(code).toBe(1)
    expect(log).toContain(cliVersion)
    expect(log).toContain('0.4.2')
  })

  it('passes when node_modules/basalt-ui version matches the running CLI', () => {
    // A full fixture, not just the manifest: doctor also asserts the guard scans something and the
    // oxlint preset is wired, and a green exit has to mean all of it.
    writeFixture('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
    writeFixture('src/app.tsx', 'export const App = () => null\n')
    writeFixture(
      '.oxlintrc.json',
      '{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }',
    )
    writeFixture(MANIFEST_PATH, JSON.stringify({ version: 1, files: {} }, null, 2))
    writeFixture(
      'node_modules/basalt-ui/package.json',
      JSON.stringify({ name: 'basalt-ui', version: cliVersion }),
    )
    // The `extends` above has to RESOLVE, not merely read correctly — see the oxlint-preset check.
    writeFixture('node_modules/basalt-ui/configs/oxlint.json', '{}')
    const { code, log } = capture(() => doctor(dir))
    expect(code).toBe(0)
    expect(log).toContain('matches the installed basalt-ui')
  })

  it('reports the version checks as SKIPPED when the package cannot be resolved', () => {
    writeFixture(MANIFEST_PATH, JSON.stringify({ version: 1, files: {} }, null, 2))
    const { code, log } = capture(() => doctor(dir))
    expect(log).not.toContain('matches the installed basalt-ui')
    // Silence was the bug: two of five checks used to vanish while the footer still read green.
    expect(log).toContain('SKIPPED')
    expect(code).toBe(1)
  })
})

describe('init — first-run hint', () => {
  it('prints a hint to run check-theme and tune per-rule config', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    const { log } = capture(() => init(dir))
    expect(log).toContain('check-theme')
    expect(log.toLowerCase()).toContain('basalt.*')
  })
})

describe('seeds derive from basalt.roots', () => {
  // A monorepo sets `roots` because it has no top-level `src/`. Both the CI oxfmt globs and the
  // DESIGN.md series path used to hardcode `src`, so a consumer that configured roots CORRECTLY
  // still got a CI run that matched zero files (oxfmt exits 2) and a series path that can't exist.
  const MONOREPO = { name: 'fixture', basalt: { roots: ['apps/web/src'] } }

  it('renders the CI oxfmt globs from roots', () => {
    writeFixture('package.json', JSON.stringify(MONOREPO))
    init(dir)
    const ci = readFileSync(resolve(dir, '.github/workflows/check.yml'), 'utf8')
    expect(ci).toContain("bunx oxfmt 'apps/web/src/**' '!**/dist/**' --check")
    expect(ci).not.toContain('{{ROOTS_GLOBS}}')
  })

  it('renders every root, not just the first', () => {
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'f', basalt: { roots: ['a/src', 'b/src'] } }),
    )
    init(dir)
    const ci = readFileSync(resolve(dir, '.github/workflows/check.yml'), 'utf8')
    expect(ci).toContain("bunx oxfmt 'a/src/**' 'b/src/**' '!**/dist/**' --check")
  })

  it("falls back to 'src/**' when roots is unset", () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    init(dir)
    const ci = readFileSync(resolve(dir, '.github/workflows/check.yml'), 'utf8')
    expect(ci).toContain("bunx oxfmt 'src/**' '!**/dist/**' --check")
  })

  it('seeds DESIGN.md with a series path under the first root', () => {
    writeFixture('package.json', JSON.stringify(MONOREPO))
    init(dir)
    const design = readFileSync(resolve(dir, 'DESIGN.md'), 'utf8')
    expect(design).toContain('apps/web/src/lib/series.ts')
  })

  it('falls back to the default root when roots is an explicit empty array', () => {
    // `[]` is nonsense config, but a bare `??` would let it through and render an empty oxfmt glob
    // into CI — the exact "matches zero files" break this derivation exists to prevent.
    writeFixture('package.json', JSON.stringify({ name: 'f', basalt: { roots: [] } }))
    init(dir)
    const ci = readFileSync(resolve(dir, '.github/workflows/check.yml'), 'utf8')
    expect(ci).toContain("bunx oxfmt 'src/**' '!**/dist/**' --check")
    expect(readFileSync(resolve(dir, 'DESIGN.md'), 'utf8')).toContain('src/lib/series.ts')
  })

  it('POSIX-escapes a quote in a root instead of breaking out of the CI shell quoting', () => {
    writeFixture('package.json', JSON.stringify({ name: 'f', basalt: { roots: ["it's/src"] } }))
    init(dir)
    const ci = readFileSync(resolve(dir, '.github/workflows/check.yml'), 'utf8')
    expect(ci).toContain("'it'\\''s/src/**'")
  })

  it('lets seriesModulePath override the roots-derived default', () => {
    writeFixture(
      'package.json',
      JSON.stringify({
        name: 'f',
        basalt: { roots: ['apps/web/src'], seriesModulePath: 'custom/p.ts' },
      }),
    )
    init(dir)
    expect(readFileSync(resolve(dir, 'DESIGN.md'), 'utf8')).toContain('custom/p.ts')
  })
})

/**
 * Retired managed files — the 13→6 rule merge (`docs/CONTROLS-SPEC.md` §7) is the case this exists
 * for: nine `.claude/rules/basalt-*.md` stopped shipping in one minor, and a consumer that never
 * loses them goes on reading superseded doctrine with every gate green.
 */
describe('sync — retired rules and skills', () => {
  const RETIRED_RULE = '.claude/rules/basalt-router.md'
  const RETIRED_SKILL = '.claude/skills/basalt-legacy/SKILL.md'

  /** Seed a real install, then plant a managed file this basalt version no longer ships. */
  function plantRetired(dest: string, body: string, tracked = true): void {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    writeFixture(dest, body)
    const manifestAbs = resolve(dir, MANIFEST_PATH)
    const manifest = JSON.parse(readFileSync(manifestAbs, 'utf8')) as {
      files: Record<string, string>
    }
    // The raw-hash ledger path — what a pre-normalization CLI recorded, and enough to prove
    // "untouched since basalt wrote it" without reaching into the module's private normalizer.
    if (tracked) manifest.files[dest] = createHash('sha256').update(body, 'utf8').digest('hex')
    writeFixture(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  }

  function manifestFiles(): Record<string, string> {
    return (
      JSON.parse(readFileSync(resolve(dir, MANIFEST_PATH), 'utf8')) as {
        files: Record<string, string>
      }
    ).files
  }

  it('deletes an untouched retired rule file and drops its manifest entry', () => {
    plantRetired(RETIRED_RULE, '# superseded by basalt-state.md\n')
    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(0)
    expect(existsSync(resolve(dir, RETIRED_RULE))).toBe(false)
    expect(manifestFiles()[RETIRED_RULE]).toBeUndefined()
    expect(log).toContain(RETIRED_RULE)
    // The six live rules are untouched by the prune.
    expect(existsSync(resolve(dir, '.claude/rules/basalt-state.md'))).toBe(true)
  })

  it('deletes a retired skill and removes the now-empty skill directory', () => {
    plantRetired(RETIRED_SKILL, '---\nname: basalt-legacy\n---\n')
    capture(() => sync({}, dir))
    expect(existsSync(resolve(dir, RETIRED_SKILL))).toBe(false)
    expect(existsSync(resolve(dir, '.claude/skills/basalt-legacy'))).toBe(false)
    expect(existsSync(resolve(dir, '.claude/skills/basalt-app/SKILL.md'))).toBe(true)
  })

  it('leaves a locally-edited retired rule in place, keeps its entry, and says so', () => {
    plantRetired(RETIRED_RULE, '# shipped body\n')
    writeFixture(RETIRED_RULE, '# shipped body\n\nplus a local paragraph nobody else wrote\n')
    const { code, log } = capture(() => sync({}, dir))
    expect(code).toBe(0)
    expect(existsSync(resolve(dir, RETIRED_RULE))).toBe(true)
    expect(manifestFiles()[RETIRED_RULE]).toBeDefined()
    expect(log).toContain('locally edited')
  })

  it('--force deletes a locally-edited retired rule', () => {
    plantRetired(RETIRED_RULE, '# shipped body\n')
    writeFixture(RETIRED_RULE, '# shipped body\n\nlocal edit\n')
    capture(() => sync({ force: true }, dir))
    expect(existsSync(resolve(dir, RETIRED_RULE))).toBe(false)
    expect(manifestFiles()[RETIRED_RULE]).toBeUndefined()
  })

  it('--check reports a retired rule, exits 1, and writes nothing', () => {
    plantRetired(RETIRED_RULE, '# superseded\n')
    const { code, log } = capture(() => sync({ check: true }, dir))
    expect(code).toBe(1)
    expect(log).toContain('retired rule/skill file(s) still present')
    expect(existsSync(resolve(dir, RETIRED_RULE))).toBe(true)
    expect(manifestFiles()[RETIRED_RULE]).toBeDefined()
  })

  it('never prunes a tracked dest outside the rules/skills namespaces', () => {
    // `src/routes/__root.tsx` is legitimately absent from `managedFiles()` whenever the router or
    // query peer is missing — pruning on "this run did not place it" would delete a real scaffold.
    plantRetired('src/routes/__root.tsx', 'export const Route = null\n')
    capture(() => sync({}, dir))
    expect(existsSync(resolve(dir, 'src/routes/__root.tsx'))).toBe(true)
    expect(manifestFiles()['src/routes/__root.tsx']).toBeDefined()
  })

  it('init prunes a retired rule too', () => {
    plantRetired(RETIRED_RULE, '# superseded\n')
    const { log } = capture(() => init(dir))
    expect(existsSync(resolve(dir, RETIRED_RULE))).toBe(false)
    expect(log).toContain('no longer ship')
  })
})
