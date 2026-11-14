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
import { dirname, join, resolve } from 'node:path'
import stylelint from 'stylelint'

import { readBudget, seedBudget } from '../budget'
import { run } from '../index'
import { parseManifest } from '../manifest'
import type { Manifest, Profile } from '../manifest'
import { init } from './index'
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

const PROFILES: Profile[] = ['tokens', 'bridge', 'parts', 'app']

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

  it('refuses an --extra file that does not exist, before writing anything', async () => {
    const dir = repo()
    const before = snapshot(dir)
    const { code, log } = await runInit(
      ['--profile', 'tokens', '--extra', 'src/basalt.tokens.ts'],
      dir,
    )
    expect(code).toBe(1)
    expect(log).toContain('--extra src/basalt.tokens.ts does not exist')
    expect(snapshot(dir)).toEqual(before)
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

  it('bridge gets its own shipped preset; parts and app share one', async () => {
    const presets = new Set<string>()
    for (const profile of PROFILES.filter((p) => p !== 'tokens')) {
      const dir = repo()
      await runInit(['--profile', profile, '--root', 'src'], dir)
      presets.add(read(dir, '.oxlintrc.basalt.json'))
    }
    expect(presets.size).toBe(2)
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

  it('installs the tokens peers at exact pins with the lockfile’s package manager, never bunx', async () => {
    const dir = repo()
    const { commands } = await runInit(['--profile', 'tokens'], dir)
    expect(commands).toHaveLength(1)
    const [command] = commands
    expect(command?.slice(0, 4)).toEqual(['bun', 'add', '--dev', '--exact'])
    expect(command?.slice(4).map((spec) => spec.replace(/@\d.*$/, ''))).toEqual([
      'stylelint',
      'postcss-html',
    ])
    expect(command?.slice(4).every((spec) => /@\d+\.\d+\.\d+$/.test(spec))).toBe(true)
  })

  it('bridge adds oxlint and @shadcn/lint; pnpm and npm lockfiles pick their own command', async () => {
    const dir = repo()
    const { commands } = await runInit(['--profile', 'bridge', '--root', 'src'], dir)
    const names = (commands[0] ?? []).slice(4).map((s) => s.replace(/@\d.*$/, ''))
    expect(names).toEqual(['stylelint', 'postcss-html', 'oxlint', '@shadcn/lint'])

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
    const first = await runInit(['--profile', 'tokens'], dir)
    const pins = Object.fromEntries(
      (first.commands[0] ?? []).slice(4).map((spec) => {
        const at = spec.lastIndexOf('@')
        return [spec.slice(0, at), spec.slice(at + 1)]
      }),
    )
    put(dir, 'package.json', JSON.stringify({ name: 'fixture', devDependencies: pins }))
    expect((await runInit(['--profile', 'tokens'], dir)).commands).toEqual([])
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
    expect(read(stock, 'vite.config.ts')).toContain('plugins: [basalt(), react()]')
    expect(read(stock, 'src/index.css')).toBe(
      "@import 'basalt-ui/tailwind.css';\n@import '../.basalt/sources.css';\n",
    )

    const odd = repo({ 'vite.config.ts': 'export default defineConfig(() => ({}))\n' })
    const { log } = await runInit(['--profile', 'app', '--root', 'src'], odd)
    expect(read(odd, 'vite.config.ts')).toBe('export default defineConfig(() => ({}))\n')
    expect(log).toContain('to do: import { basalt }')
    expect(log).toContain("@import 'basalt-ui/tailwind.css'")
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
