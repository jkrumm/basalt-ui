/**
 * The steps `init` runs, in order (docs/v3/concepts/skills-agent-layer.md section 4.1). Each takes
 * the one `Ctx`, does its part and returns; a step that cannot finish says so through `ctx.problems`
 * and the run goes on, so one failed install does not leave the files unplaced. A step is safe to
 * run twice: it writes only what differs. v3-sk-4 adds the hook step beside these.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
import { parseJsonc, readIfExists } from '../source-text'
import { sync } from '../sync'
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
}

const say = (line: string): void => console.log(line)

const readText = (root: string, rel: string): string | null => readIfExists(resolve(root, rel))

function writeText(root: string, rel: string, content: string): boolean {
  const abs = resolve(root, rel)
  if (readIfExists(abs) === content) return false
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
  return true
}

/** The nearest ancestor holding `.git` (the repo root), else `dir`. */
export function installRoot(dir: string): string {
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

/** The `tokens[]` rows this run declares; `--extra` is its own row (`tokens:css --extra` takes no identity flag). */
function tokenRows(args: Args): Manifest['tokens'] {
  const rows: Manifest['tokens'] = [{ out: args.tokensOut, format: 'css', flags: args.identity }]
  if (args.tokensJsonOut !== undefined) {
    const flags = withoutFlag(args.identity, '--selector')
    rows.push({ out: args.tokensJsonOut, format: 'json', flags: [...flags, '--format', 'json'] })
  }
  if (args.extra !== undefined) {
    const out = join(dirname(args.tokensOut), 'basalt.tokens.css')
    rows.push({ out, format: 'css', flags: ['--extra', args.extra] })
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
  }
  writeManifest(ctx.root, manifest)
  return null
}

// ── peers ───────────────────────────────────────────────────────────────────────────────────────

type PackageJson = {
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

/** The exact pins `init` installs for a profile, read from the package that ships them. */
export function peerPins(pkgRoot: string, profile: Profile): Record<string, string> {
  const own = readPackage(pkgRoot)
  const pin = (name: string, spec: string | undefined): string => {
    if (spec === undefined || !/^\d+\.\d+\.\d+$/.test(spec)) {
      throw new Error(`${pkgRoot}/package.json pins ${name} as ${spec ?? 'nothing'}, not exactly`)
    }
    return spec
  }
  const dev = own?.devDependencies ?? {}
  const pins: Record<string, string> = {
    stylelint: pin('stylelint', dev['stylelint']),
    'postcss-html': pin('postcss-html', dev['postcss-html']),
  }
  if (profile !== 'tokens') {
    pins['oxlint'] = pin(
      'oxlint',
      readShippedPreset(pkgRoot, profile).settings?.basalt?.pins?.['oxlint'],
    )
    pins['@shadcn/lint'] = pin(
      '@shadcn/lint',
      own?.peerDependencies?.['@shadcn/lint'] ?? dev['@shadcn/lint'],
    )
  }
  return pins
}

/** `add -D --exact` for the package manager the lockfile names (npm without one). */
export function installCommand(root: string, specs: string[]): string[] {
  const has = (file: string): boolean => existsSync(resolve(root, file))
  if (has('bun.lock') || has('bun.lockb')) return ['bun', 'add', '--dev', '--exact', ...specs]
  if (has('pnpm-lock.yaml')) {
    const workspace = has('pnpm-workspace.yaml') ? ['-w'] : []
    return ['pnpm', 'add', '--save-dev', '--save-exact', ...workspace, ...specs]
  }
  if (has('yarn.lock')) return ['yarn', 'add', '--dev', '--exact', ...specs]
  return ['npm', 'install', '--save-dev', '--save-exact', ...specs]
}

export function installPeers(ctx: Ctx): void {
  const pins = peerPins(ctx.pkgRoot, ctx.args.profile)
  const own = readPackage(ctx.root)
  const have = { ...own?.dependencies, ...own?.devDependencies }
  const specs = Object.entries(pins)
    .filter(([name, version]) => have[name] !== version)
    .map(([name, version]) => `${name}@${version}`)
  if (specs.length === 0) return say('peers: already at their pins.')
  const command = installCommand(ctx.root, specs)
  if (own === null || ctx.run === undefined) {
    const why = own === null ? `no package.json at ${ctx.root}` : '--no-install'
    return void ctx.todo.push(`install the peers (${why}): ${command.join(' ')}`)
  }
  say(`peers: ${command.join(' ')}`)
  if (!ctx.run(command, ctx.root)) {
    ctx.problems.push(`the peer install failed: ${command.join(' ')}`)
  }
}

// ── placement ───────────────────────────────────────────────────────────────────────────────────

/** Managed agent files, both presets and the AGENTS block, through `sync` (never a second renderer). */
export function placeManaged(ctx: Ctx): void {
  const code = sync({ pkgRoot: ctx.pkgRoot, presetFiles: presetFilesFor(ctx.pkgRoot) }, ctx.root)
  if (code !== 0) ctx.problems.push('sync could not place the managed files')
}

/** `.basalt/budget.json` once: a ceiling only moves through `eject --raise`, never through `init`. */
export function seedBudgetFile(ctx: Ctx): void {
  if (existsSync(resolve(ctx.root, BUDGET_PATH))) return
  writeBudget(ctx.root, seedBudget(ctx.args.profile))
  say(`wrote ${BUDGET_PATH}`)
}

// ── formatter ignore ────────────────────────────────────────────────────────────────────────────

/** What a formatter must not touch: the ledger, the managed agent files and both generated presets. */
export const FORMATTER_IGNORE = [
  '.basalt/**',
  '.claude/**',
  OXLINT_PRESET_FILE,
  STYLELINT_PRESET_FILE,
] as const

function ignoreFile(ctx: Ctx): void {
  const missing = (text: string): string[] =>
    FORMATTER_IGNORE.filter((p) => !text.split('\n').some((line) => line.trim() === p))
  const prettier = readText(ctx.root, '.prettierignore')
  const oxfmt = readText(ctx.root, '.oxfmtrc.json')
  const prettierDep = readPackage(ctx.root)?.devDependencies?.['prettier'] !== undefined

  if (oxfmt === null && (prettier !== null || prettierDep)) {
    const text = prettier ?? ''
    const add = missing(text)
    if (add.length === 0) return
    const lead = text === '' || text.endsWith('\n') ? text : `${text}\n`
    writeText(ctx.root, '.prettierignore', `${lead}${add.join('\n')}\n`)
    return say(`.prettierignore: ignores ${add.join(', ')}`)
  }

  if (oxfmt === null) {
    writeText(
      ctx.root,
      '.oxfmtrc.json',
      `${JSON.stringify({ ignorePatterns: FORMATTER_IGNORE }, null, 2)}\n`,
    )
    return say('wrote .oxfmtrc.json (ignorePatterns for the managed paths)')
  }
  const config = parseJsonc(oxfmt)
  const listed = Array.isArray(config?.['ignorePatterns'])
    ? (config['ignorePatterns'] as string[])
    : []
  const add = FORMATTER_IGNORE.filter((p) => !listed.includes(p))
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

/** The consumer's own `.oxlintrc.json` extends the generated preset, or the preset is dead weight. */
function oxlintExtends(ctx: Ctx): void {
  const line = `./${OXLINT_PRESET_FILE}`
  const text = readText(ctx.root, '.oxlintrc.json')
  if (text === null) {
    writeText(ctx.root, '.oxlintrc.json', `${JSON.stringify({ extends: [line] }, null, 2)}\n`)
    return say('wrote .oxlintrc.json (extends the basalt preset)')
  }
  const config = parseJsonc(text)
  const extended = Array.isArray(config?.['extends']) ? (config['extends'] as string[]) : []
  if (extended.some((p) => basename(p) === OXLINT_PRESET_FILE)) return
  if (config === null || !isStrictJson(text)) {
    return void ctx.todo.push(`add "${line}" to "extends" in .oxlintrc.json`)
  }
  writeText(
    ctx.root,
    '.oxlintrc.json',
    `${JSON.stringify({ ...config, extends: [line, ...extended] }, null, 2)}\n`,
  )
  say(`.oxlintrc.json: extends ${line}`)
}

export function wireFormatterAndLint(ctx: Ctx): void {
  ignoreFile(ctx)
  if (ctx.args.profile !== 'tokens') oxlintExtends(ctx)
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
    APP_NAME: readPackage(ctx.root) === null ? basename(ctx.root) : appName(ctx.root),
    ACCENT_HUE: ctx.args.identity.includes('--accent') && accent !== undefined ? accent : 'blue',
    SERIES_MODULE_PATH: series,
  }
  const text = template.replace(/\{\{(\w+)\}\}/g, (all, key: string) => vars[key] ?? all)
  writeText(ctx.root, 'DESIGN.md', text)
  say('wrote DESIGN.md')
}

function appName(root: string): string {
  const name = (
    JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { name?: string }
  ).name
  return name !== undefined && name !== '' ? name : basename(root)
}

// ── Vite and CSS ────────────────────────────────────────────────────────────────────────────────

const VITE_CONFIGS = ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs']
const CSS_ENTRIES = ['index.css', 'styles.css', 'main.css', 'app.css', 'globals.css']
const BASALT_IMPORT = "import { basalt } from 'basalt-ui/vite'"

/** The directories an app's build config or stylesheet entry sits in, nearest the declared roots. */
function appDirs(ctx: Ctx): string[] {
  const dirs = ctx.args.roots.flatMap((r) => [r, dirname(r)])
  return [...new Set([...dirs, '.'])]
}

/** Patches `plugins: [` of a stock Vite config; any other shape returns false. */
function patchVite(text: string): string | null {
  if (text.includes('basalt(')) return text
  if ((text.match(/plugins:\s*\[/g) ?? []).length !== 1) return null
  const lines = text.split('\n')
  // The end of the last import statement: the line closing `from '...'`, or a bare side-effect import.
  const lastImport = lines.findLastIndex((l) =>
    /^import\s+['"]|\bfrom\s+['"][^'"]+['"];?\s*$/.test(l),
  )
  if (lastImport === -1) return null
  lines.splice(lastImport + 1, 0, BASALT_IMPORT)
  return lines.join('\n').replace(/plugins:\s*\[/, 'plugins: [basalt(), ')
}

/** Replaces the one `@import 'tailwindcss'` line of a stock entry with the basalt pair. */
/** `viteRoot` is where `basalt()` writes `.basalt/sources.css`: the directory of the Vite config. */
function patchCss(text: string, cssDir: string, viteRoot: string): string | null {
  if (text.includes('basalt-ui/tailwind.css')) return text
  const stock = /^@import\s+(['"])tailwindcss\1;?[ \t]*$/m
  if (!stock.test(text)) return null
  const sources = relative(cssDir, resolve(viteRoot, '.basalt/sources.css')).replaceAll('\\', '/')
  return text.replace(stock, `@import 'basalt-ui/tailwind.css';\n@import '${sources}';`)
}

/** Above `tokens`: the Vite plugin and the Tailwind entry, patched only when the shape is stock. */
export function wireApp(ctx: Ctx): void {
  if (ctx.args.profile === 'tokens') {
    return void ctx.todo.push(`import ${ctx.args.tokensOut} in your stylesheet entry`)
  }
  const dirs = appDirs(ctx)
  const vite = dirs
    .flatMap((d) => VITE_CONFIGS.map((f) => join(d, f)))
    .find((f) => existsSync(resolve(ctx.root, f)))
  const patched = vite === undefined ? null : patchVite(readText(ctx.root, vite) ?? '')
  if (vite !== undefined && patched !== null) {
    if (writeText(ctx.root, vite, patched)) say(`${vite}: added basalt()`)
  } else {
    ctx.todo.push(`${BASALT_IMPORT}, then add basalt() to the plugins of your Vite config`)
  }
  const css = dirs
    .flatMap((d) => ['src', '.'].flatMap((s) => CSS_ENTRIES.map((f) => join(d, s, f))))
    .map((f) => join(f))
    .find((f) => existsSync(resolve(ctx.root, f)))
  const cssPatched =
    css === undefined || vite === undefined
      ? null
      : patchCss(
          readText(ctx.root, css) ?? '',
          dirname(resolve(ctx.root, css)),
          dirname(resolve(ctx.root, vite)),
        )
  if (css !== undefined && cssPatched !== null) {
    if (writeText(ctx.root, css, cssPatched)) say(`${css}: imports basalt-ui/tailwind.css`)
  } else {
    ctx.todo.push(
      "in your stylesheet entry: @import 'basalt-ui/tailwind.css'; and @import '<path to>/.basalt/sources.css';",
    )
  }
}
