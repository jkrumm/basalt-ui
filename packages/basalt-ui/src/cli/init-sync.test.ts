/**
 * Tests for `basalt init` / `basalt sync` scaffold behavior:
 *  - the `.oxfmtrc.json` scaffold filename (oxfmt auto-discovers this name, not `oxfmt.json`)
 *  - the `basalt init` first-run hint to run `check-theme` and tune per-rule config
 *  - pruning managed rule/skill files a newer basalt-ui no longer ships
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { doctor, init, MANIFEST_PATH, renderRulePaths, run, sync } from './index.ts'

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

  it('sync is a no-op for the legacy dest when there is no manifest entry (fresh consumer)', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    writeFixture(MANIFEST_PATH, JSON.stringify({ version: 1, files: {} }, null, 2))

    sync({}, dir)

    expect(existsSync(resolve(dir, 'oxfmt.json'))).toBe(false)
    expect(existsSync(resolve(dir, '.oxfmtrc.json'))).toBe(true)
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

  it('runs make check after the drift steps when the repo has a Makefile check target', () => {
    writeFixture('package.json', JSON.stringify(MONOREPO))
    writeFixture('Makefile', '.PHONY: check\ncheck:\n\tbun run test\n')
    init(dir)
    const ci = readFileSync(resolve(dir, '.github/workflows/check.yml'), 'utf8')
    expect(ci).toMatch(/doctor'\n\s+- run: '[^']*sync --check'\n\s+- run: make check\n/)
    expect(ci).not.toContain('- run: bunx oxlint')
    expect(ci).not.toContain('- run: bunx oxfmt')
    expect(ci).not.toContain('{{')
  })

  it('keeps the built-in steps without a Makefile check target', () => {
    writeFixture('package.json', JSON.stringify(MONOREPO))
    writeFixture('Makefile', 'build:\n\ttrue\n')
    init(dir)
    const ci = readFileSync(resolve(dir, '.github/workflows/check.yml'), 'utf8')
    expect(ci).toContain('- run: bunx oxlint .')
    expect(ci).toContain('check-theme')
    expect(ci).not.toContain('- run: make check')
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

/**
 * `sync --check` sits in consumers' CI `check` chains, and it printed permanent "skipped"
 * paragraphs (lefthook.yml, .github/workflows/check.yml) on EVERY run — a
 * state that is correct, unchanging, and in a CI log indistinguishable from the drift the gate
 * exists to report. The count survives; the paragraphs move behind `--verbose`.
 */
describe('sync --check — a permanent skip is not drift', () => {
  /** A non-root package with a real install, so the two repo-root-shaped seeds are skipped. */
  function nonRootFixture(): string {
    writeFixture('package.json', JSON.stringify({ name: 'root' }))
    writeFixture('.git/HEAD', 'ref: refs/heads/master\n')
    const app = join(dir, 'app')
    writeFixture('app/package.json', JSON.stringify({ name: 'app' }))
    capture(() => init(app))
    return app
  }

  it('prints the skips in full on a normal sync', () => {
    const app = nonRootFixture()
    const { log } = capture(() => sync({}, app))
    expect(log).toContain('skipped lefthook.yml')
    expect(log).toContain('skipped .github/workflows/check.yml')
  })

  it('replaces them with a count on --check', () => {
    const app = nonRootFixture()
    const { code, log } = capture(() => sync({ check: true }, app))
    expect(code).toBe(0)
    expect(log).not.toContain('skipped lefthook.yml')
    expect(log).toContain('2 permanent placement skip(s) — --verbose for detail')
  })

  it('spells them out again under --check --verbose', () => {
    const app = nonRootFixture()
    const { log } = capture(() => sync({ check: true, flags: ['--verbose'] }, app))
    expect(log).toContain('skipped lefthook.yml')
  })

  it('says nothing about skips when there are none', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    const { code, log } = capture(() => sync({ check: true }, dir))
    expect(code).toBe(0)
    expect(log).not.toContain('placement skip')
  })
})

describe('router seeds — the nav module and the root route', () => {
  const PEERS = {
    name: 'fixture',
    dependencies: { '@tanstack/react-router': '^1.0.0', '@tanstack/react-query': '^5.0.0' },
  }

  it('init seeds a leaf NAV module and a root route that passes nav={NAV}', () => {
    writeFixture('package.json', JSON.stringify(PEERS))
    init(dir)
    const nav = readFileSync(resolve(dir, 'src/lib/nav.tsx'), 'utf8')
    const root = readFileSync(resolve(dir, 'src/routes/__root.tsx'), 'utf8')
    expect(nav).toContain('export const NAV = defineNav(')
    expect(nav).not.toContain("from '../routes/__root'")
    expect(root).toContain("import { NAV } from '../lib/nav'")
    expect(root).toContain('nav={NAV}')
    expect(root).not.toContain('sections=')
    expect(root).not.toContain('useNav')
  })

  it('a second sync leaves both consumer-owned seeds untouched and undrifted', () => {
    writeFixture('package.json', JSON.stringify(PEERS))
    init(dir)
    const before = ['src/lib/nav.tsx', 'src/routes/__root.tsx'].map((f) =>
      readFileSync(resolve(dir, f), 'utf8'),
    )
    writeFixture('src/lib/nav.tsx', `${before[0]}// local edit\n`)
    const { code } = capture(() => sync({ check: true }, dir))
    expect(code).toBe(0)
    capture(() => sync({}, dir))
    expect(readFileSync(resolve(dir, 'src/lib/nav.tsx'), 'utf8')).toBe(
      `${before[0]}// local edit\n`,
    )
    expect(readFileSync(resolve(dir, 'src/routes/__root.tsx'), 'utf8')).toBe(before[1]!)
  })

  it('seeds all three router files with no flags and no TanStack deps declared', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    const { log } = capture(() => init(dir))
    for (const dest of ['src/lib/nav.tsx', 'src/routes/__root.tsx', 'src/main.tsx']) {
      expect(existsSync(resolve(dir, dest))).toBe(true)
    }
    expect(log).not.toContain('skipped src/lib/nav.tsx')
  })

  it('seeds nothing router-shaped into a TanStack Start app and names the in-tree seam', () => {
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-start': '*' } }),
    )
    const initOut = capture(() => init(dir))
    expect(initOut.log).toContain('TanStack Start app')
    expect(initOut.log).toContain('<BasaltProvider>')
    capture(() => sync({}, dir))
    const syncOut = capture(() => sync({}, dir))
    expect(syncOut.log).toContain('TanStack Start app')
    for (const dest of ['src/lib/nav.tsx', 'src/routes/__root.tsx', 'src/main.tsx']) {
      expect(existsSync(resolve(dir, dest))).toBe(false)
    }
    // The rest of the scaffold still lands.
    expect(existsSync(resolve(dir, MANIFEST_PATH))).toBe(true)
  })

  const ROUTER_SEEDS = ['src/lib/nav.tsx', 'src/routes/__root.tsx', 'src/main.tsx']
  const manifestKeys = (): string[] =>
    Object.keys(JSON.parse(readFileSync(resolve(dir, MANIFEST_PATH), 'utf8')).files)
  const codeRouted = (): void => {
    writeFixture('index.html', '<script type="module" src="/src/main.tsx"></script>')
    writeFixture('src/main.tsx', 'const router = createBasaltRouter({ routeTree })\n')
  }

  it.each([
    [
      'a router plugin',
      'vite.config.ts',
      "import { tanstackRouter } from '@tanstack/router-plugin/vite'\nexport default { plugins: [tanstackRouter()] }\n",
    ],
    ['a routeTree.gen.ts', 'src/routeTree.gen.ts', 'export const routeTree = {}\n'],
  ])('a file-based app (%s) is not code-routed and keeps its router seeds', (_, file, body) => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    codeRouted()
    writeFixture(file, body)
    capture(() => init(dir))
    capture(() => sync({}, dir))
    for (const dest of ROUTER_SEEDS) expect(existsSync(resolve(dir, dest))).toBe(true)
  })

  it('a code-routed app gets no router seeds on init', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    codeRouted()
    expect(capture(() => init(dir)).log).toContain('code-routed app')
    expect(existsSync(resolve(dir, 'src/routes/__root.tsx'))).toBe(false)
    expect(existsSync(resolve(dir, 'src/lib/nav.tsx'))).toBe(false)
    expect(manifestKeys().filter((k) => ROUTER_SEEDS.includes(k))).toEqual([])
  })

  it('sync retires the manifest entries of router seeds a code-routed app no longer takes', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    expect(manifestKeys()).toEqual(expect.arrayContaining(ROUTER_SEEDS))
    codeRouted()
    const first = capture(() => sync({}, dir))
    expect(first.log).toContain('code-routed app — dropped')
    expect(first.log).toContain('src/routes/__root.tsx')
    expect(manifestKeys().filter((k) => ROUTER_SEEDS.includes(k))).toEqual([])
    expect(existsSync(resolve(dir, 'src/routes/__root.tsx'))).toBe(true)
    expect(capture(() => sync({}, dir)).log).not.toContain('code-routed app')
    expect(capture(() => sync({ check: true }, dir)).code).toBe(0)
  })

  it('sync --check on a code-routed app keeps the manifest keys and prints no drop notice', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    codeRouted()
    const before = manifestKeys()
    const out = capture(() => sync({ check: true }, dir))
    expect(out.code).toBe(0)
    expect(out.log).not.toContain('dropped')
    expect(manifestKeys()).toEqual(before)
  })

  const declareShell = (shell: unknown): void =>
    writeFixture('package.json', JSON.stringify({ name: 'fixture', basalt: { shell } }))
  const PAIR = ['src/lib/nav.tsx', 'src/routes/__root.tsx']

  it('shell: false on a fresh init places neither the nav nor the root seed, and nothing dangles', () => {
    declareShell(false)
    const out = capture(() => init(dir))
    expect(out.log).toContain('basalt.shell: false')
    for (const dest of PAIR) expect(existsSync(resolve(dir, dest))).toBe(false)
    expect(manifestKeys().filter((k) => PAIR.includes(k))).toEqual([])
    // No surviving seed imports the nav module that was not written.
    for (const file of ['src/main.tsx']) {
      const text = existsSync(resolve(dir, file)) ? readFileSync(resolve(dir, file), 'utf8') : ''
      expect(text).not.toMatch(/lib\/nav/)
    }
  })

  it('shell: false on an existing app retires both entries with the notice; sync --check is green', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    expect(manifestKeys()).toEqual(expect.arrayContaining(PAIR))
    declareShell(false)
    const first = capture(() => sync({}, dir))
    expect(first.log).toContain('basalt.shell: false — dropped')
    for (const dest of PAIR) expect(first.log).toContain(dest)
    expect(manifestKeys().filter((k) => PAIR.includes(k))).toEqual([])
    for (const dest of PAIR) expect(existsSync(resolve(dir, dest))).toBe(true)
    expect(capture(() => sync({}, dir)).log).not.toContain('dropped')
    expect(capture(() => sync({ check: true }, dir)).code).toBe(0)
  })

  it('a deleted nav seed does not come back under shell: false', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    declareShell(false)
    capture(() => sync({}, dir))
    rmSync(resolve(dir, 'src/lib/nav.tsx'))
    capture(() => sync({}, dir))
    expect(existsSync(resolve(dir, 'src/lib/nav.tsx'))).toBe(false)
  })

  it('without the key (default) both seeds are placed', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    for (const dest of PAIR) expect(existsSync(resolve(dir, dest))).toBe(true)
  })

  it.each(['no', 0, null])('a non-boolean shell (%p) is a config error on init and sync', (bad) => {
    declareShell(bad)
    for (const run of [() => init(dir), () => sync({}, dir)]) {
      const out = capture(run)
      expect(out.code).toBe(1)
      expect(out.log).toContain('basalt.shell must be a boolean')
    }
  })

  it('init, sync and doctor classify the same lazy-router fixture identically', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    writeFixture('index.html', '<script type="module" src="/src/main.tsx"></script>')
    writeFixture(
      'src/main.tsx',
      "import { BasaltProvider } from 'basalt-ui'\nconst Router = lazy(() => import('./router'))\n<BasaltProvider />\n",
    )
    writeFixture('src/router.ts', 'export const router = createBasaltRouter({ routeTree })\n')
    expect(capture(() => init(dir)).log).toContain('code-routed app')
    expect(existsSync(resolve(dir, 'src/routes/__root.tsx'))).toBe(false)
    expect(capture(() => sync({}, dir)).log).not.toContain('dropped')
    expect(capture(() => doctor(dir)).log).toContain('✓ app-wiring')
  })

  it('sync still recreates a deleted non-router seed (self-healing)', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    rmSync(resolve(dir, 'lefthook.yml'))
    expect(capture(() => sync({}, dir)).log).toContain('1 recreated')
    expect(existsSync(resolve(dir, 'lefthook.yml'))).toBe(true)
  })

  it('sync after Start is added drops the old seeds from the manifest and warns by content', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    const seeds = ['src/lib/nav.tsx', 'src/routes/__root.tsx', 'src/main.tsx']
    // A stale seed that mounts no router is not warned about, however the manifest tracked it.
    writeFixture('src/routes/__root.tsx', 'export const Route = {}\n')
    const before = seeds.map((d) => readFileSync(resolve(dir, d), 'utf8'))
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-start': '*' } }),
    )
    const { log: warned } = capture(() => sync({}, dir))
    expect(warned).toContain(
      'dropped src/lib/nav.tsx, src/routes/__root.tsx, src/main.tsx from the manifest',
    )
    expect(warned).not.toMatch(/__root\.tsx.* mount a second router/)
    expect(warned).toMatch(/src\/main\.tsx mount a second router/)
    expect(warned).not.toContain('nav.tsx mount')
    expect(warned).toContain('<BasaltProvider><Outlet /></BasaltProvider>')
    const manifest = JSON.parse(readFileSync(resolve(dir, MANIFEST_PATH), 'utf8')) as {
      files: Record<string, string>
    }
    for (const d of seeds) expect(manifest.files[d]).toBeUndefined()
    expect(seeds.map((d) => readFileSync(resolve(dir, d), 'utf8'))).toEqual(before)
    // Never re-placed: a later sync is quiet about the manifest and leaves the files alone.
    expect(capture(() => sync({}, dir)).log).not.toContain('dropped')
  })

  it('sync --check counts a retired Start seed as stale until sync drops it', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-start': '*' } }),
    )
    const stale = capture(() => sync({ check: true }, dir))
    expect(stale.code).toBe(1)
    expect(stale.log).toContain('src/main.tsx')
    expect(stale.log).toContain('Fix: run `basalt-ui sync`')
    capture(() => sync({}, dir))
    expect(capture(() => sync({ check: true }, dir)).code).toBe(0)
  })

  it('warns about router= in an untracked Start file, not about a leftover nav.tsx', () => {
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-start': '*' } }),
    )
    capture(() => init(dir))
    writeFixture('src/main.tsx', '<BasaltProvider router={router} />\n')
    writeFixture('src/lib/nav.tsx', 'export const NAV = []\n')
    const { log } = capture(() => sync({}, dir))
    expect(log).toContain('src/main.tsx mount a second router')
    expect(log).not.toContain('nav.tsx mount')
  })

  it('sync --check prints the Start note only under --verbose', () => {
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-start': '*' } }),
    )
    capture(() => init(dir))
    expect(capture(() => sync({ check: true }, dir)).log).not.toContain('TanStack Start app')
    expect(capture(() => sync({ check: true, flags: ['--verbose'] }, dir)).log).toContain(
      'TanStack Start app',
    )
  })

  it('detects a Start app from devDependencies, and a tokens-only one seeds nothing either way', () => {
    writeFixture(
      'package.json',
      JSON.stringify({ name: 'fixture', devDependencies: { '@tanstack/react-start': '*' } }),
    )
    capture(() => init(dir))
    expect(existsSync(resolve(dir, 'src/main.tsx'))).toBe(false)
    rmSync(resolve(dir, MANIFEST_PATH), { force: true })

    writeFixture(
      'package.json',
      JSON.stringify({
        name: 'fixture',
        basalt: { profile: 'tokens-only' },
        dependencies: { '@tanstack/react-start': '*' },
      }),
    )
    const { log } = capture(() => init(dir))
    expect(log).not.toContain('TanStack Start app')
    expect(existsSync(resolve(dir, 'src/main.tsx'))).toBe(false)
  })

  it('rejects the retired peer flags', () => {
    expect(run(['init', '--with-router'], dir)).toBe(1)
    expect(run(['init', '--merge-lint'], dir)).toBe(1)
  })
})

describe('managed reviewer subagent and rule paths', () => {
  const AGENT = '.claude/agents/basalt-design-reviewer.md'
  const RULE = '.claude/rules/basalt-controls.md'
  const read = (rel: string): string => readFileSync(resolve(dir, rel), 'utf8')

  function install(basalt?: { roots: string[] }): void {
    writeFixture('package.json', JSON.stringify({ name: 'fixture', ...(basalt && { basalt }) }))
    capture(() => init(dir))
  }

  it('init installs the reviewer at the consumer root', () => {
    install()
    expect(read(AGENT)).toContain('name: basalt-design-reviewer')
  })

  it('sync --check passes clean, then reports drift when the agent is edited', () => {
    install()
    expect(capture(() => sync({ check: true }, dir)).code).toBe(0)
    writeFixture(AGENT, `${read(AGENT)}\nlocal edit\n`)
    expect(capture(() => sync({ check: true }, dir)).code).toBe(1)
  })

  it('sync restores a deleted agent', () => {
    install()
    rmSync(resolve(dir, AGENT))
    capture(() => sync({}, dir))
    expect(existsSync(resolve(dir, AGENT))).toBe(true)
  })

  it('sync retires an orphaned basalt-* agent', () => {
    install()
    const orphan = '.claude/agents/basalt-legacy.md'
    writeFixture(orphan, '---\nname: basalt-legacy\n---\n')
    const manifestAbs = resolve(dir, MANIFEST_PATH)
    const manifest = JSON.parse(readFileSync(manifestAbs, 'utf8')) as {
      files: Record<string, string>
    }
    manifest.files[orphan] = createHash('sha256')
      .update('---\nname: basalt-legacy\n---\n', 'utf8')
      .digest('hex')
    writeFixture(MANIFEST_PATH, JSON.stringify(manifest))
    capture(() => sync({}, dir))
    expect(existsSync(resolve(dir, orphan))).toBe(false)
  })

  const SHIPPED_RULES = readdirSync(resolve(import.meta.dir, '../../agent/rules')).filter((n) =>
    n.endsWith('.md'),
  )

  it('renders EVERY shipped rule from basalt.roots, normalised and YAML-safe', () => {
    install({ roots: ['./apps/web/src/', "a$&b'c", 'packages/ui/src'] })
    expect(SHIPPED_RULES.length).toBe(6)
    for (const name of SHIPPED_RULES) {
      const rule = read(`.claude/rules/${name}`)
      expect([name, rule]).toEqual([
        name,
        expect.stringContaining(
          "paths:\n  - 'apps/web/src/**'\n  - 'a$&b''c/**'\n  - 'packages/ui/src/**'\n---",
        ),
      ])
    }
  })

  it('renders the declared default root, and sync --check reports drift when roots change', () => {
    mkdirSync(resolve(dir, 'src'))
    install()
    expect(read(RULE)).toContain("paths:\n  - 'src/**'\n---")
    writeFixture('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['app'] } }))
    expect(capture(() => sync({ check: true }, dir)).code).toBe(1)
    capture(() => sync({}, dir))
    expect(read(RULE)).toContain("paths:\n  - 'app/**'\n---")
  })

  it('a root-installed monorepo with no roots renders the inferred workspace roots', () => {
    writeFixture('package.json', JSON.stringify({ name: 'mono', workspaces: ['apps/*'] }))
    writeFixture(
      'apps/web/package.json',
      JSON.stringify({ name: 'web', dependencies: { 'basalt-ui': '*' } }),
    )
    mkdirSync(resolve(dir, 'apps/web/src'), { recursive: true })
    capture(() => init(dir))
    expect(read(RULE)).toContain("paths:\n  - 'apps/web/src/**'\n---")
    expect(capture(() => sync({ check: true }, dir)).code).toBe(0)
  })

  it('init in a bare dir renders the src/ its own seeds create', () => {
    install()
    expect(read(RULE)).toContain("paths:\n  - 'src/**'\n---")
  })

  it('renderRulePaths keeps the old broad globs when given no roots', () => {
    expect(renderRulePaths("---\npaths:\n  - 'x'\n---\n", [])).toBe(
      "---\npaths:\n  - 'src/**'\n  - 'apps/**/src/**'\n  - 'packages/**/src/**'\n---\n",
    )
  })

  it('renderRulePaths leaves a rule without paths: unchanged and throws on a malformed block', () => {
    expect(renderRulePaths('---\nname: x\n---\n# body\n', ['src'])).toBe(
      '---\nname: x\n---\n# body\n',
    )
    expect(() => renderRulePaths('---\npaths: src/**\n---\n', ['src'])).toThrow('paths')
    expect(() => renderRulePaths('---\npaths:\n  - x\n---\n', ['a\nb'])).toThrow('line break')
  })

  it('touches the front matter only, never a column-0 paths: in the body', () => {
    const text = "---\npaths:\n  - 'x'\n---\n\npaths:\n  - 'keep'\n"
    expect(renderRulePaths(text, ['src'])).toBe(
      "---\npaths:\n  - 'src/**'\n---\n\npaths:\n  - 'keep'\n",
    )
    const noFront = "# body\npaths:\n  - 'keep'\n"
    expect(renderRulePaths(noFront, ['src'])).toBe(noFront)
  })

  it('rejects roots that would match everywhere', () => {
    const rule = "---\npaths:\n  - 'x'\n---\n"
    for (const bad of ['/', '', '/abs/src', './']) {
      expect(() => renderRulePaths(rule, [bad])).toThrow('relative directory')
    }
  })

  it('sync --check renders with the roots a real sync would write, so they never disagree', () => {
    writeFixture('package.json', JSON.stringify({ name: 'mono', workspaces: ['apps/*'] }))
    writeFixture(
      'apps/web/package.json',
      JSON.stringify({ name: 'web', dependencies: { 'basalt-ui': '*' } }),
    )
    mkdirSync(resolve(dir, 'apps/web/src'), { recursive: true })
    capture(() => init(dir))
    // Lose the declaration (an old repo that never wrote it): check must still agree with sync.
    writeFixture('package.json', JSON.stringify({ name: 'mono', workspaces: ['apps/*'] }))
    const checked = capture(() => sync({ check: true }, dir))
    expect(checked.code).toBe(0)
    capture(() => sync({}, dir))
    expect(read(RULE)).toContain("paths:\n  - 'apps/web/src/**'\n---")
  })

  it('normalises "." and "./" roots', () => {
    expect(renderRulePaths("---\npaths:\n  - 'x'\n---\n", ['.'])).toBe(
      "---\npaths:\n  - '**'\n---\n",
    )
    expect(renderRulePaths("---\npaths:\n  - 'x'\n---\n", ['./src//'])).toBe(
      "---\npaths:\n  - 'src/**'\n---\n",
    )
  })

  it('names the skills and the subagent in the AGENTS block', () => {
    install()
    const agents = read('AGENTS.md')
    expect(agents).toContain('/basalt-design')
    expect(agents).toContain('basalt-design-reviewer')
  })
})
