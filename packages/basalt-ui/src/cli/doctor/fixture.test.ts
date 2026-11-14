/**
 * Test trees for the doctor checks: a temp dir holding a manifest and the files one profile's install
 * would hold, built by hand and by `sync` (never `init`). `makeTree(profile)` is green on all twelve
 * checks; a test patches one file and asserts the one check that must notice.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import { a11yComponents } from '../../lint/preset'
import { renderStylelintConfig } from '../../lint/stylelint/render'
import { SLOTS } from '../../ui/slots'
import { seedBudget, writeBudget } from '../budget'
import { packageRoot, readFrameworkVersion } from '../index'
import { readManifest, writeManifest } from '../manifest'
import type { Manifest, Profile } from '../manifest'
import { sync } from '../sync'
import { tokensCss } from '../tokens-css'
import { afterEach, describe, expect, it } from 'bun:test'

import { buildContext, runChecks } from './index'
import type { DoctorOptions, Result } from './types'

const trees: string[] = []

export const cleanupTrees = (): void => {
  for (const dir of trees.splice(0)) rmSync(dir, { recursive: true, force: true })
}

/** The command `settings.json` registers: a missing or failing shim exits 2 and says so. */
export const wrappedHook = (event: string): string =>
  `node "$CLAUDE_PROJECT_DIR/.basalt/hook.mjs" ${event}; s=$?; case $s in 0|2) exit $s;; esac; ` +
  "echo 'basalt hook: the shim did not run (exit '$s'). Run bun install, then basalt-ui doctor.' >&2; exit 2"

export const settingsJson = (wrap: (event: string) => string = wrappedHook): string =>
  `${JSON.stringify(
    {
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write|MultiEdit',
            hooks: [{ type: 'command', command: wrap('post-edit') }],
          },
        ],
        Stop: [{ hooks: [{ type: 'command', command: wrap('stop') }] }],
        PreToolUse: [
          {
            matcher: 'Edit|Write|MultiEdit',
            hooks: [{ type: 'command', command: wrap('pre-edit') }],
          },
        ],
      },
    },
    null,
    2,
  )}\n`

/** A stub for the real shim (v3-sk-4): a finding and exit 2 for the seeded offender, else exit 0. */
const STUB_HOOK = `let input = ''
process.stdin.on('data', (chunk) => (input += chunk))
process.stdin.on('end', () => {
  if (input.includes('__basalt_seeded_offender__')) {
    console.error('src/__basalt_seeded_offender__.tsx:1 basalt/colour-literal: hex literal. Use a VX token.')
    process.exit(2)
  }
  process.exit(0)
})
`

const PEERS: Record<string, string> = {
  react: '19.3.0',
  'react-dom': '19.3.0',
  tailwindcss: '4.3.5',
  '@base-ui/react': '1.9.0',
  '@tanstack/react-router': '1.170.0',
  '@tanstack/react-query': '5.104.0',
}

const ROUTER = `import { createRouter } from '@tanstack/react-router'
export const router = createRouter({
  routeTree,
  defaultErrorComponent: ErrorView,
  defaultNotFoundComponent: NotFoundView,
  defaultPendingComponent: PendingView,
})
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
`

const BOOT = `<script>document.documentElement.setAttribute('data-theme', localStorage.getItem('basalt:scheme') ?? 'light')</script>`
const DESIGN =
  '# App — Design\n\n## Identity\n\nThe defaults, unchanged.\n\n## Deviations\n\n- _none yet_\n'

/** `files` patches the healthy tree: a string writes, `null` deletes. */
export type Patch = Record<string, string | null>

function put(dir: string, rel: string, content: string): void {
  const path = resolve(dir, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

/** A healthy install of `profile`, patched by `files`. Returns the install root. */
export function makeTree(profile: Profile = 'app', files: Patch = {}): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'basalt-doctor-'))
  trees.push(dir)
  const pkgRoot = packageRoot()
  const version = readFrameworkVersion(pkgRoot)
  const app = profile === 'app'
  const lint = profile !== 'tokens'

  mkdirSync(resolve(dir, '.git'))
  const deps = lint
    ? Object.fromEntries(
        Object.keys(PEERS)
          .filter((name) => app || !name.startsWith('@tanstack/'))
          .map((name) => [name, `^${PEERS[name]}`]),
      )
    : {}
  put(
    dir,
    'package.json',
    JSON.stringify({ name: 'app', dependencies: { 'basalt-ui': version, ...deps } }),
  )
  put(
    dir,
    'node_modules/basalt-ui/package.json',
    JSON.stringify({ name: 'basalt-ui', version, bin: { 'basalt-ui': './bin/basalt-ui.mjs' } }),
  )
  put(dir, 'node_modules/basalt-ui/bin/basalt-ui.mjs', '// bin\n')
  for (const [name, installed] of Object.entries(PEERS)) {
    put(dir, `node_modules/${name}/package.json`, JSON.stringify({ name, version: installed }))
  }
  mkdirSync(resolve(dir, 'node_modules/.bin'))
  symlinkSync(
    resolve(pkgRoot, '../../node_modules/.bin/oxfmt'),
    resolve(dir, 'node_modules/.bin/oxfmt'),
  )
  put(
    dir,
    '.oxfmtrc.json',
    JSON.stringify({
      ignorePatterns: [
        '.basalt/**',
        '.claude/**',
        '.oxlintrc.basalt.json',
        '.stylelintrc.basalt.json',
      ],
    }),
  )

  put(dir, 'src/styles.css', '.page { color: var(--vx-ink); }\n')
  put(dir, 'src/main.tsx', 'export const page = 1\n')
  put(
    dir,
    'index.html',
    `<!doctype html>\n<html lang="en">\n<head>${BOOT}</head>\n<body></body>\n</html>\n`,
  )
  put(
    dir,
    'lefthook.yml',
    'pre-commit:\n  commands:\n    basalt:\n      run: ./node_modules/.bin/basalt-ui lint --changed\n',
  )
  if (app) {
    put(dir, 'src/router.tsx', ROUTER)
    put(
      dir,
      'vite.config.ts',
      'export default { plugins: [tanstackRouter({ autoCodeSplitting: true })] }\n',
    )
  }
  if (lint) put(dir, 'DESIGN.md', DESIGN)

  const manifest: Manifest = {
    profile,
    version,
    roots: { src: profile },
    ejected: {},
    managed: {},
    deepRender: [],
    authoredContent: [],
    viewports: [],
    tokens: [{ out: 'src/tokens.css', format: 'css', flags: [] }],
    rest: {},
  }
  writeManifest(dir, manifest)
  writeBudget(dir, seedBudget(profile))
  quiet(() => tokensCss(['--out', 'src/tokens.css'], dir))
  quiet(() => sync({ pkgRoot }, dir))

  put(dir, '.stylelintrc.basalt.json', renderStylelintConfig({ ignoreFiles: ['src/tokens.css'] }))
  if (lint) {
    put(
      dir,
      '.oxlintrc.basalt.json',
      JSON.stringify({
        jsPlugins: ['basalt-ui/lint', '@shadcn/lint'],
        settings: {
          'jsx-a11y': { components: a11yComponents(SLOTS) },
          basalt: { pins: { oxlint: '1.93.0' } },
        },
      }),
    )
    put(dir, '.oxlintrc.json', JSON.stringify({ extends: ['./.oxlintrc.basalt.json'] }))
    put(dir, '.claude/settings.json', settingsJson())
    put(dir, '.basalt/hook.mjs', STUB_HOOK)
  }
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) rmSync(resolve(dir, rel), { recursive: true, force: true })
    else put(dir, rel, content)
  }
  return dir
}

/** Rewrites the tree's manifest through `edit`. */
export function editManifest(dir: string, edit: (manifest: Manifest) => void): void {
  const read = readManifest(dir)
  if (read === null || 'error' in read) throw new Error('no manifest to edit')
  edit(read.manifest)
  writeManifest(dir, read.manifest)
}

/** Runs `fn` with both console streams swallowed; returns what it returned. */
export function quiet<T>(fn: () => T): T {
  const saved = { log: console.log, error: console.error }
  console.log = () => {}
  console.error = () => {}
  try {
    return fn()
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

/** Commits the tree so `HEAD` holds `.basalt/budget.json`: the base ref the ratchet reads. */
export function commitTree(dir: string): void {
  const git = (...args: string[]): void => {
    execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      stdio: 'ignore',
    })
  }
  rmSync(resolve(dir, '.git'), { recursive: true, force: true })
  git('init', '-q')
  if (existsSync(resolve(dir, '.basalt/budget.json'))) git('add', '-f', '.basalt/budget.json')
  git('commit', '-q', '--allow-empty', '-m', 'base')
}

/** The doctor options a healthy tree needs: a lint runner that fires, oxlint at the pin, a base ref. */
export const HEALTHY: DoctorOptions = {
  runLint: () => ['basalt/colour-literal'],
  installedOxlint: '1.93.0',
  baseRef: 'HEAD',
}

/** Runs one check against `dir` and returns its result. */
export async function runCheck(
  dir: string,
  id: number,
  options: DoctorOptions = HEALTHY,
): Promise<Result> {
  const [result] = await runChecks(buildContext(dir, options), [id])
  if (result === undefined) throw new Error(`no check ${id}`)
  return result
}

afterEach(cleanupTrees)

describe('the doctor test tree', () => {
  it('a string patch writes a file and null deletes one', () => {
    const dir = makeTree('bridge', { 'src/extra.tsx': 'x', 'src/styles.css': null })
    expect(existsSync(resolve(dir, 'src/extra.tsx'))).toBe(true)
    expect(existsSync(resolve(dir, 'src/styles.css'))).toBe(false)
  })
})
