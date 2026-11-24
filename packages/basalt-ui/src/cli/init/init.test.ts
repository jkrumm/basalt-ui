/**
 * `init --profile` on the v3 manifest: one temp repo per case, the package manager injected, no
 * network. The commands under test are the `run()` dispatch and `init()`; nothing is installed.
 */
import { afterEach, describe, expect, it } from 'bun:test'
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
import { basename, dirname, join, resolve } from 'node:path'
import stylelint from 'stylelint'

import { readBudget, seedBudget } from '../budget'
import { packageRoot, run } from '../index'
import { sync } from '../sync'
import { parseManifest } from '../manifest'
import type { Manifest, Profile } from '../manifest'
import { COMMAND_OPTIONS } from '../help'
import { SESSION_NOTE } from '../agent-note'
import { FLAGS, init } from './index'
import { peerPlan } from './steps'
import type { InitDeps } from './index'

const repos: string[] = []
afterEach(() => {
  for (const dir of repos.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function put(dir: string, path: string, content: string): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), content)
}

const read = (dir: string, path: string): string => readFileSync(join(dir, path), 'utf8')

/** A repo (`.git` marks the root) with a package.json and, optionally, more files. */
function repo(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'basalt-init-'))
  repos.push(dir)
  mkdirSync(join(dir, '.git'))
  put(dir, 'package.json', JSON.stringify({ name: 'fixture', devDependencies: {} }))
  put(dir, 'bun.lock', '')
  for (const [path, content] of Object.entries(files)) put(dir, path, content)
  return dir
}

/** Every file under `dir` with its bytes, `.git` left out. */
function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {}
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const path = join(entry.parentPath, entry.name).slice(dir.length + 1)
    if (!path.startsWith('.git/')) files[path] = readFileSync(join(dir, path), 'utf8')
  }
  return files
}

type Outcome = { code: number; log: string; commands: string[][] }

/** Runs `init` with console captured, a recording package manager and a stub for the closing doctor. */
async function runInit(argv: string[], cwd: string, deps: InitDeps = {}): Promise<Outcome> {
  const saved = { log: console.log, error: console.error }
  const commands: string[][] = []
  let log = ''
  const sink = (...args: unknown[]): void => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    const code = await init(argv, cwd, {
      run: (command) => (commands.push(command), true),
      doctor: async () => 0,
      ...deps,
    })
    return { code, log, commands }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

const manifestOf = (dir: string): Manifest => {
  const parsed = parseManifest(read(dir, '.basalt/manifest.json'))
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed.manifest
}

const PROFILES: Profile[] = ['tokens', 'site', 'bridge', 'parts', 'app']

describe('init: the declaration', () => {
  it('exits 1 without --profile or with an unknown one, and writes nothing', async () => {
    const dir = repo()
    const before = snapshot(dir)
    for (const argv of [[], ['--no-install'], ['--profile', 'bogus']]) {
      const { code, log } = await runInit(argv, dir)
      expect(code).toBe(1)
      expect(log).toContain('--profile')
    }
    expect(snapshot(dir)).toEqual(before)
  })

  it('exits 1 on an unknown flag through the CLI dispatch, and for a bogus profile', async () => {
    const dir = repo()
    const saved = { log: console.log, error: console.error }
    console.log = console.error = () => {}
    try {
      expect(await run(['init', '--profile', 'bogus'], dir)).toBe(1)
      expect(await run(['init', '--profile', 'tokens', '--nope'], dir)).toBe(1)
      expect(await run(['init', '--no-merge-lint'], dir)).toBe(1)
    } finally {
      console.log = saved.log
      console.error = saved.error
    }
  })

  it('declares every --root with the profile', async () => {
    const dir = repo()
    const { code } = await runInit(
      ['--profile', 'bridge', '--root', 'apps/web/src', '--root', 'apps/admin/src'],
      dir,
    )
    expect(code).toBe(0)
    expect(manifestOf(dir).roots).toEqual({
      'apps/admin/src': 'bridge',
      'apps/web/src': 'bridge',
    })
    expect(manifestOf(dir).profile).toBe('bridge')
  })

  it('declares . when no --root is given', async () => {
    const dir = repo()
    await runInit(['--profile', 'tokens'], dir)
    expect(manifestOf(dir).roots).toEqual({ '.': 'tokens' })
  })

  it('refuses a path outside the repo', async () => {
    const dir = repo()
    for (const flag of [
      ['--root', '../x'],
      ['--tokens-out', '/tmp/t.css'],
    ]) {
      const { code, log } = await runInit(['--profile', 'tokens', ...flag], dir)
      expect(code).toBe(1)
      expect(log).toContain('relative to the repo root')
    }
  })

  it('seeds an --extra file that does not exist, and never over one that does', async () => {
    const dir = repo()
    const { code } = await runInit(
      ['--profile', 'tokens', '--tokens-out', 'src/tokens.css', '--extra', 'src/basalt.tokens.ts'],
      dir,
    )
    expect(code).toBe(0)
    expect(read(dir, 'src/basalt.tokens.ts')).toContain('export default')
    expect(existsSync(join(dir, 'src/basalt.tokens.css'))).toBe(true)
    const own = 'export default { series: { app: { a: { light: "#111111", dark: "#eeeeee" } } } }\n'
    put(dir, 'src/basalt.tokens.ts', own)
    await runInit(
      ['--profile', 'tokens', '--tokens-out', 'src/tokens.css', '--extra', 'src/basalt.tokens.ts'],
      dir,
    )
    expect(read(dir, 'src/basalt.tokens.ts')).toBe(own)
    expect(read(dir, 'src/basalt.tokens.css')).toContain('--basalt-app-a: #111111;')
  })

  it('imports the series sheet on a re-run over an entry that is already wired', async () => {
    const dir = repo({
      'vite.config.ts':
        "import react from '@vitejs/plugin-react'\nexport default { plugins: [react()] }\n",
      'src/index.css':
        "@import 'basalt-ui/tailwind.css';\n@import './tokens.css';\n@import '../.basalt/sources.css';\n",
    })
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    const wired =
      "@import 'basalt-ui/tailwind.css';\n@import './tokens.css';\n@import './basalt.tokens.css';\n@import '../.basalt/sources.css';\n"
    expect(read(dir, 'src/index.css')).toBe(wired)
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(read(dir, 'src/index.css')).toBe(wired)
  })

  it('keeps the series file the manifest records when --extra is not passed again', async () => {
    const dir = repo({ 'src/series.tokens.ts': 'export default { series: {} }\n' })
    await runInit(['--profile', 'app', '--root', 'src', '--extra', 'src/series.tokens.ts'], dir)
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    const { extra, tokens } = manifestOf(dir)
    expect(extra).toBe('src/series.tokens.ts')
    expect(tokens.filter((t) => t.flags.includes('--extra'))).toHaveLength(1)
    expect(existsSync(join(dir, 'src/basalt.tokens.ts'))).toBe(false)
  })

  it('gives an app profile the series file by default, a tokens one only by --extra', async () => {
    const app = repo()
    await runInit(['--profile', 'app', '--root', 'src'], app)
    expect(manifestOf(app).extra).toBe('src/basalt.tokens.ts')
    expect(existsSync(join(app, 'src/basalt.tokens.ts'))).toBe(true)
    const tokens = repo()
    await runInit(['--profile', 'tokens'], tokens)
    expect(manifestOf(tokens).extra).toBeUndefined()
    expect(existsSync(join(tokens, 'src/basalt.tokens.ts'))).toBe(false)
  })
})

describe('init: a tokens fixture', () => {
  const args = ['--profile', 'tokens', '--tokens-out', 'src/tokens.css', '--accent', '#0f8a7e']

  it('writes the manifest tokens[], the output and the stylelint preset, and no oxlint preset', async () => {
    const dir = repo({ 'src/page.astro': '<div>x</div>\n' })
    const { code } = await runInit(args, dir)
    expect(code).toBe(0)
    expect(manifestOf(dir).tokens).toEqual([
      { out: 'src/tokens.css', format: 'css', flags: ['--accent', '#0f8a7e'] },
    ])
    expect(read(dir, 'src/tokens.css').split('\n')[0]).toContain('@generated')
    expect(existsSync(join(dir, '.stylelintrc.basalt.json'))).toBe(true)
    expect(existsSync(join(dir, '.oxlintrc.basalt.json'))).toBe(false)
    expect(existsSync(join(dir, '.oxlintrc.json'))).toBe(false)
    expect(existsSync(join(dir, '.claude'))).toBe(false)
    expect(existsSync(join(dir, 'DESIGN.md'))).toBe(false)
  })

  it('stylelint with that config flags a seeded .astro offender and ignores the tokens file', async () => {
    const dir = repo({
      'src/offender.astro': '---\n---\n<div>x</div>\n<style>\n  .a { color: #ff0000; }\n</style>\n',
    })
    await runInit(args, dir)
    const { results } = await stylelint.lint({
      files: [join(dir, 'src/**/*.{css,astro}')],
      configFile: join(dir, '.stylelintrc.basalt.json'),
      cwd: dir,
      allowEmptyInput: false,
    })
    const bySource = new Map(results.map((r) => [r.source?.slice(dir.length + 1), r]))
    expect(bySource.get('src/offender.astro')?.warnings.map((w) => w.rule)).toContain(
      'color-no-hex',
    )
    const tokens = bySource.get('src/tokens.css')
    expect(tokens === undefined || tokens.ignored === true).toBe(true)
    expect(tokens?.warnings ?? []).toEqual([])
  })

  it('declares a json row without --selector and an extra row beside the sheet', async () => {
    const dir = repo({ 'src/basalt.tokens.ts': 'export default { series: {}, vars: {} }\n' })
    const { code } = await runInit(
      [...args, '--tokens-json-out', 'src/tokens.json', '--extra', 'src/basalt.tokens.ts'],
      dir,
    )
    expect(code).toBe(0)
    const { tokens, extra } = manifestOf(dir)
    expect(extra).toBe('src/basalt.tokens.ts')
    expect(tokens.map((t) => [t.out, t.format])).toEqual([
      ['src/tokens.css', 'css'],
      ['src/tokens.json', 'json'],
      ['src/basalt.tokens.css', 'css'],
    ])
    expect(tokens[1]?.flags).toEqual(['--accent', '#0f8a7e', '--format', 'json'])
    expect(tokens[2]?.flags).toEqual(['--extra', 'src/basalt.tokens.ts'])
    expect(existsSync(join(dir, 'src/basalt.tokens.css'))).toBe(true)
  })
})

describe('init: presets by profile', () => {
  it('a bridge fixture gets both presets, an extending .oxlintrc.json and the agent layer', async () => {
    const dir = repo({ 'src/main.tsx': 'export {}\n' })
    expect((await runInit(['--profile', 'bridge', '--root', 'src'], dir)).code).toBe(0)
    const oxlint = JSON.parse(read(dir, '.oxlintrc.basalt.json')) as { jsPlugins: string[] }
    expect(oxlint.jsPlugins).toContain('basalt-ui/lint')
    expect(existsSync(join(dir, '.stylelintrc.basalt.json'))).toBe(true)
    expect(JSON.parse(read(dir, '.oxlintrc.json'))).toEqual({
      extends: ['./.oxlintrc.basalt.json'],
    })
    expect(existsSync(join(dir, '.claude/rules'))).toBe(true)
    expect(read(dir, 'AGENTS.md')).toContain('basalt:begin')
  })

  it('a tokens fixture gets no oxlint preset', async () => {
    const dir = repo()
    await runInit(['--profile', 'tokens'], dir)
    expect(existsSync(join(dir, '.oxlintrc.basalt.json'))).toBe(false)
    expect(existsSync(join(dir, '.stylelintrc.basalt.json'))).toBe(true)
  })

  it('each oxlint profile gets its own shipped preset (page-root runs at app only)', async () => {
    const presets = new Set<string>()
    for (const profile of PROFILES.filter((p) => p !== 'tokens')) {
      const dir = repo()
      await runInit(['--profile', profile, '--root', 'src'], dir)
      presets.add(read(dir, '.oxlintrc.basalt.json'))
    }
    expect(presets.size).toBe(4)
  })

  it("drops create-vite's stock only-export-components rule and keeps the rest", async () => {
    const stock = {
      rules: {
        'react/only-export-components': ['warn', { allowConstantExport: true }],
        'no-console': 'warn',
      },
    }
    const dir = repo({ '.oxlintrc.json': JSON.stringify(stock) })
    await runInit(['--profile', 'bridge', '--root', 'src'], dir)
    expect(JSON.parse(read(dir, '.oxlintrc.json'))).toEqual({
      rules: { 'no-console': 'warn' },
      extends: ['./.oxlintrc.basalt.json'],
    })
  })

  it('prints the line to delete when the only-export-components rule has another shape', async () => {
    const custom = {
      rules: { 'react/only-export-components': ['error', { allowExportNames: ['x'] }] },
    }
    const dir = repo({ '.oxlintrc.json': JSON.stringify(custom) })
    const { log } = await runInit(['--profile', 'bridge', '--root', 'src'], dir)
    expect(JSON.parse(read(dir, '.oxlintrc.json')).rules).toEqual(custom.rules)
    expect(log).toContain('delete react/only-export-components')
  })

  it('extends a commented .oxlintrc.json by printing the line, never rewriting it', async () => {
    const dir = repo({ '.oxlintrc.json': '{\n  // mine\n  "rules": {}\n}\n' })
    const { log } = await runInit(['--profile', 'bridge', '--root', 'src'], dir)
    expect(read(dir, '.oxlintrc.json')).toBe('{\n  // mine\n  "rules": {}\n}\n')
    expect(log).toContain('"./.oxlintrc.basalt.json" to "extends"')
  })
})

describe('init: the budget, the install and the seeds', () => {
  it('seeds .basalt/budget.json with seedBudget(profile) and it reads back', async () => {
    for (const profile of PROFILES) {
      const dir = repo()
      await runInit(['--profile', profile], dir)
      const read = readBudget(dir)
      expect('budget' in read && read.budget).toEqual(seedBudget(profile))
    }
  })

  it('never overwrites an existing budget', async () => {
    const dir = repo({
      '.basalt/budget.json': JSON.stringify({ ...seedBudget('app'), ejects: 7 }),
    })
    await runInit(['--profile', 'app'], dir)
    const read = readBudget(dir)
    expect('budget' in read && read.budget.ejects).toBe(7)
  })

  it('installs the tokens peers at their declared range, saved exact, with the lockfile’s package manager, never bunx', async () => {
    const dir = repo()
    const { commands } = await runInit(['--profile', 'tokens'], dir)
    expect(commands).toHaveLength(1)
    const [command] = commands
    expect(command?.slice(0, 4)).toEqual(['bun', 'add', '--dev', '--exact'])
    expect(command?.slice(4).map((spec) => spec.replace(/@[\^~]?\d.*$/, ''))).toEqual([
      'stylelint',
      'postcss-html',
      'oxfmt',
    ])
    expect(command?.slice(4).every((spec) => /@[\^~]?\d+\.\d+\.\d+$/.test(spec))).toBe(true)
  })

  it('bridge adds the frame peers, oxlint and @shadcn/lint; pnpm and npm lockfiles pick their own command', async () => {
    const dir = repo()
    const { commands } = await runInit(['--profile', 'bridge', '--root', 'src'], dir)
    const names = (command: string[] | undefined): string[] =>
      (command ?? [])
        .filter((arg, i) => i > 1 && !arg.startsWith('-'))
        .map((s) => s.replace(/@[\d~^].*$/, ''))
    expect(commands[0]?.slice(0, 3)).toEqual(['bun', 'add', '--exact'])
    expect(names(commands[0])).toEqual(['tailwindcss', '@base-ui/react'])
    expect(commands[1]?.slice(0, 4)).toEqual(['bun', 'add', '--dev', '--exact'])
    expect(names(commands[1])).toEqual([
      'stylelint',
      'postcss-html',
      'oxlint',
      '@shadcn/lint',
      'oxfmt',
      '@tailwindcss/vite',
    ])

    const pnpm = repo({ 'pnpm-lock.yaml': '' })
    rmSync(join(pnpm, 'bun.lock'))
    expect((await runInit(['--profile', 'tokens'], pnpm)).commands[0]?.[0]).toBe('pnpm')
    const npm = repo()
    rmSync(join(npm, 'bun.lock'))
    expect((await runInit(['--profile', 'tokens'], npm)).commands[0]?.slice(0, 2)).toEqual([
      'npm',
      'install',
    ])
  })

  it('skips the install when the peers already sit at their pins', async () => {
    const dir = repo()
    const first = await runInit(['--profile', 'app', '--root', 'src'], dir)
    const pins = Object.fromEntries(
      first.commands.flatMap((command) =>
        command
          .filter((arg) => !arg.startsWith('-') && arg.lastIndexOf('@') > 0)
          .map((spec) => {
            const at = spec.lastIndexOf('@')
            return [spec.slice(0, at), spec.slice(at + 1)]
          }),
      ),
    )
    put(dir, 'package.json', JSON.stringify({ name: 'fixture', devDependencies: pins }))
    expect((await runInit(['--profile', 'app', '--root', 'src'], dir)).commands).toEqual([])
  })

  it('leaves a newer in-range version of a peer alone on a second init', async () => {
    const dir = repo()
    put(
      dir,
      'package.json',
      JSON.stringify({ name: 'fixture', dependencies: { '@tanstack/react-query': '5.199.0' } }),
    )
    const { commands } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(commands.flat().join(' ')).not.toContain('@tanstack/react-query')
  })

  it('keeps a newer in-range @tanstack/router-plugin and pins it only where it is older or absent', async () => {
    const withPlugin = (spec: string): string => {
      const dir = repo()
      put(
        dir,
        'package.json',
        JSON.stringify({ name: 'fixture', devDependencies: { '@tanstack/router-plugin': spec } }),
      )
      return dir
    }
    const newer = await runInit(['--profile', 'app', '--root', 'src'], withPlugin('^1.169.0'))
    expect(newer.commands.flat().join(' ')).not.toContain('@tanstack/router-plugin')
    expect(newer.commands.flat().some((arg) => arg.startsWith('@tailwindcss/vite@'))).toBe(true)

    const older = await runInit(['--profile', 'app', '--root', 'src'], withPlugin('1.100.0'))
    expect(older.commands.flat().join(' ')).toContain('@tanstack/router-plugin@1.168.40')
  })

  it('prints one line for a dependency the app already had whose version it changes, and none for a kept one', async () => {
    const dir = repo()
    put(
      dir,
      'package.json',
      JSON.stringify({
        name: 'fixture',
        devDependencies: { oxlint: '^1.90.0', '@tanstack/router-plugin': '^1.169.0' },
      }),
    )
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    const changed = log
      .split('\n')
      .filter((line) => line.includes('is outside what basalt-ui supports'))
    expect(changed).toHaveLength(1)
    expect(changed[0]).toMatch(/^peers: oxlint \^1\.90\.0 is outside .*installing \d+\.\d+\.\d+$/)
  })

  it('reinstalls a ranged peer declared outside its range and keeps one inside it', async () => {
    const dir = repo()
    put(
      dir,
      'package.json',
      JSON.stringify({
        name: 'fixture',
        devDependencies: { tailwindcss: '^3.4.17', '@tailwindcss/vite': '^4.3.9' },
      }),
    )
    const { commands, log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    const args = commands.flat()
    expect(args.some((arg) => arg.startsWith('tailwindcss@'))).toBe(true)
    expect(args.some((arg) => arg.startsWith('@tailwindcss/vite@'))).toBe(false)
    expect(log).toContain('peers: tailwindcss ^3.4.17 is outside what basalt-ui supports')
  })

  it('installs every peer the app profile needs, and no oxfmt for a Prettier repo', async () => {
    const { commands } = await runInit(['--profile', 'app', '--root', 'src'], repo())
    const all = commands.flat().map((s) => s.replace(/@[\d~^].*$/, ''))
    for (const name of [
      'tailwindcss',
      '@tailwindcss/vite',
      '@base-ui/react',
      '@tanstack/react-query',
      '@tanstack/react-router',
      '@tanstack/router-plugin',
      'lucide-react',
      'oxlint',
      'oxfmt',
    ]) {
      expect(all).toContain(name)
    }
    const prettier = repo({ '.prettierignore': 'dist\n' })
    const kept = await runInit(['--profile', 'app', '--root', 'src'], prettier)
    expect(kept.commands.flat().join(' ')).not.toContain('oxfmt')
  })

  it('installs lucide-react for the app profile only, and keeps the version an app declares', async () => {
    const { commands } = await runInit(['--profile', 'app', '--root', 'src'], repo())
    expect(commands.flat()).toContain('lucide-react@^1.74.0')
    expect(peerPlan(packageRoot(), 'app', false).runtime).toHaveProperty('lucide-react', '^1.74.0')
    for (const profile of PROFILES.filter((p) => p !== 'app')) {
      expect(peerPlan(packageRoot(), profile, false).runtime, profile).not.toHaveProperty(
        'lucide-react',
      )
    }
    const declared = repo()
    put(
      declared,
      'package.json',
      JSON.stringify({ name: 'fixture', dependencies: { 'lucide-react': '^0.460.0' } }),
    )
    const kept = await runInit(['--profile', 'app', '--root', 'src'], declared)
    expect(kept.commands.flat().join(' ')).not.toContain('lucide-react')
  })

  it('--no-install runs no command and prints it', async () => {
    const dir = repo()
    const { code, commands, log } = await runInit(['--profile', 'tokens', '--no-install'], dir)
    expect(code).toBe(0)
    expect(commands).toEqual([])
    expect(log).toContain('bun add --dev --exact stylelint@')
    expect(log).toContain('doctor not run')
  })

  it('exits 1 and names the command when the install fails, but still places the files', async () => {
    const dir = repo()
    const { code, log } = await runInit(['--profile', 'tokens'], dir, { run: () => false })
    expect(code).toBe(1)
    expect(log).toContain('the peer install failed: bun add')
    expect(existsSync(join(dir, '.stylelintrc.basalt.json'))).toBe(true)
  })

  it('seeds DESIGN.md above tokens, only when no declared root has one', async () => {
    const plain = repo()
    await runInit(['--profile', 'app', '--root', 'src'], plain)
    expect(read(plain, 'DESIGN.md')).toContain('fixture')
    expect(read(plain, 'DESIGN.md')).toContain('src/basalt.tokens.ts')

    const owned = repo({ 'apps/web/DESIGN.md': '# mine\n' })
    await runInit(['--profile', 'app', '--root', 'apps/web/src'], owned)
    expect(existsSync(join(owned, 'DESIGN.md'))).toBe(false)
  })

  it('writes the formatter ignore, merging into an existing .oxfmtrc.json', async () => {
    const dir = repo({
      '.oxfmtrc.json': JSON.stringify({ semi: false, ignorePatterns: ['dist/**'] }),
    })
    await runInit(['--profile', 'bridge', '--root', 'src'], dir)
    const config = JSON.parse(read(dir, '.oxfmtrc.json')) as {
      semi: boolean
      ignorePatterns: string[]
    }
    expect(config.semi).toBe(false)
    expect(config.ignorePatterns).toEqual([
      'dist/**',
      '.basalt/**',
      '.claude/**',
      '.oxlintrc.basalt.json',
      '.stylelintrc.basalt.json',
    ])
  })

  it("an app ignores the router's generated tree for the linter and the formatter", async () => {
    const dir = repo({ '.oxlintrc.json': JSON.stringify({ extends: ['./.oxlintrc.basalt.json'] }) })
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    const lint = JSON.parse(read(dir, '.oxlintrc.json')) as { ignorePatterns: string[] }
    const fmt = JSON.parse(read(dir, '.oxfmtrc.json')) as { ignorePatterns: string[] }
    expect(lint.ignorePatterns).toEqual(['src/routeTree.gen.ts'])
    expect(fmt.ignorePatterns).toContain('src/routeTree.gen.ts')
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect((JSON.parse(read(dir, '.oxlintrc.json')) as typeof lint).ignorePatterns).toEqual([
      'src/routeTree.gen.ts',
    ])
  })

  it('appends to a .prettierignore for a prettier repo', async () => {
    const dir = repo({ '.prettierignore': 'dist' })
    await runInit(['--profile', 'tokens'], dir)
    expect(read(dir, '.prettierignore')).toBe(
      'dist\n.basalt/**\n.claude/**\n.oxlintrc.basalt.json\n.stylelintrc.basalt.json\n',
    )
    expect(existsSync(join(dir, '.oxfmtrc.json'))).toBe(false)
  })

  it('patches a stock vite.config and Tailwind entry, and prints the lines for any other shape', async () => {
    const stock = repo({
      'vite.config.ts':
        "import react from '@vitejs/plugin-react'\n\nexport default { plugins: [react()] }\n",
      'src/index.css': "@import 'tailwindcss';\n",
    })
    await runInit(['--profile', 'app', '--root', 'src'], stock)
    expect(read(stock, 'vite.config.ts')).toContain("import { basalt } from 'basalt-ui/vite'")
    expect(read(stock, 'vite.config.ts')).toContain(
      "plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), basalt()]",
    )
    expect(read(stock, 'vite.config.ts')).toContain("import tailwindcss from '@tailwindcss/vite'")
    expect(read(stock, 'vite.config.ts')).toContain(
      "import { tanstackRouter } from '@tanstack/router-plugin/vite'",
    )
    expect(read(stock, 'src/index.css')).toBe(
      "@import 'basalt-ui/tailwind.css';\n@import './tokens.css';\n@import './basalt.tokens.css';\n@import '../.basalt/sources.css';\n",
    )

    const odd = repo({ 'vite.config.ts': 'export default defineConfig(() => ({}))\n' })
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], odd)
    expect(read(odd, 'vite.config.ts')).toBe('export default defineConfig(() => ({}))\n')
    expect(log).toContain('to do: import { basalt }')
    expect(log).toContain("@import 'basalt-ui/tailwind.css'")
  })

  it('ignores .basalt/sources.css beside the Vite config, once', async () => {
    const vite = {
      'vite.config.ts':
        "import react from '@vitejs/plugin-react'\nexport default { plugins: [react()] }\n",
    }
    const fresh = repo(vite)
    await runInit(['--profile', 'app', '--root', 'src'], fresh)
    expect(read(fresh, '.gitignore')).toBe('.basalt/sources.css\nshots-*/\n')
    await runInit(['--profile', 'app', '--root', 'src'], fresh)
    expect(read(fresh, '.gitignore')).toBe('.basalt/sources.css\nshots-*/\n')

    const existing = repo({ ...vite, '.gitignore': 'node_modules\ndist' })
    await runInit(['--profile', 'app', '--root', 'src'], existing)
    expect(read(existing, '.gitignore')).toBe('node_modules\ndist\n.basalt/sources.css\nshots-*/\n')

    const listed = repo({ ...vite, '.gitignore': '/.basalt/sources.css\nshots-*/\n' })
    await runInit(['--profile', 'app', '--root', 'src'], listed)
    expect(read(listed, '.gitignore')).toBe('/.basalt/sources.css\nshots-*/\n')

    const half = repo({ ...vite, '.gitignore': '.basalt/sources.css\n' })
    await runInit(['--profile', 'app', '--root', 'src'], half)
    expect(read(half, '.gitignore')).toBe('.basalt/sources.css\nshots-*/\n')

    const below = repo({ 'apps/web/vite.config.ts': vite['vite.config.ts'] })
    await runInit(['--profile', 'app', '--root', 'apps/web/src'], below)
    expect(read(below, 'apps/web/.gitignore')).toBe('.basalt/sources.css\nshots-*/\n')
  })

  it('splices the import after a multi-line last import, not inside it', async () => {
    const dir = repo({
      'vite.config.ts':
        "import {\n  defineConfig,\n  loadEnv,\n} from 'vite'\n\nexport default defineConfig({ plugins: [] })\n",
    })
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(read(dir, 'vite.config.ts')).toBe(
      "import {\n  defineConfig,\n  loadEnv,\n} from 'vite'\nimport { tanstackRouter } from '@tanstack/router-plugin/vite'\nimport tailwindcss from '@tailwindcss/vite'\nimport { basalt } from 'basalt-ui/vite'\n\nexport default defineConfig({ plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), tailwindcss(), basalt()] })\n",
    )
  })

  it('points the css at the .basalt/sources.css next to the Vite config, below the repo root', async () => {
    const dir = repo({
      'apps/web/vite.config.ts':
        "import react from '@vitejs/plugin-react'\nexport default { plugins: [react()] }\n",
      'apps/web/src/index.css': "@import 'tailwindcss';\n",
    })
    await runInit(['--profile', 'app', '--root', 'apps/web/src'], dir)
    expect(read(dir, 'apps/web/src/index.css')).toBe(
      "@import 'basalt-ui/tailwind.css';\n@import './tokens.css';\n@import './basalt.tokens.css';\n@import '../.basalt/sources.css';\n",
    )
  })

  it('leaves the css alone when no Vite config says where sources.css lands', async () => {
    const dir = repo({ 'src/index.css': "@import 'tailwindcss';\n" })
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(read(dir, 'src/index.css')).toBe("@import 'tailwindcss';\n")
    expect(log).toContain(
      "to do: make your stylesheet entry exactly:\n@import 'basalt-ui/tailwind.css'",
    )
  })

  it("rewrites create-vite's own index.css to the one entry, and keeps a sheet it does not know", async () => {
    const stockCss =
      ':root {\n  --code-bg: transparent;\n  font-synthesis: none;\n  color-scheme: light dark;\n}\n\n#root {\n  width: 1126px;\n}\n'
    const vite = {
      'vite.config.ts':
        "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n",
    }
    const stock = repo({ ...vite, 'src/index.css': stockCss })
    await runInit(['--profile', 'app', '--root', 'src'], stock)
    expect(read(stock, 'src/index.css')).toBe(
      "@import 'basalt-ui/tailwind.css';\n@import './tokens.css';\n@import './basalt.tokens.css';\n@import '../.basalt/sources.css';\n",
    )
    expect(read(stock, 'vite.config.ts')).toContain(
      "plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), basalt()]",
    )

    const handWritten =
      ':root { --gap: 4px; color-scheme: light dark }\n#root { display: grid }\n.sidebar { width: 12rem }\n'
    const kept = repo({ ...vite, 'src/index.css': handWritten })
    await runInit(['--profile', 'app', '--root', 'src'], kept)
    expect(read(kept, 'src/index.css')).toBe(handWritten)

    const own = repo({ ...vite, 'src/index.css': '@import "./reset.css";\n.card { margin: 0 }\n' })
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], own)
    expect(read(own, 'src/index.css')).toBe('@import "./reset.css";\n.card { margin: 0 }\n')
    expect(log).toContain(
      "to do: make your stylesheet entry exactly:\n@import 'basalt-ui/tailwind.css';",
    )
  })

  it('puts tailwindcss() between react() and basalt(), and adds only what is missing', async () => {
    const dir = repo({
      'vite.config.ts':
        "import react from '@vitejs/plugin-react'\nimport { basalt } from 'basalt-ui/vite'\n\nexport default { plugins: [react({ jsxRuntime: 'automatic' }), basalt()] }\n",
    })
    await runInit(['--profile', 'parts', '--root', 'src'], dir)
    expect(read(dir, 'vite.config.ts')).toContain(
      "plugins: [react({ jsxRuntime: 'automatic' }), tailwindcss(), basalt()]",
    )
    const first = read(dir, 'vite.config.ts')
    await runInit(['--profile', 'parts', '--root', 'src'], dir)
    expect(read(dir, 'vite.config.ts')).toBe(first)
  })

  it('names one stylesheet entry in init, docs/vite.md and the basalt-app skill', async () => {
    const dir = repo({
      'vite.config.ts':
        "import react from '@vitejs/plugin-react'\nexport default { plugins: [react()] }\n",
      'src/index.css': "@import 'tailwindcss';\n",
    })
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    const entry = read(dir, 'src/index.css').trimEnd()
    const pkg = join(import.meta.dirname, '../../..')
    for (const file of ['docs/vite.md', 'agent/skills/basalt-app/SKILL.md']) {
      const text = readFileSync(join(pkg, file), 'utf8')
      const lines = entry.split('\n')
      expect(lines.every((line) => text.includes(line))).toBe(true)
      // The order is the entry's: tailwind.css, then the app's tokens, then the sources.
      const at = lines.map((line) => text.indexOf(line))
      expect(at).toEqual(at.toSorted((a, b) => a - b))
    }
  })

  it('has the lint script run basalt-ui lint once, and leaves a repo that already runs it', async () => {
    const dir = repo()
    put(
      dir,
      'package.json',
      JSON.stringify({ name: 'fixture', scripts: { lint: 'oxlint' } }, null, 2),
    )
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    const scripts = JSON.parse(read(dir, 'package.json')).scripts
    expect(scripts.lint).toBe('oxlint && basalt-ui lint')
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(JSON.parse(read(dir, 'package.json')).scripts.lint).toBe('oxlint && basalt-ui lint')

    const made = repo({ Makefile: 'check:\n\tbasalt-ui lint\n' })
    await runInit(['--profile', 'app', '--root', 'src'], made)
    expect(JSON.parse(read(made, 'package.json')).scripts).toBeUndefined()
  })

  it('declares the same flags to the dispatcher and to its own parser', () => {
    expect(Object.keys(FLAGS).toSorted()).toEqual(
      Object.keys(COMMAND_OPTIONS['init'] ?? {}).toSorted(),
    )
  })

  it('places everything at the git root when run from a package below it', async () => {
    const dir = repo({ 'apps/web/package.json': JSON.stringify({ name: 'web' }) })
    const { code } = await runInit(
      ['--profile', 'app', '--root', 'apps/web/src'],
      join(dir, 'apps/web'),
    )
    expect(code).toBe(0)
    expect(existsSync(join(dir, '.basalt/manifest.json'))).toBe(true)
    expect(existsSync(join(dir, '.claude/skills/basalt-design/SKILL.md'))).toBe(true)
    expect(existsSync(join(dir, 'apps/web/.claude'))).toBe(false)
    expect(existsSync(join(dir, 'apps/web/.basalt'))).toBe(false)
  })

  it('ends in doctor, and exits 0 on a doctor that reports', async () => {
    const dir = repo()
    const ran: string[] = []
    const { code } = await runInit(['--profile', 'tokens'], dir, {
      doctor: async (root) => (ran.push(root), 1),
    })
    expect(ran).toEqual([dir])
    expect(code).toBe(0)
  })
})

describe('init: with sync', () => {
  it('leaves an install `sync --check` finds current, through the default preset seam', async () => {
    const dir = repo()
    await runInit(['--profile', 'bridge', '--root', 'src'], dir)
    const saved = { log: console.log, error: console.error }
    console.log = console.error = () => {}
    try {
      expect(await run(['sync', '--check'], dir)).toBe(0)
    } finally {
      console.log = saved.log
      console.error = saved.error
    }
  })
})

describe('init: twice produces no diff', () => {
  it.each(PROFILES)('%s', async (profile) => {
    const dir = repo({
      'vite.config.ts':
        "import react from '@vitejs/plugin-react'\nexport default { plugins: [react()] }\n",
      'src/index.css': "@import 'tailwindcss';\n",
    })
    const argv = ['--profile', profile, '--root', 'src', '--tokens-out', 'src/tokens.css']
    expect((await runInit(argv, dir)).code).toBe(0)
    const once = snapshot(dir)
    expect((await runInit(argv, dir)).code).toBe(0)
    expect(snapshot(dir)).toEqual(once)
  })
})

const VITE_STOCK_MAIN = `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`

/** What `bun create vite --template react-ts` leaves, to the files `init` looks at. */
const createVite = (): string =>
  repo({
    'vite.config.ts':
      "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n",
    'index.html': '<script type="module" src="/src/main.tsx"></script>\n',
    'src/main.tsx': VITE_STOCK_MAIN,
    'src/App.tsx': 'export default function App() { return null }\n',
    'src/index.css': "@import 'tailwindcss';\n",
  })

const SEEDED = [
  'src/main.tsx',
  'src/routes/__root.tsx',
  'src/routes/_app.tsx',
  'src/lib/nav.tsx',
  'src/components/route-pending.tsx',
  'src/components/route-error.tsx',
  'src/components/route-missing.tsx',
  'src/routes/_app/index.tsx',
] as const

const template = (name: string): string =>
  readFileSync(join(import.meta.dirname, '../../../agent/templates', name), 'utf8').replaceAll(
    '{{APP_NAME}}',
    'fixture',
  )

describe('init: the router scaffold', () => {
  it('writes every router seed on a create-vite app, replacing its stock entry', async () => {
    const dir = createVite()
    const { code, log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(code).toBe(0)
    expect(read(dir, 'src/main.tsx')).toBe(template('main.tpl'))
    expect(read(dir, 'src/routes/__root.tsx')).toBe(template('__root.tpl'))
    expect(read(dir, 'src/routes/_app.tsx')).toBe(template('_app.tpl'))
    expect(read(dir, 'src/lib/nav.tsx')).toBe(template('nav.tpl'))
    expect(read(dir, 'src/components/route-pending.tsx')).toBe(template('_app-pending.tpl'))
    expect(read(dir, 'src/components/route-error.tsx')).toBe(template('_app-error.tpl'))
    expect(read(dir, 'src/components/route-missing.tsx')).toBe(template('_app-missing.tpl'))
    expect(read(dir, 'src/routes/_app/index.tsx')).toBe(template('_app-index.tpl'))
    expect(log).toContain("src/main.tsx: replaced create-vite's entry")
    expect(log).toContain('wrote src/routes/_app.tsx')
    expect(read(dir, 'src/App.tsx')).toContain('export default function App')
  })

  it('writes the start page under the _app layout once, and a second run keeps what the app made of it', async () => {
    const dir = createVite()
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    const page = read(dir, 'src/routes/_app/index.tsx')
    expect(page).toContain("createFileRoute('/_app/')")
    expect(page).toContain('<Page>')
    put(dir, 'src/routes/_app/index.tsx', `${page}// mine\n`)
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(read(dir, 'src/routes/_app/index.tsx')).toBe(`${page}// mine\n`)
    expect(log).toContain('kept src/routes/_app/index.tsx: it exists')
  })

  it('seeds no _app layout or nav beside a root route the app keeps, and a second run writes none', async () => {
    const dir = createVite()
    put(dir, 'src/routes/__root.tsx', 'export const Route = 1\n')
    put(dir, 'src/routes/index.tsx', 'export const Route = 2\n')
    const { code, log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(code).toBe(0)
    expect(read(dir, 'src/routes/__root.tsx')).toBe('export const Route = 1\n')
    for (const path of ['src/routes/_app.tsx', 'src/lib/nav.tsx', 'src/routes/_app/index.tsx']) {
      expect(existsSync(join(dir, path))).toBe(false)
    }
    expect(log).toContain('skipped src/routes/_app.tsx: the app keeps its own root route')
    expect(log).toContain('no _app layout or nav was seeded')
    const before = snapshot(dir)
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(snapshot(dir)).toEqual(before)
  })
  it('writes the start page beside a route group directory, which serves no path itself', async () => {
    const dir = createVite()
    put(dir, 'src/routes/(auth)/login.tsx', 'export const Route = 1\n')
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(existsSync(join(dir, 'src/routes/_app/index.tsx'))).toBe(true)
  })

  it('writes no start page when a route file already serves `/`, so `/` never has two routes', async () => {
    const dir = createVite()
    put(dir, 'src/routes/_app.index.tsx', 'export const Route = 1\n')
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(read(dir, 'src/routes/_app.index.tsx')).toBe('export const Route = 1\n')
    expect(existsSync(join(dir, 'src/routes/_app/index.tsx'))).toBe(false)
    expect(log).toContain('skipped src/routes/_app/index.tsx: a route file already serves /')
  })

  it("swaps create-vite's `tsc -b && vite build` so the route tree exists before tsc, and writes the first tree", async () => {
    const dir = createVite()
    put(
      dir,
      'package.json',
      JSON.stringify({ name: 'fixture', scripts: { dev: 'vite', build: 'tsc -b && vite build' } }),
    )
    const trees: string[] = []
    const { code, log } = await runInit(['--profile', 'app', '--root', 'src'], dir, {
      routeTree: async (appDir) => (trees.push(appDir), null),
    })
    expect(code).toBe(0)
    expect(JSON.parse(read(dir, 'package.json')).scripts.build).toBe('vite build && tsc -b')
    expect(log).toContain('build runs `vite build && tsc -b`')
    expect(trees).toEqual([dir])
    const again = await runInit(['--profile', 'app', '--root', 'src'], dir, {
      routeTree: async () => null,
    })
    expect(again.log).not.toContain('build runs')
    expect(JSON.parse(read(dir, 'package.json')).scripts.build).toBe('vite build && tsc -b')
  })

  it('prints the line to change for a build script it cannot swap, and when the tree cannot be written', async () => {
    const dir = createVite()
    put(
      dir,
      'package.json',
      JSON.stringify({ name: 'fixture', scripts: { build: 'tsc --noEmit; vite build --mode x' } }),
    )
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir, {
      routeTree: async () => 'router-plugin is not installed',
    })
    expect(JSON.parse(read(dir, 'package.json')).scripts.build).toBe(
      'tsc --noEmit; vite build --mode x',
    )
    expect(log).toContain('type-checks before the route tree exists')
    expect(log).toContain('run `vite build` once to write src/routeTree.gen.ts')
  })

  it("deletes create-vite's demo App.tsx and App.css it can prove are stock", async () => {
    const dir = createVite()
    put(
      dir,
      'src/App.tsx',
      "import reactLogo from './assets/react.svg'\nimport './App.css'\nexport default () => <h1>Vite + React</h1>\n",
    )
    put(
      dir,
      'src/App.css',
      '.logo { height: 6em }\n@keyframes logo-spin { to { rotate: 1turn } }\n',
    )
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(existsSync(join(dir, 'src/App.tsx'))).toBe(false)
    expect(existsSync(join(dir, 'src/App.css'))).toBe(false)
    expect(log).toContain('removed src/App.tsx')
    expect(log).toContain('removed src/App.css')
  })

  it('names an App.tsx it cannot prove stock as dead and leaves it', async () => {
    const dir = createVite()
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(read(dir, 'src/App.tsx')).toContain('export default function App')
    expect(log).toContain('src/App.tsx is no longer imported by the entry')
  })

  it('writes the seeds into an empty src/', async () => {
    const dir = repo()
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    for (const path of SEEDED) expect(existsSync(join(dir, path))).toBe(true)
  })

  it('changes no seed on a second init or a sync after a local edit', async () => {
    const dir = createVite()
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    for (const path of SEEDED) put(dir, path, `${read(dir, path)}// mine\n`)
    const edited = snapshot(dir)
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(snapshot(dir)).toEqual(edited)
    expect(log).toContain('kept src/routes/_app.tsx')
    expect(log).toContain('src/main.tsx: it exists and is not')
    expect(sync({ pkgRoot: packageRoot() }, dir)).toBe(0)
    for (const path of SEEDED) expect(read(dir, path)).toBe(edited[path] ?? '')
  })

  it('leaves a non-stock main.tsx and prints the template lines', async () => {
    const mine = "import { render } from './mine'\nrender()\n"
    const dir = repo({ 'src/main.tsx': mine })
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(read(dir, 'src/main.tsx')).toBe(mine)
    expect(log).toContain('to do: make src/main.tsx mount the router')
    expect(log).toContain('<RouterProvider router={router} />')
    expect(existsSync(join(dir, 'src/routes/_app.tsx'))).toBe(true)
  })

  it('writes no seeds below the app profile, for a Start app, or with shell: false', async () => {
    const parts = repo()
    await runInit(['--profile', 'parts', '--root', 'src'], parts)
    const start = repo()
    put(
      start,
      'package.json',
      JSON.stringify({ name: 'x', dependencies: { '@tanstack/react-start': '1.0.0' } }),
    )
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], start)
    expect(log).toContain('TanStack Start app')
    const shellLess = repo()
    put(shellLess, 'package.json', JSON.stringify({ name: 'x', basalt: { shell: false } }))
    await runInit(['--profile', 'app', '--root', 'src'], shellLess)
    for (const dir of [parts, start, shellLess]) {
      for (const path of SEEDED) expect(existsSync(join(dir, path))).toBe(false)
    }
  })

  it('leaves a code-routed app and its vite config without the router plugin', async () => {
    const config =
      "import react from '@vitejs/plugin-react'\nexport default { plugins: [react()] }\n"
    const dir = repo({
      'vite.config.ts': config,
      'src/main.tsx': 'const router = createBasaltRouter({})\n',
    })
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(log).toContain('code-routed app')
    expect(existsSync(join(dir, 'src/routes/__root.tsx'))).toBe(false)
    expect(read(dir, 'vite.config.ts')).not.toContain('tanstackRouter')
  })

  it('adds the router plugin once and keeps one that is there', async () => {
    const dir = createVite()
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    const first = read(dir, 'vite.config.ts')
    await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(read(dir, 'vite.config.ts')).toBe(first)
    expect(first.match(/tanstackRouter\(/g)).toHaveLength(1)
    expect(first).toContain('react(), tailwindcss(), basalt()')
  })

  it('names the router plugin in the to-do when the vite config is not stock', async () => {
    const dir = repo({ 'vite.config.ts': 'export default defineConfig(() => ({}))\n' })
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(log).toContain('to do: import { tanstackRouter }')
    expect(log).toContain('routeTree.gen')
  })

  it('writes the seeds in a directory without a package.json', async () => {
    const dir = repo()
    rmSync(join(dir, 'package.json'))
    const { code } = await runInit(['--profile', 'app', '--root', 'src', '--no-install'], dir)
    expect(code).toBe(0)
    expect(read(dir, 'src/routes/_app.tsx')).toContain(`name: '${basename(dir)}'`)
  })

  it('writes an app name with a quote or a $ literally into the brand', async () => {
    const dir = repo()
    put(dir, 'package.json', JSON.stringify({ name: "it's $&-app" }))
    await runInit(['--profile', 'app', '--root', 'src', '--no-install'], dir)
    expect(read(dir, 'src/routes/_app.tsx')).toContain("name: 'it\\'s $&-app'")
  })
})

describe('init --start: the TanStack Start host', () => {
  const startApp = (extra: Record<string, string> = {}): string =>
    repo({
      'package.json': JSON.stringify({
        name: 'fixture',
        dependencies: { '@tanstack/react-start': '1.169.7' },
      }),
      'vite.config.ts':
        "import { defineConfig } from 'vite'\nimport viteReact from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [viteReact()],\n})\n",
      ...extra,
    })

  it('writes the Start seeds, no main.tsx, and puts tanstackStart() before the React plugin', async () => {
    const dir = startApp()
    const { code } = await runInit(['--profile', 'app', '--start', '--root', 'src'], dir)
    expect(code).toBe(0)
    expect(read(dir, 'src/routes/__root.tsx')).toBe(
      template('__root.start.tpl').replace('{{CSS_ENTRY}}', '../index.css'),
    )
    expect(read(dir, 'src/router.tsx')).toBe(template('router.start.tpl'))
    const shared = {
      'src/routes/_app.tsx': '_app.tpl',
      'src/lib/nav.tsx': 'nav.tpl',
      'src/components/route-pending.tsx': '_app-pending.tpl',
      'src/components/route-error.tsx': '_app-error.tpl',
      'src/components/route-missing.tsx': '_app-missing.tpl',
      'src/routes/_app/index.tsx': '_app-index.tpl',
    }
    for (const [path, tpl] of Object.entries(shared)) expect(read(dir, path)).toBe(template(tpl))
    expect(existsSync(join(dir, 'src/main.tsx'))).toBe(false)
    const vite = read(dir, 'vite.config.ts')
    expect(vite).toContain("import { tanstackStart } from '@tanstack/react-start/plugin/vite'")
    expect(vite).toContain(
      'tanstackStart({ router: { autoCodeSplitting: true } }), viteReact(), tailwindcss(), basalt()',
    )
    expect(vite).not.toContain('tanstackRouter')
  })

  it('writes src/index.css as the one stylesheet entry when the app has none, and keeps it on a re-run', async () => {
    const dir = startApp()
    await runInit(['--profile', 'app', '--start', '--root', 'src'], dir)
    const css = read(dir, 'src/index.css')
    expect(css).toContain("@import 'basalt-ui/tailwind.css';")
    expect(css).toContain('.basalt/sources.css')
    const first = snapshot(dir)
    await runInit(['--profile', 'app', '--start', '--root', 'src'], dir)
    expect(snapshot(dir)).toEqual(first)
  })

  it('links a stylesheet at the app root from src/routes', async () => {
    const dir = startApp({ 'index.css': "@import 'tailwindcss';\n" })
    await runInit(['--profile', 'app', '--start', '--root', 'src'], dir)
    expect(read(dir, 'src/routes/__root.tsx')).toContain("from '../../index.css?url'")
    expect(existsSync(join(dir, 'src/index.css'))).toBe(false)
  })

  it('links the stylesheet the app already has', async () => {
    const dir = startApp({ 'src/styles.css': "@import 'tailwindcss';\n" })
    await runInit(['--profile', 'app', '--start', '--root', 'src'], dir)
    expect(read(dir, 'src/routes/__root.tsx')).toContain("from '../styles.css?url'")
  })

  it('says what is left: the dependency the app owns, the files Start replaces, the first route tree', async () => {
    const dir = repo({
      'vite.config.ts': 'export default defineConfig(() => ({}))\n',
      'index.html': '<div id="root"></div>\n',
      'src/main.tsx': 'import "./x"\n',
    })
    const { code, log } = await runInit(['--profile', 'app', '--start', '--root', 'src'], dir)
    expect(code).toBe(0)
    expect(log).toContain('to do: add @tanstack/react-start')
    expect(log).toContain('to do: delete index.html and src/main.tsx')
    expect(log).toContain('to do: import { tanstackStart }')
    expect(log).toContain('vite build')
    expect(read(dir, 'src/main.tsx')).toBe('import "./x"\n')
  })

  it('installs nothing for @tanstack/react-start: the app owns it', async () => {
    const dir = startApp()
    const { commands } = await runInit(['--profile', 'app', '--start', '--root', 'src'], dir)
    expect(commands.flat().join(' ')).not.toContain('react-start')
  })

  it('is refused below the app profile, and the flag is listed for the CLI dispatch', async () => {
    const dir = repo()
    const before = snapshot(dir)
    const { code, log } = await runInit(['--profile', 'parts', '--start'], dir)
    expect(code).toBe(1)
    expect(log).toContain('--start needs --profile app')
    expect(snapshot(dir)).toEqual(before)
    expect(Object.keys(COMMAND_OPTIONS['init'] ?? {})).toContain('start')
  })

  it('leaves a Start app without the flag as it is: no seeds, the old hint', async () => {
    const dir = startApp()
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], dir)
    expect(log).toContain('TanStack Start app')
    expect(existsSync(join(dir, 'src/router.tsx'))).toBe(false)
  })
})

describe('init: the session note', () => {
  it('ends a first run that writes agent files with the note once, and a second run prints none', async () => {
    const dir = createVite()
    const argv = ['--profile', 'app', '--root', 'src']
    const first = await runInit(argv, dir)
    expect(first.code).toBe(0)
    expect(first.log.split(SESSION_NOTE)).toHaveLength(2)
    const note = first.log.slice(first.log.indexOf(SESSION_NOTE))
    expect(note).toContain('.claude/skills/basalt-design/SKILL.md')
    expect(note).toContain('basalt-ui lint --changed')
    expect(note).toContain('.claude/agents/basalt-design-reviewer.md')
    expect(note).not.toMatch(/continue in a new session|stop here|before you write/i)
    const second = await runInit(argv, dir)
    expect(second.log).not.toContain('Agent sessions:')
  })

  it('names no agent product or terminal', () => {
    expect(SESSION_NOTE.replaceAll('.claude/', '')).not.toMatch(
      /claude|opencode|codex|cursor|tmux|herdr/i,
    )
  })
})
