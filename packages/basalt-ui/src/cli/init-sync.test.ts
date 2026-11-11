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

import { doctor, init, MANIFEST_PATH, renderRulePaths, run } from './index.ts'

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
    expect(ci).toContain("- run: bunx oxlint --ignore-pattern '.claude/worktrees/**' .")
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
describe('init — a stock Vite app', () => {
  const STOCK = `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`
  const VITE_PKG = JSON.stringify({
    name: 'fixture',
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
  })
  const seed = (main: string): void => {
    writeFixture('package.json', VITE_PKG)
    writeFixture('index.html', '<script type="module" src="/src/main.tsx"></script>')
    writeFixture('src/main.tsx', main)
  }

  it('seeds the unmodified template main.tsx and adds the missing peers, without installing', () => {
    seed(STOCK)
    const { log } = capture(() => init(dir))
    const main = readFileSync(resolve(dir, 'src/main.tsx'), 'utf8')
    expect(main).toContain('createBasaltRouter')
    expect(main).toContain('<BasaltProvider router={router} />')
    const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    for (const peer of [
      '@mantine/core',
      '@mantine/hooks',
      '@tanstack/react-router',
      '@tanstack/react-query',
      '@fontsource-variable/nunito-sans',
    ]) {
      expect(pkg.dependencies[peer]).toBeDefined()
    }
    expect(pkg.dependencies['react']).toBe('^19.0.0')
    expect(existsSync(resolve(dir, 'node_modules'))).toBe(false)
    expect(log).toContain('seeded src/main.tsx')
    expect(log).toMatch(/bun install/)
  })

  const VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`

  it('wires the router plugin before react(), installs, and builds the route tree', () => {
    seed(STOCK)
    writeFixture('vite.config.ts', VITE_CONFIG)
    const calls: string[] = []
    const { log } = capture(() =>
      init(dir, {
        run: (argv) => {
          calls.push(argv.join(' '))
          if (argv.includes('build')) writeFixture('src/routeTree.gen.ts', '')
          return true
        },
      }),
    )
    const config = readFileSync(resolve(dir, 'vite.config.ts'), 'utf8')
    expect(config).toContain("import { tanstackRouter } from '@tanstack/router-plugin/vite'")
    expect(config).toMatch(/plugins: \[tanstackRouter\([^)]*\), react\(\)\]/)
    const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>
    }
    expect(pkg.devDependencies['@tanstack/router-plugin']).toBeDefined()
    expect(calls).toEqual(['bun install', 'bunx vite build'])
    expect(log).toContain('generated routeTree.gen.ts')
  })

  it('follows the lockfile, and names the one command when install fails', () => {
    seed(STOCK)
    writeFixture('vite.config.ts', VITE_CONFIG)
    writeFixture('pnpm-lock.yaml', '')
    const calls: string[] = []
    const { log } = capture(() =>
      init(dir, {
        run: (argv) => {
          calls.push(argv.join(' '))
          return false
        },
      }),
    )
    expect(calls).toEqual(['pnpm install'])
    expect(log).toContain('run `pnpm install` (init did not), then `pnpm exec vite build`')
  })

  it('a re-run after a failed install says what is left, until it is done', () => {
    seed(STOCK)
    writeFixture('vite.config.ts', VITE_CONFIG)
    capture(() => init(dir, { run: () => false }))
    const first = readFileSync(resolve(dir, 'vite.config.ts'), 'utf8')
    const { log } = capture(() => init(dir))
    expect(log).toContain('run `bun install` (init did not), then `bunx vite build`')
    expect(readFileSync(resolve(dir, 'vite.config.ts'), 'utf8')).toBe(first)
    const calls: string[] = []
    const done = capture(() =>
      init(dir, {
        run: (argv) => {
          calls.push(argv.join(' '))
          if (argv.includes('install')) {
            const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as Record<
              string,
              Record<string, string>
            >
            for (const name of Object.keys({ ...pkg['dependencies'], ...pkg['devDependencies'] }))
              writeFixture(`node_modules/${name}/package.json`, '{}')
          }
          if (argv.includes('build')) writeFixture('src/routeTree.gen.ts', '')
          return true
        },
      }),
    )
    expect(calls).toEqual(['bun install', 'bunx vite build'])
    expect(done.log).toContain('generated routeTree.gen.ts')
    expect(capture(() => init(dir)).log).not.toContain('init did not')
  })

  it('never spawns without an injected runner', () => {
    seed(STOCK)
    writeFixture('vite.config.ts', VITE_CONFIG)
    const { log } = capture(() => init(dir))
    expect(log).toContain('(init did not)')
    expect(existsSync(resolve(dir, 'node_modules'))).toBe(false)
  })

  it('a commented-out router-plugin import does not count as wired', () => {
    seed(STOCK)
    writeFixture(
      'vite.config.ts',
      `// import { tanstackRouter } from '@tanstack/router-plugin/vite'\n${VITE_CONFIG}`,
    )
    capture(() => init(dir))
    expect(readFileSync(resolve(dir, 'vite.config.ts'), 'utf8')).toMatch(
      /plugins: \[tanstackRouter\(/,
    )
  })

  it('keeps an existing @tanstack/router-plugin pin', () => {
    writeFixture(
      'package.json',
      JSON.stringify({
        name: 'fixture',
        dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
        devDependencies: { '@tanstack/router-plugin': '1.167.0' },
      }),
    )
    writeFixture('index.html', '<script type="module" src="/src/main.tsx"></script>')
    writeFixture('src/main.tsx', STOCK)
    writeFixture('vite.config.ts', VITE_CONFIG)
    capture(() => init(dir))
    const dev = (
      JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as {
        devDependencies: Record<string, string>
      }
    ).devDependencies
    expect(dev['@tanstack/router-plugin']).toBe('1.167.0')
  })

  it('pins a new @tanstack/router-plugin to a caret range, never latest', () => {
    seed(STOCK)
    writeFixture('vite.config.ts', VITE_CONFIG)
    capture(() => init(dir))
    const fresh = (
      JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as {
        devDependencies: Record<string, string>
      }
    ).devDependencies
    expect(fresh['@tanstack/router-plugin']).toMatch(/^\^1\.\d+\.\d+$/)
  })

  it('leaves a vite.config with two plugins arrays alone', () => {
    seed(STOCK)
    const two = `export default { plugins: [react()], test: { plugins: [react()] } }\n`
    writeFixture('vite.config.ts', two)
    capture(() => init(dir))
    expect(readFileSync(resolve(dir, 'vite.config.ts'), 'utf8')).toBe(two)
  })

  it('--no-install writes the files, spawns nothing and prints the commands', () => {
    seed(STOCK)
    writeFixture('vite.config.ts', VITE_CONFIG)
    const { code, log } = capture(() => run(['init', '--no-install'], dir) as number)
    expect(code).toBe(0)
    expect(log).toContain('run `bun install` (init did not), then `bunx vite build`')
    expect(readFileSync(resolve(dir, 'vite.config.ts'), 'utf8')).toMatch(/tanstackRouter\(/)
    expect(existsSync(resolve(dir, 'node_modules'))).toBe(false)
  })

  it('reuses an existing tanstackRouter import that is not registered', () => {
    seed(STOCK)
    writeFixture(
      'vite.config.ts',
      `import { tanstackRouter } from '@tanstack/router-plugin/vite'\n${VITE_CONFIG}`,
    )
    capture(() => init(dir))
    const config = readFileSync(resolve(dir, 'vite.config.ts'), 'utf8')
    expect(config.match(/import \{ tanstackRouter \}/g)).toHaveLength(1)
    expect(config).toMatch(/plugins: \[tanstackRouter\(/)
  })

  it('an init killed after the vite step still finishes on the re-run', () => {
    seed(STOCK)
    writeFixture('vite.config.ts', VITE_CONFIG)
    // The state a kill between the vite write and main.tsx leaves: package.json and config done, main.tsx still the template.
    capture(() => init(dir, { run: () => false }))
    writeFixture('src/main.tsx', STOCK)
    const { log } = capture(() => init(dir))
    expect(readFileSync(resolve(dir, 'src/main.tsx'), 'utf8')).toContain('createBasaltRouter')
    expect(log).toContain('run `bun install` (init did not)')
  })

  it('a kill after package.json but before the vite config re-wires the config', () => {
    seed(STOCK)
    writeFixture('vite.config.ts', VITE_CONFIG)
    const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as Record<
      string,
      unknown
    >
    writeFixture(
      'package.json',
      JSON.stringify({ ...pkg, devDependencies: { '@tanstack/router-plugin': '^1.168.40' } }),
    )
    capture(() => init(dir))
    expect(readFileSync(resolve(dir, 'vite.config.ts'), 'utf8')).toMatch(
      /plugins: \[tanstackRouter\(/,
    )
    expect(readFileSync(resolve(dir, 'src/main.tsx'), 'utf8')).toContain('createBasaltRouter')
  })

  it('finds the lockfile of a pnpm workspace root above the app', () => {
    writeFixture('pnpm-lock.yaml', '')
    writeFixture('pnpm-workspace.yaml', 'packages:\n  - apps/*\n')
    writeFixture('apps/web/package.json', VITE_PKG)
    writeFixture('apps/web/index.html', '<script type="module" src="/src/main.tsx"></script>')
    writeFixture('apps/web/src/main.tsx', STOCK)
    writeFixture('apps/web/vite.config.ts', VITE_CONFIG)
    const calls: string[] = []
    capture(() =>
      init(resolve(dir, 'apps/web'), {
        run: (argv) => {
          calls.push(argv.join(' '))
          return false
        },
      }),
    )
    expect(calls).toEqual(['pnpm install'])
  })

  it('leaves a vite.config of another shape alone and prints the router plugin fix', () => {
    seed(STOCK)
    const custom = `export default { plugins: [somethingElse()] }\n`
    writeFixture('vite.config.ts', custom)
    const { log } = capture(() => init(dir))
    expect(readFileSync(resolve(dir, 'vite.config.ts'), 'utf8')).toBe(custom)
    expect(log).toContain('router plugin:')
  })

  it('tolerates formatting and the older template without the css import', () => {
    seed(
      STOCK.replace("import './index.css'\n", '').replace(/'/g, '"').replace('./App.tsx', './App'),
    )
    capture(() => init(dir))
    expect(readFileSync(resolve(dir, 'src/main.tsx'), 'utf8')).toContain('createBasaltRouter')
  })

  it('prints no peer or router advice for a main.tsx that already imports basalt-ui', () => {
    seed(`import { BasaltProvider } from 'basalt-ui'\n`)
    const { log } = capture(() => init(dir))
    expect(log).not.toContain('missing peers')
    expect(log).not.toContain('router plugin')
  })

  it('does not take a changed string literal for the stock file', () => {
    const changed = STOCK.replace("'react-dom/client'", "'react-dom/ client'")
    seed(changed)
    capture(() => init(dir))
    expect(readFileSync(resolve(dir, 'src/main.tsx'), 'utf8')).toBe(changed)
  })

  it('never overwrites an edited main.tsx: leaves it and prints the exact wiring steps', () => {
    const edited = `${STOCK}\nconsole.log('mine')\n`
    seed(edited)
    const { log } = capture(() => init(dir))
    expect(readFileSync(resolve(dir, 'src/main.tsx'), 'utf8')).toBe(edited)
    expect(log).toContain("import 'basalt-ui/styles.css'")
    expect(log).toContain('createBasaltRouter')
    expect(log).not.toContain('seeded src/main.tsx')
    const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies['@mantine/core']).toBeUndefined()
  })
})

describe('sync — retired rules and skills', () => {
  const RETIRED_RULE = '.claude/rules/basalt-router.md'

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

  it('seeds all three router files with no flags and no TanStack deps declared', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    const { log } = capture(() => init(dir))
    for (const dest of ['src/lib/nav.tsx', 'src/routes/__root.tsx', 'src/main.tsx']) {
      expect(existsSync(resolve(dir, dest))).toBe(true)
    }
    expect(log).not.toContain('skipped src/lib/nav.tsx')
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

  it('without the key (default) both seeds are placed', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    capture(() => init(dir))
    for (const dest of PAIR) expect(existsSync(resolve(dir, dest))).toBe(true)
  })

  it.each(['no', 0, null])('a non-boolean shell (%p) is a config error on init', (bad) => {
    declareShell(bad)
    const out = capture(() => init(dir))
    expect(out.code).toBe(1)
    expect(out.log).toContain('basalt.shell must be a boolean')
  })

  it('init and doctor classify the same lazy-router fixture identically', () => {
    writeFixture('package.json', JSON.stringify({ name: 'fixture' }))
    writeFixture('index.html', '<script type="module" src="/src/main.tsx"></script>')
    writeFixture(
      'src/main.tsx',
      "import { BasaltProvider } from 'basalt-ui'\nconst Router = lazy(() => import('./router'))\n<BasaltProvider />\n",
    )
    writeFixture('src/router.ts', 'export const router = createBasaltRouter({ routeTree })\n')
    expect(capture(() => init(dir)).log).toContain('code-routed app')
    expect(existsSync(resolve(dir, 'src/routes/__root.tsx'))).toBe(false)
    expect(capture(() => doctor(dir)).log).toContain('✓ app-wiring')
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
