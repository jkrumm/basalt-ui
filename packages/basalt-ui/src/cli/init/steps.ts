/**
 * The steps `init` runs, in order (docs/v3/concepts/skills-agent-layer.md section 4.1). Each takes
 * the one `Ctx`, does its part and returns; a step that cannot finish says so through `ctx.problems`
 * and the run goes on, so one failed install does not leave the files unplaced. A step is safe to
 * run twice: it writes only what differs. `sync` places the hook shim and its settings entries.
 */
import { SOURCES_PATH } from '../../vite/sources'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'

import { BUDGET_PATH, seedBudget, writeBudget } from '../budget'
import { readManifest, writeManifest } from '../manifest'
import type { Manifest, Profile } from '../manifest'
import {
  OXLINT_PRESET_FILE,
  presetFilesFor,
  readShippedPreset,
  STYLELINT_PRESET_FILE,
} from '../presets'
import { addCommand } from '../package-manager'
import { BUILD_PEERS, RUNTIME_PEERS, satisfiesRange } from '../peers'
import { INVOKERS, LINT_INVOCATION } from '../doctor/wiring'
import { registersRouterPlugin } from '../router-wiring'
import { parseJsonc, readIfExists } from '../source-text'
import { findRepoRoot, resolveAppDir } from '../index'
import { ROUTER_PLUGIN_OPTIONS, swapStockBuild, typechecksBeforeTree } from '../route-tree'
import { isSiblingApp } from '../resolver'
import { sync } from '../sync'
import { claimPrefix } from '../sync/sibling'
import { tokensCss } from '../tokens-css'

export type Runner = (argv: string[], dir: string) => boolean

export type Args = {
  profile: Profile
  /** Declared roots, relative to the install root; `.` is the root itself. */
  roots: string[]
  tokensOut: string
  tokensJsonOut: string | undefined
  extra: string | undefined
  /** The identity flags (`--accent`, `--neutral`, `--vibrancy`, `--selector`) as `tokens:css` argv. */
  identity: string[]
  noInstall: boolean
  /** `--start`: the app is a TanStack Start host (`init --profile app --start`). */
  start: boolean
}

export type Ctx = {
  /** The install root: the git or workspace root. */
  root: string
  args: Args
  pkgRoot: string
  /** Absent under `--no-install`: the command is printed, not run. */
  run: Runner | undefined
  problems: string[]
  /** Lines the user has to apply by hand, printed together at the end. */
  todo: string[]
  /** Set by `placeRouterSeeds`: the app is file-routed, so the Vite config gets the router plugin. */
  routerPlugin?: boolean
}

export const say = (line: string): void => console.log(line)

const readText = (root: string, rel: string): string | null => readIfExists(resolve(root, rel))

export function writeText(root: string, rel: string, content: string): boolean {
  const abs = resolve(root, rel)
  if (readIfExists(abs) === content) return false
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
  return true
}

/**
 * The nearest ancestor holding `.git` (the repo root), else `dir`. A package declaring
 * `basalt.sibling` below the repo root is its own install root: its manifest stays in it.
 */
export function installRoot(dir: string): string {
  if (isSiblingApp(dir)) return dir
  for (let at = dir; ; at = dirname(at)) {
    if (existsSync(join(at, '.git'))) return at
    if (dirname(at) === at) return dir
  }
}

/** True when `text` is plain JSON: a file that parses only as JSONC would lose its comments on a rewrite. */
function isStrictJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

// ── manifest and token outputs ──────────────────────────────────────────────────────────────────

/** The `--extra` sheet `tokens:css` writes beside the identity sheet. */
export const extraCssOut = (args: Args): string =>
  join(dirname(args.tokensOut), 'basalt.tokens.css')

/** The series file a profile with React code gets by default; `tokens` and `site` take one only by `--extra`. */
export function defaultExtra(profile: Profile, roots: readonly string[]): string | undefined {
  if (profile === 'tokens' || profile === 'site') return undefined
  const [first = '.'] = roots
  return join(first === '.' ? 'src' : first, 'basalt.tokens.ts')
}

/** The series file: a starter when it is not there yet, never over an existing one. */
export function seedSeries(ctx: Ctx): void {
  const { extra } = ctx.args
  if (extra === undefined || existsSync(resolve(ctx.root, extra))) return
  const template = readIfExists(resolve(ctx.pkgRoot, 'agent/templates/basalt.tokens.ts.tpl'))
  if (template === null)
    return void ctx.problems.push(`${ctx.pkgRoot} ships no basalt.tokens.ts.tpl`)
  writeText(ctx.root, extra, template)
  say(`wrote ${extra}: the one series file`)
}

/** The `tokens[]` rows this run declares; `--extra` is its own row (`tokens:css --extra` takes no identity flag). */
function tokenRows(args: Args): Manifest['tokens'] {
  const rows: Manifest['tokens'] = [{ out: args.tokensOut, format: 'css', flags: args.identity }]
  if (args.tokensJsonOut !== undefined) {
    const flags = withoutFlag(args.identity, '--selector')
    rows.push({ out: args.tokensJsonOut, format: 'json', flags: [...flags, '--format', 'json'] })
  }
  if (args.extra !== undefined) {
    rows.push({ out: extraCssOut(args), format: 'css', flags: ['--extra', args.extra] })
  }
  return rows
}

function withoutFlag(flags: string[], name: string): string[] {
  const at = flags.indexOf(name)
  return at === -1 ? flags : [...flags.slice(0, at), ...flags.slice(at + 2)]
}

/** Generates every declared output; the first failure stops the run before the manifest is written. */
export function generateTokens(ctx: Ctx): boolean {
  for (const row of tokenRows(ctx.args)) {
    if (tokensCss([...row.flags, '--out', row.out], ctx.root) !== 0) return false
  }
  return true
}

/** Writes the manifest: the declared profile, roots and token rows over whatever is already there. */
export function declareManifest(ctx: Ctx): { error: string } | null {
  const read = readManifest(ctx.root)
  if (read !== null && 'error' in read) return { error: read.error }
  const { profile, roots, extra } = ctx.args
  const base: Manifest =
    read?.manifest ??
    ({
      profile,
      version: '',
      roots: {},
      ejected: {},
      managed: {},
      deepRender: [],
      authoredContent: [],
      viewports: [],
      tokens: [],
      rest: {},
    } satisfies Manifest)
  const rows = tokenRows(ctx.args)
  const declared = new Set(rows.map((r) => r.out))
  const manifest: Manifest = {
    ...base,
    profile,
    roots: { ...base.roots, ...Object.fromEntries(roots.map((r) => [r, profile])) },
    tokens: [...base.tokens.filter((t) => !declared.has(t.out)), ...rows],
    ...(extra === undefined ? {} : { extra }),
    ...(isSiblingApp(ctx.root) ? { sibling: base.sibling ?? claimPrefix(ctx.root) } : {}),
  }
  writeManifest(ctx.root, manifest)
  return null
}

// ── peers ───────────────────────────────────────────────────────────────────────────────────────

type PackageJson = {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const readPackage = (dir: string): PackageJson | null => {
  const text = readIfExists(resolve(dir, 'package.json'))
  try {
    return text === null ? null : (JSON.parse(text) as PackageJson)
  } catch {
    return null
  }
}

/** True when the repo formats with Prettier and has no `.oxfmtrc.json`: then `oxfmt` is not its formatter. */
function formatsWithPrettier(root: string): boolean {
  return (
    readText(root, '.oxfmtrc.json') === null &&
    (readText(root, '.prettierignore') !== null ||
      readPackage(root)?.devDependencies?.['prettier'] !== undefined)
  )
}

/**
 * Runtime packages the scaffold imports that no basalt peer names, with the range `init` installs them at:
 * the icon provider `main.tpl` and `__root.start.tpl` mount. A version the app already declares is kept.
 */
const SCAFFOLD_DEPS: Readonly<Partial<Record<Profile, Readonly<Record<string, string>>>>> = {
  app: { 'lucide-react': '^1.74.0' },
}

/** What `init` installs: runtime peers into `dependencies`, the lint and build tools into `devDependencies`. */
export type PeerPlan = {
  runtime: Record<string, string>
  dev: Record<string, string>
  /**
   * What an already-declared version must meet for `init` to leave it alone: the peer range, else
   * `^<pin>` for a tool the package only pins in dev. A declared version outside it is installed
   * at the pin; one inside it is never reinstalled down.
   */
  ranges: Record<string, string>
}

/**
 * The installs for a profile, read from the package that ships them: its peer entry (an exact pin
 * or a range), else its dev pin. `oxfmt` joins only when it is the repo's formatter (`init` writes
 * `.oxfmtrc.json` for it).
 */
export function peerPlan(pkgRoot: string, profile: Profile, oxfmt: boolean): PeerPlan {
  const own = readPackage(pkgRoot)
  const ranges: Record<string, string> = {}
  const spec = (name: string, presetPin?: string): string => {
    // The peer range wins over the package's own dev pin, so an app already on a newer version in
    // range is never reinstalled down to it; a tool the package only pins in dev uses that pin,
    // and a newer version of the same major is as good as the pin.
    const peer = own?.peerDependencies?.[name]
    const found = presetPin ?? peer ?? own?.devDependencies?.[name]
    if (found === undefined) throw new Error(`${pkgRoot}/package.json pins ${name} nowhere`)
    const devOnly = presetPin === undefined && peer === undefined && /^\d+\.\d+\.\d+$/.test(found)
    ranges[name] = devOnly ? `^${found}` : found
    return found
  }
  const dev: Record<string, string> = {
    stylelint: spec('stylelint'),
    'postcss-html': spec('postcss-html'),
  }
  if (profile !== 'tokens') {
    const pins = readShippedPreset(pkgRoot, profile).settings?.basalt?.pins
    dev['oxlint'] = spec('oxlint', pins?.['oxlint'])
    dev['@shadcn/lint'] = spec('@shadcn/lint')
  }
  if (oxfmt) dev['oxfmt'] = spec('oxfmt')
  for (const name of BUILD_PEERS[profile]) dev[name] = spec(name)
  const scaffold = SCAFFOLD_DEPS[profile] ?? {}
  Object.assign(ranges, scaffold)
  const runtime = {
    ...Object.fromEntries(RUNTIME_PEERS[profile].map((n) => [n, spec(n)])),
    ...scaffold,
  }
  return { runtime, dev, ranges }
}

/** `add` (`--dev` for tools) with exact resolution, for the package manager the lockfile names (npm without one). */
export const installCommand = (root: string, specs: string[], dev = true): string[] =>
  addCommand(root, specs, dev)

export function installPeers(ctx: Ctx): void {
  const plan = peerPlan(ctx.pkgRoot, ctx.args.profile, !formatsWithPrettier(ctx.root))
  const own = readPackage(ctx.root)
  const have = { ...own?.dependencies, ...own?.devDependencies }
  // Installed only where no declared version (or range floor) meets the range; a scaffold dependency
  // and a declaration that names no version (a tag, a workspace link) are the app's own and kept.
  const met = (name: string, spec: string): boolean => {
    const declared = have[name]
    if (declared === undefined) return false
    if (name in (SCAFFOLD_DEPS[ctx.args.profile] ?? {})) return true
    const version = /^[~^]?(\d+\.\d+\.\d+)$/.exec(declared)?.[1]
    if (version === undefined) return !/^\d+\.\d+\.\d+$/.test(spec)
    return satisfiesRange(version, plan.ranges[name] ?? spec)
  }
  const missing = (group: Record<string, string>): string[] =>
    Object.entries(group)
      .filter(([name, spec]) => !met(name, spec))
      .map(([name, spec]) => `${name}@${spec}`)
  const base = isSiblingApp(ctx.root) ? findRepoRoot(ctx.root) : ctx.root
  const runtime = missing(plan.runtime)
  const dev = missing(plan.dev)
  for (const spec of [...runtime, ...dev]) {
    const name = spec.slice(0, spec.lastIndexOf('@'))
    const declared = have[name]
    if (declared !== undefined) {
      say(
        `peers: ${name} ${declared} is outside what basalt-ui supports (${plan.ranges[name] ?? spec}); installing ${spec.slice(name.length + 1)}`,
      )
    }
  }
  const commands = [
    ...(runtime.length > 0 ? [installCommand(base, runtime, false)] : []),
    ...(dev.length > 0 ? [installCommand(base, dev)] : []),
  ]
  if (commands.length === 0) return say('peers: already at their pins.')
  for (const command of commands) {
    if (own === null || ctx.run === undefined) {
      const why = own === null ? `no package.json at ${ctx.root}` : '--no-install'
      ctx.todo.push(`install the peers (${why}): ${command.join(' ')}`)
      continue
    }
    say(`peers: ${command.join(' ')}`)
    if (!ctx.run(command, ctx.root)) {
      ctx.problems.push(`the peer install failed: ${command.join(' ')}`)
    }
  }
}

// ── placement ───────────────────────────────────────────────────────────────────────────────────

/** Managed agent files, both presets and the AGENTS block, through `sync` (never a second renderer). */
export function placeManaged(ctx: Ctx): void {
  const code = sync(
    { pkgRoot: ctx.pkgRoot, presetFiles: presetFilesFor(ctx.pkgRoot), note: false },
    ctx.root,
  )
  if (code !== 0) ctx.problems.push('sync could not place the managed files')
}

/** `.basalt/budget.json` once: a ceiling only moves through a raise row (`eject --raise`, `lint --raise`), never through `init`. */
export function seedBudgetFile(ctx: Ctx): void {
  if (existsSync(resolve(ctx.root, BUDGET_PATH))) return
  writeBudget(ctx.root, seedBudget(ctx.args.profile))
  say(`wrote ${BUDGET_PATH} (waivers follow the count; escapes and ejects are ceilings)`)
}

/**
 * What a sibling install does not place below the repo root, said once each: the repo's own
 * lefthook and CI file stay the root install's, and `check-v3` in its Makefile holds the line.
 */
export const SIBLING_SKIPS = [
  ['lefthook.yml', 'the root install owns the hook runner'],
  ['.github/workflows/check.yml', 'the repo workflow only calls `make check`'],
] as const

export function skipPlacements(): void {
  for (const [file, why] of SIBLING_SKIPS) {
    say(`skipped ${file}: below the repo root (${why}).`)
  }
}

// ── formatter ignore ────────────────────────────────────────────────────────────────────────────

/** What a formatter must not touch: the ledger, the managed agent files and both generated presets. */
export const FORMATTER_IGNORE = [
  '.basalt/**',
  '.claude/**',
  OXLINT_PRESET_FILE,
  STYLELINT_PRESET_FILE,
] as const

/**
 * The router plugin's generated tree under each declared root of an `app`: TanStack writes it with
 * a file-level `/* eslint-disable *\/` and asks to have it excluded from the linter and formatter.
 */
export function generatedTreeIgnores(args: Pick<Args, 'profile' | 'roots'>): string[] {
  if (args.profile !== 'app') return []
  return args.roots.map((root) => `${root === '.' ? 'src' : root}/routeTree.gen.ts`)
}

/** A sibling app's new `.oxfmtrc.json` copies the repo root's settings: oxfmt reads the nearest file. */
function rootFormatterSettings(ctx: Ctx): Record<string, unknown> | null {
  const text = isSiblingApp(ctx.root) ? readText(findRepoRoot(ctx.root), '.oxfmtrc.json') : null
  const config = text === null ? {} : parseJsonc(text)
  if (config === null) return null
  return Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'ignorePatterns'))
}

function ignoreFile(ctx: Ctx): void {
  const ignored = [...FORMATTER_IGNORE, ...generatedTreeIgnores(ctx.args)]
  const missing = (text: string): string[] =>
    ignored.filter((p) => !text.split('\n').some((line) => line.trim() === p))
  const prettier = readText(ctx.root, '.prettierignore')
  const oxfmt = readText(ctx.root, '.oxfmtrc.json')

  if (formatsWithPrettier(ctx.root)) {
    const text = prettier ?? ''
    const add = missing(text)
    if (add.length === 0) return
    const lead = text === '' || text.endsWith('\n') ? text : `${text}\n`
    writeText(ctx.root, '.prettierignore', `${lead}${add.join('\n')}\n`)
    return say(`.prettierignore: ignores ${add.join(', ')}`)
  }

  if (oxfmt === null) {
    const settings = rootFormatterSettings(ctx)
    if (settings === null)
      return void ctx.todo.push(
        `copy the root .oxfmtrc.json settings here, and add to ignorePatterns: ${ignored.join(', ')}`,
      )
    writeText(
      ctx.root,
      '.oxfmtrc.json',
      `${JSON.stringify({ ...settings, ignorePatterns: ignored }, null, 2)}\n`,
    )
    return say('wrote .oxfmtrc.json (ignorePatterns for the managed paths)')
  }
  const config = parseJsonc(oxfmt)
  const listed = Array.isArray(config?.['ignorePatterns'])
    ? (config['ignorePatterns'] as string[])
    : []
  const add = ignored.filter((p) => !listed.includes(p))
  if (add.length === 0) return
  // A commented file cannot be rewritten without losing the comments: print the lines instead.
  if (config === null || !isStrictJson(oxfmt)) {
    return void ctx.todo.push(`add to ignorePatterns in .oxfmtrc.json: ${add.join(', ')}`)
  }
  writeText(
    ctx.root,
    '.oxfmtrc.json',
    `${JSON.stringify({ ...config, ignorePatterns: [...listed, ...add] }, null, 2)}\n`,
  )
  say(`.oxfmtrc.json: ignorePatterns gains ${add.join(', ')}`)
}

const isStockRouteRule = (v: unknown): boolean =>
  Array.isArray(v) && v.length <= 2 && Object.keys(v[1] ?? {}).join() === 'allowConstantExport'

/** The consumer's `.oxlintrc.json` extends the preset, and drops create-vite's stock route rule that overrides it. */
function oxlintExtends(ctx: Ctx): void {
  const line = `./${OXLINT_PRESET_FILE}`
  const text = readText(ctx.root, '.oxlintrc.json')
  if (text === null) {
    const ignorePatterns = generatedTreeIgnores(ctx.args)
    const fresh = { extends: [line], ...(ignorePatterns.length > 0 ? { ignorePatterns } : {}) }
    writeText(ctx.root, '.oxlintrc.json', `${JSON.stringify(fresh, null, 2)}\n`)
    return say('wrote .oxlintrc.json (extends the basalt preset)')
  }
  const config = parseJsonc(text)
  const extended = Array.isArray(config?.['extends']) ? (config['extends'] as string[]) : []
  const hasExtends = extended.some((p) => basename(p) === OXLINT_PRESET_FILE)
  const { 'react/only-export-components': rule, ...kept } = (config?.['rules'] ?? {}) as Record<
    string,
    unknown
  >
  const strict = config !== null && isStrictJson(text)
  const stock = strict && isStockRouteRule(rule)
  if (rule !== undefined && !stock)
    ctx.todo.push('delete react/only-export-components from .oxlintrc.json')
  const listed = Array.isArray(config?.['ignorePatterns'])
    ? (config['ignorePatterns'] as string[])
    : []
  const trees = generatedTreeIgnores(ctx.args).filter((p) => !listed.includes(p))
  if (hasExtends && !stock && trees.length === 0) return
  if (!strict) {
    if (!hasExtends) ctx.todo.push(`add "${line}" to "extends" in .oxlintrc.json`)
    if (trees.length > 0)
      ctx.todo.push(`add to ignorePatterns in .oxlintrc.json: ${trees.join(', ')}`)
    return
  }
  const next = {
    ...config,
    extends: hasExtends ? extended : [line, ...extended],
    ...(trees.length > 0 ? { ignorePatterns: [...listed, ...trees] } : {}),
  }
  const out = JSON.stringify(stock ? { ...next, rules: kept } : next, null, 2)
  writeText(ctx.root, '.oxlintrc.json', `${out}\n`)
  const said = [
    hasExtends ? '' : `extends ${line}`,
    stock ? 'drops the stock route rule' : '',
    trees.length > 0 ? `ignores ${trees.join(', ')}` : '',
  ].filter(Boolean)
  say(`.oxlintrc.json: ${said.join(' and ')}`)
}

export function wireFormatterAndLint(ctx: Ctx): void {
  ignoreFile(ctx)
  if (ctx.args.profile !== 'tokens') oxlintExtends(ctx)
}

/**
 * Something must run `basalt-ui lint` (doctor check 5). When nothing does, the `lint` script of the
 * root `package.json` gains it after whatever it already runs; no `package.json` is a to-do line.
 */
export function wireLintScript(ctx: Ctx): void {
  if (ctx.args.profile === 'tokens') return
  if (INVOKERS.some((f) => LINT_INVOCATION.test(readText(ctx.root, f) ?? ''))) return
  const text = readText(ctx.root, 'package.json')
  const pkg = readPackage(ctx.root) as (PackageJson & { scripts?: Record<string, string> }) | null
  if (text === null || pkg === null) {
    return void ctx.todo.push('run `basalt-ui lint` from a package script, lefthook or make check')
  }
  const lint = pkg.scripts?.['lint']
  const scripts = {
    ...pkg.scripts,
    lint: lint === undefined ? 'basalt-ui lint' : `${lint} && basalt-ui lint`,
  }
  const indent = /^(\s+)"/m.exec(text)?.[1] ?? '  '
  writeText(ctx.root, 'package.json', `${JSON.stringify({ ...pkg, scripts }, null, indent)}\n`)
  say(`package.json: the lint script runs basalt-ui lint`)
}

/**
 * A file-routed app's `build` script: create-vite's `tsc -b && vite build` type-checks before the
 * router plugin has written the route tree, so it becomes `vite build && tsc -b`. Any other script
 * that type-checks first is named, never rewritten.
 */
export function wireBuildScript(ctx: Ctx): void {
  if (ctx.args.profile !== 'app' || ctx.routerPlugin !== true) return
  const app = resolveAppDir(ctx.root)
  if ('error' in app) return
  const rel = join(app.rel, 'package.json')
  const text = readText(ctx.root, rel)
  const pkg = readPackage(app.dir) as (PackageJson & { scripts?: Record<string, string> }) | null
  const build = pkg?.scripts?.['build']
  if (text === null || pkg === null || build === undefined || !typechecksBeforeTree(build)) return
  const swapped = swapStockBuild(build)
  if (swapped === null) {
    return void ctx.todo.push(
      `${rel}: the build script "${build}" type-checks before the route tree exists; run \`vite build\` (or \`tsr generate\`) before \`tsc\``,
    )
  }
  const indent = /^(\s+)"/m.exec(text)?.[1] ?? '  '
  const scripts = { ...pkg.scripts, build: swapped }
  writeText(ctx.root, rel, `${JSON.stringify({ ...pkg, scripts }, null, indent)}\n`)
  say(`${rel}: build runs \`${swapped}\` (the route tree is written before tsc reads it)`)
}

// ── DESIGN.md ───────────────────────────────────────────────────────────────────────────────────

/** The seed, only when no declared root (nor the install root) has a DESIGN.md; never at `tokens`. */
export function seedDesign(ctx: Ctx): void {
  if (ctx.args.profile === 'tokens') return
  const homes = ['.', ...ctx.args.roots, ...ctx.args.roots.map((r) => dirname(r))]
  if (homes.some((dir) => existsSync(resolve(ctx.root, dir, 'DESIGN.md')))) return
  const template = readIfExists(resolve(ctx.pkgRoot, 'agent/templates/DESIGN.md.tpl'))
  if (template === null) return void ctx.problems.push(`${ctx.pkgRoot} ships no DESIGN.md.tpl`)
  const [first = '.'] = ctx.args.roots
  const series = ctx.args.extra ?? join(first === '.' ? 'src' : first, 'basalt.tokens.ts')
  const accent = ctx.args.identity[ctx.args.identity.indexOf('--accent') + 1]
  const vars: Record<string, string> = {
    APP_NAME: appName(ctx.root),
    ACCENT_HUE: ctx.args.identity.includes('--accent') && accent !== undefined ? accent : 'blue',
    SERIES_MODULE_PATH: series,
  }
  const text = template.replace(/\{\{(\w+)\}\}/g, (all, key: string) => vars[key] ?? all)
  writeText(ctx.root, 'DESIGN.md', text)
  say('wrote DESIGN.md')
}

export function appName(root: string): string {
  const name = readPackage(root)?.name
  return name !== undefined && name !== '' ? name : basename(root)
}

// ── Vite and CSS ────────────────────────────────────────────────────────────────────────────────

const VITE_CONFIGS = ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs']
export const CSS_ENTRIES = ['index.css', 'styles.css', 'main.css', 'app.css', 'globals.css']
const BASALT_IMPORT = "import { basalt } from 'basalt-ui/vite'"
const ROUTER_IMPORT = "import { tanstackRouter } from '@tanstack/router-plugin/vite'"
const ROUTER_PLUGIN = `tanstackRouter({ target: '${ROUTER_PLUGIN_OPTIONS.target}', autoCodeSplitting: ${ROUTER_PLUGIN_OPTIONS.autoCodeSplitting} })`
const START_IMPORT = "import { tanstackStart } from '@tanstack/react-start/plugin/vite'"
const START_PLUGIN = 'tanstackStart({ router: { autoCodeSplitting: true } })'

/** The plugin that goes first in the list: the router plugin of a file-routed SPA, or Start's. */
type FirstPlugin = { import: string; call: string; present: (text: string) => boolean }
const ROUTER_FIRST: FirstPlugin = {
  import: ROUTER_IMPORT,
  call: ROUTER_PLUGIN,
  present: registersRouterPlugin,
}
const START_FIRST: FirstPlugin = {
  import: START_IMPORT,
  call: START_PLUGIN,
  present: (text) => /\btanstackStart\s*\(/.test(text),
}

/** The directories an app's build config or stylesheet entry sits in, nearest the declared roots. */
function appDirs(ctx: Ctx): string[] {
  const dirs = ctx.args.roots.flatMap((r) => [r, dirname(r)])
  return [...new Set([...dirs, '.'])]
}

const TAILWIND_IMPORT = "import tailwindcss from '@tailwindcss/vite'"

/** The `[` of `plugins: [` and its matching `]`, or null when there is not exactly one list. */
function pluginList(text: string): { open: number; close: number } | null {
  const found = [...text.matchAll(/plugins:\s*\[/g)]
  if (found.length !== 1) return null
  const open = (found[0]?.index ?? 0) + (found[0]?.[0].length ?? 0) - 1
  let depth = 0
  for (let at = open; at < text.length; at++) {
    if (text[at] === '[') depth++
    else if (text[at] === ']' && --depth === 0) return { open, close: at }
  }
  return null
}

/** The index just past the last `name(...)` call inside `[from, to)`, or -1. */
function callEnd(text: string, name: string, from: number, to: number): number {
  let end = -1
  for (const match of text.slice(from, to).matchAll(new RegExp(`\\b${name}\\(`, 'g'))) {
    let depth = 0
    for (let at = from + match.index + match[0].length - 1; at < to; at++) {
      if (text[at] === '(') depth++
      else if (text[at] === ')' && --depth === 0) {
        end = at + 1
        break
      }
    }
  }
  return end
}

/**
 * Patches `plugins: [` of a stock Vite config to the order `docs/vite.md` gives: the router plugin
 * (or `tanstackStart()`) first (it must see the routes before the React transform does), then
 * `react()`, `tailwindcss()`, `basalt()`. Any other shape returns null.
 */
function patchVite(text: string, first: FirstPlugin | null): string | null {
  const needBasalt = !text.includes('basalt(')
  const needTailwind = !/\btailwindcss\(/.test(text)
  const missing = first !== null && !first.present(text) ? first : null
  const needRouter = missing !== null
  if (!needBasalt && !needTailwind && !needRouter) return text
  const list = pluginList(text)
  if (list === null) return null
  const lines = text.split('\n')
  // The end of the last import statement: the line closing `from '...'`, or a bare side-effect import.
  const lastImport = lines.findLastIndex((l) =>
    /^import\s+['"]|\bfrom\s+['"][^'"]+['"];?\s*$/.test(l),
  )
  if (lastImport === -1) return null

  let out = text
  const tail = [...(needTailwind ? ['tailwindcss()'] : []), ...(needBasalt ? ['basalt()'] : [])]
  if (tail.length > 0) {
    const at = out.indexOf('basalt(', list.open)
    if (!needBasalt && at !== -1) {
      // basalt() already sits in the list: tailwindcss() goes right before it.
      out = `${out.slice(0, at)}tailwindcss(), ${out.slice(at)}`
    } else {
      const anchor = Math.max(
        callEnd(out, 'react', list.open, list.close),
        callEnd(out, 'viteReact', list.open, list.close),
        callEnd(out, 'tailwindcss', list.open, list.close),
      )
      if (anchor !== -1) {
        out = `${out.slice(0, anchor)}, ${tail.join(', ')}${out.slice(anchor)}`
      } else {
        const body = out.slice(list.open + 1, list.close).trimEnd()
        const sep = body.trim() === '' ? '' : body.endsWith(',') ? ' ' : ', '
        out = `${out.slice(0, list.open + 1)}${body}${sep}${tail.join(', ')}${out.slice(list.close)}`
      }
    }
  }
  if (missing !== null) {
    const empty = out
      .slice(list.open + 1)
      .trimStart()
      .startsWith(']')
    out = `${out.slice(0, list.open + 1)}${missing.call}${empty ? '' : ', '}${out.slice(list.open + 1)}`
  }
  const spliced = out.split('\n')
  spliced.splice(
    lastImport + 1,
    0,
    ...(missing === null ? [] : [missing.import]),
    ...(needTailwind ? [TAILWIND_IMPORT] : []),
    ...(needBasalt ? [BASALT_IMPORT] : []),
  )
  return spliced.join('\n')
}

/**
 * The one stylesheet entry (`docs/vite.md`, `/basalt-app`): `tailwind.css` brings in `tailwindcss`,
 * the shipped tokens and fonts; the app's own `tokens:css` output follows it so a retune wins; the
 * generated sources come last.
 */
export function stylesheetEntry(
  tokens: string | null,
  sources: string,
  extra: string | null = null,
): string {
  return [
    "@import 'basalt-ui/tailwind.css';",
    ...(tokens === null ? [] : [`@import '${tokens}';`]),
    ...(extra === null ? [] : [`@import '${extra}';`]),
    `@import '${sources}';`,
  ].join('\n')
}

/**
 * What create-vite's `src/index.css` is: no `@import`, `color-scheme: light dark` and one of the
 * template's own variables (`--code-bg`, `--social-bg`). Anything else
 * is the app's own sheet and is never overwritten.
 */
export function isStockViteCss(text: string): boolean {
  return (
    !/@import|@tailwind/.test(text) &&
    /color-scheme:\s*light dark/.test(text) &&
    /--code-bg|--social-bg/.test(text)
  )
}

const extraOutAbs = (ctx: Ctx): string | null =>
  ctx.args.extra === undefined ? null : resolve(ctx.root, extraCssOut(ctx.args))

/**
 * An entry that is already the one entry (it names tailwind.css) gains the series sheet on a re-run:
 * the import goes in front of the sources import. An entry with no sources line comes back null, so
 * the exact entry is printed instead of guessed at.
 */
function withExtraImport(
  text: string,
  extraAbs: string | null,
  rel: (abs: string) => string,
): string | null {
  if (extraAbs === null || !existsSync(extraAbs)) return text
  const sheet = rel(extraAbs)
  if (text.includes(sheet)) return text
  const sources = /^@import\s+(['"])[^'"]*\.basalt\/sources\.css\1;?[ \t]*$/m
  if (!sources.test(text)) return null
  return text.replace(sources, (line) => `@import '${sheet}';\n${line}`)
}

/** `viteRoot` is where `basalt()` writes `.basalt/sources.css`: the directory of the Vite config. */
function patchCss(
  text: string,
  cssDir: string,
  viteRoot: string,
  tokensAbs: string,
  extraAbs: string | null,
): string | null {
  const rel = (abs: string): string => {
    const path = relative(cssDir, abs).replaceAll('\\', '/')
    return path.startsWith('.') ? path : `./${path}`
  }
  if (text.includes('basalt-ui/tailwind.css')) return withExtraImport(text, extraAbs, rel)
  const stock = /^@import\s+(['"])tailwindcss\1;?[ \t]*$/m
  if (!stock.test(text) && !isStockViteCss(text)) return null
  const tokens = existsSync(tokensAbs) ? rel(tokensAbs) : null
  const extra = extraAbs !== null && existsSync(extraAbs) ? rel(extraAbs) : null
  const entry = stylesheetEntry(tokens, rel(resolve(viteRoot, '.basalt/sources.css')), extra)
  return stock.test(text) ? text.replace(stock, () => entry) : `${entry}\n`
}

/** What `basalt-ui shot --out shots-<n>` writes: a fresh directory per round, never tracked. */
export const SHOTS_IGNORE = 'shots-*/'

/**
 * `<viteDir>/.gitignore` lists `.basalt/sources.css` (regenerated on every run) and the `shot`
 * rounds (`SHOTS_IGNORE`), each once; the file is created when it is missing.
 */
function ignoreGenerated(ctx: Ctx, viteDir: string): void {
  const file = viteDir === '.' ? '.gitignore' : `${viteDir}/.gitignore`
  const text = readText(ctx.root, file) ?? ''
  const lines = text.split('\n').map((line) => line.trim())
  const add = [SOURCES_PATH, SHOTS_IGNORE].filter(
    (entry) => !lines.some((line) => line === entry || line === `/${entry}`),
  )
  if (add.length === 0) return
  const lead = text === '' || text.endsWith('\n') ? text : `${text}\n`
  if (writeText(ctx.root, file, `${lead}${add.join('\n')}\n`))
    say(`${file}: ignores ${add.join(', ')}`)
}

/** A Start app has no create-vite stylesheet: when none exists, `src/index.css` is written as the one entry. */
function seedStartCss(ctx: Ctx, vite: string): void {
  const app = resolveAppDir(ctx.root)
  const rel = 'error' in app ? 'src/index.css' : join(app.rel, 'src/index.css')
  const abs = resolve(ctx.root, rel)
  const tokensAbs = resolve(ctx.root, ctx.args.tokensOut)
  const from = (target: string): string => {
    const path = relative(dirname(abs), target).replaceAll('\\', '/')
    return path.startsWith('.') ? path : `./${path}`
  }
  const tokens = existsSync(tokensAbs) ? from(tokensAbs) : null
  const sources = from(resolve(ctx.root, dirname(vite), SOURCES_PATH))
  const extraAbs = extraOutAbs(ctx)
  const extra = extraAbs !== null && existsSync(extraAbs) ? from(extraAbs) : null
  if (writeText(ctx.root, rel, `${stylesheetEntry(tokens, sources, extra)}\n`)) {
    say(`wrote ${rel}: the one stylesheet entry (tailwind.css, tokens, sources)`)
  }
}

/** Above `tokens`: the Vite plugin and the Tailwind entry, patched only when the shape is stock. A `site` is an Astro project: its wiring is the `basalt-ui/astro` integration, named as a to-do. */
export function wireApp(ctx: Ctx): void {
  if (ctx.args.profile === 'tokens') {
    return void ctx.todo.push(`import ${ctx.args.tokensOut} in your stylesheet entry`)
  }
  if (ctx.args.profile === 'site') {
    ctx.todo.push(`import ${ctx.args.tokensOut} in your global stylesheet`)
    return void ctx.todo.push(
      'add basaltAstro() from "basalt-ui/astro" to integrations in astro.config: integrations: [react(), basaltAstro()]',
    )
  }
  const dirs = appDirs(ctx)
  const first = ctx.args.start ? START_FIRST : ctx.routerPlugin === true ? ROUTER_FIRST : null
  const vite = dirs
    .flatMap((d) => VITE_CONFIGS.map((f) => join(d, f)))
    .find((f) => existsSync(resolve(ctx.root, f)))
  const patched = vite === undefined ? null : patchVite(readText(ctx.root, vite) ?? '', first)
  if (vite !== undefined) ignoreGenerated(ctx, dirname(vite))
  if (vite !== undefined && patched !== null) {
    if (writeText(ctx.root, vite, patched)) say(`${vite}: added the Vite plugins`)
  } else {
    ctx.todo.push(
      `${BASALT_IMPORT} and ${TAILWIND_IMPORT}, then make the plugins of your Vite config [react(), tailwindcss(), basalt()] (docs/vite.md)`,
    )
    if (ctx.args.start) {
      ctx.todo.push(
        `${START_IMPORT}, then add ${START_PLUGIN} first in those plugins, before the React plugin (Start generates the route tree)`,
      )
    } else if (ctx.routerPlugin === true) {
      ctx.todo.push(
        `${ROUTER_IMPORT}, then add ${ROUTER_PLUGIN} first in those plugins (a file-routed entry imports the routeTree.gen file it writes)`,
      )
    }
  }
  const css = dirs
    .flatMap((d) => ['src', '.'].flatMap((s) => CSS_ENTRIES.map((f) => join(d, s, f))))
    .map((f) => join(f))
    .find((f) => existsSync(resolve(ctx.root, f)))
  if (css === undefined && vite !== undefined && ctx.args.start) return seedStartCss(ctx, vite)
  const cssPatched =
    css === undefined || vite === undefined
      ? null
      : patchCss(
          readText(ctx.root, css) ?? '',
          dirname(resolve(ctx.root, css)),
          dirname(resolve(ctx.root, vite)),
          resolve(ctx.root, ctx.args.tokensOut),
          extraOutAbs(ctx),
        )
  if (css !== undefined && cssPatched !== null) {
    if (writeText(ctx.root, css, cssPatched))
      say(`${css}: is the one stylesheet entry (tailwind.css, tokens, sources)`)
  } else {
    ctx.todo.push(
      `make your stylesheet entry exactly:\n${stylesheetEntry(
        `<path to>/${basename(ctx.args.tokensOut)}`,
        '<path to>/.basalt/sources.css',
        ctx.args.extra === undefined ? null : `<path to>/${basename(extraCssOut(ctx.args))}`,
      )}`,
    )
  }
}
