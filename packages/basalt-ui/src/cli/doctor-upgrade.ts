/**
 * `doctor`'s 2.0 strictness and upgrade checks. Each returns null (pass), `{ fail }` (the problem
 * plus its fix) or `{ skip }` (the check could not run: a check that cannot run is not a pass).
 */
import { existsSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'

import { BASALT_CONFIG_KEYS, RETIRED_CONFIG_KEYS } from './config'
import type { BasaltConfig } from './config'
import { isStartApp, parseJsonc, readIfExists, readPackageJson, scannableFiles } from './index'
import type { BasaltInstall } from './index'

export type Check = { fail: string } | { skip: string } | null

/** Any throw (EISDIR, EACCES, a racing delete) means the check could not run, never that it passed. */
const guarded = (id: string, run: () => Check): Check => {
  try {
    return run()
  } catch (error) {
    return { skip: `${id}: cannot run (${(error as Error).message}).` }
  }
}

/** A check that reads the resolved install: skips when basalt-ui does not resolve. */
const withInstall = (
  id: string,
  install: BasaltInstall,
  reads: string,
  run: (dir: string) => Check,
): Check => {
  const { dir } = install
  return dir === null
    ? { skip: `${id}: basalt-ui does not resolve, so its ${reads} cannot be read.` }
    : guarded(id, () => run(dir))
}

const TSCONFIG_PRESET = /(?:^|\/)basalt-ui\/configs\/tsconfig\.(?:base|react-app)\.json$/
const TSCONFIG_PRESET_ID = 'basalt-ui/configs/tsconfig.react-app.json'
const TSCONFIG_FIX = `"extends": "${TSCONFIG_PRESET_ID}" (tsconfig.base.json for a package without a DOM)`
const MAX_EXTENDS_DEPTH = 8

/** A reference path is a tsconfig file or the directory holding one. */
export const tsconfigFile = (p: string): string =>
  p.endsWith('.json') ? p : resolve(p, 'tsconfig.json')

/** Bare `extends` specifier resolved by node resolution from `dir`, or null. */
function resolveBare(spec: string, dir: string): string | null {
  const from = createRequire(resolve(dir, 'x.js'))
  for (const candidate of [spec, `${spec}.json`, `${spec}/tsconfig.json`]) {
    try {
      return from.resolve(candidate)
    } catch {
      // try the next spelling
    }
  }
  return null
}

/**
 * True when `file` extends a shipped tsconfig preset, directly, through a local or package
 * `extends`, or through a `references` entry. What cannot be read, parsed or resolved goes to
 * `unknown`: it decides nothing, so the caller skips rather than failing.
 */
function extendsPreset(file: string, unknown: string[], seen: string[] = []): boolean {
  if (seen.includes(file)) return false
  const text = readIfExists(file)
  const parsed = text === null ? null : parseJsonc(text)
  if (parsed === null) {
    unknown.push(`could not ${text === null ? 'read' : 'parse'} ${file}`)
    return false
  }
  const extended = [parsed['extends']].flat().filter((e): e is string => typeof e === 'string')
  if (extended.some((e) => TSCONFIG_PRESET.test(e))) return true
  if (seen.length >= MAX_EXTENDS_DEPTH) return false
  const refs = Array.isArray(parsed['references']) ? (parsed['references'] as unknown[]) : []
  const next = [
    ...extended.flatMap((e) => {
      if (e.startsWith('.')) return [resolve(dirname(file), e.endsWith('.json') ? e : `${e}.json`)]
      const found = resolveBare(e, dirname(file))
      if (found === null) unknown.push(`cannot resolve extends ${e}`)
      return found === null ? [] : [found]
    }),
    ...refs.flatMap((r) => {
      const path = (r as { path?: unknown } | null)?.path
      return typeof path === 'string' ? [tsconfigFile(resolve(dirname(file), path))] : []
    }),
  ]
  return next.some((f) => extendsPreset(f, unknown, [...seen, file]))
}

/** `tsconfig-base`: the app's tsconfig must extend the preset the 2.0 types assume. */
export function tsconfigBaseCheck(cwd: string): Check {
  return guarded('tsconfig-base', () => {
    const file = resolve(cwd, 'tsconfig.json')
    if (readIfExists(file) === null) {
      return { fail: `tsconfig-base: tsconfig.json missing. Fix: create it with ${TSCONFIG_FIX}.` }
    }
    const unknown: string[] = []
    if (extendsPreset(file, unknown)) return null
    if (unknown.length > 0) {
      const why = [...new Set(unknown)].join('; ')
      return {
        skip: `tsconfig-base: ${why}, so whether tsconfig.json reaches the preset is unknown.`,
      }
    }
    return {
      fail:
        'tsconfig-base: tsconfig.json (and the configs it references) does not extend the shipped ' +
        'preset — the 2.0 types assume strict, exactOptionalPropertyTypes and ' +
        `noUncheckedIndexedAccess. Fix: set ${TSCONFIG_FIX}.`,
    }
  })
}

const CHARTS_FIX =
  'charts moved to basalt-ui/charts; basalt/chart-engine-boundary replaces it. Delete the entry'
const RETIRED_FIX: Record<string, string> = {
  // The four 2.0 removals go live when #163 adds them to the plugin's RETIRED_RULE_IDS.
  'provider-above-router': 'BasaltProvider mounts the router; delete the entry',
  'page-bar-budget': 'the PageBarActions/SectionActions tuple types enforce it; delete the entry',
  'agent-resume-guard': 'useChat/Chat are banned outright; delete the entry',
  'deprecated-export': '2.0 ships no deprecations; delete the entry',
  ...Object.fromEntries(
    [
      'unframed-chart',
      'visx-boundary',
      'visx-tooltip',
      'hand-rolled-plot',
      'chart-legend-literal',
      'raw-visx-axis',
      'chart-missing-aria-label',
    ].map((id) => [id, CHARTS_FIX]),
  ),
}

/**
 * Ids from `basalt/<id>` keys in `file`'s `rules` and `overrides[].rules`, following local extends
 * (never into node_modules: a consumer's own files are what doctor judges).
 */
function basaltRuleIds(file: string, seen = new Set<string>()): string[] {
  const text = seen.has(file) ? null : readIfExists(file)
  const parsed = text === null ? null : parseJsonc(text)
  if (parsed === null) return []
  seen.add(file)
  const overrides = Array.isArray(parsed['overrides']) ? (parsed['overrides'] as unknown[]) : []
  const rules = [parsed['rules'], ...overrides.map((o) => (o as { rules?: unknown } | null)?.rules)]
  const ids = rules.flatMap((b) =>
    typeof b === 'object' && b !== null
      ? Object.keys(b).filter((k) => k.startsWith('basalt/'))
      : [],
  )
  const local = [parsed['extends']]
    .flat()
    .filter((e): e is string => typeof e === 'string' && e.startsWith('.'))
    .map((e) => resolve(dirname(file), e))
    .filter((abs) => !abs.includes('node_modules'))
  return [...ids.map((k) => k.slice(7)), ...local.flatMap((abs) => basaltRuleIds(abs, seen))]
}

/** `retired-lint-rules`: `basalt/<id>` entries the installed plugin no longer registers. */
export function retiredLintRulesCheck(cwd: string, install: BasaltInstall): Check {
  const id = 'retired-lint-rules'
  return withInstall(id, install, 'plugin', (dir) => {
    const ids = [...new Set(basaltRuleIds(resolve(cwd, '.oxlintrc.json')))]
    if (ids.length === 0) return null
    const pluginPath = resolve(dir, 'configs/oxlint-plugin.js')
    const plugin = createRequire(pluginPath)(pluginPath) as {
      RETIRED_RULE_IDS?: Set<string>
      default?: { rules?: Record<string, unknown> }
    }
    const retired = new Set(plugin.RETIRED_RULE_IDS)
    const registered = new Set(Object.keys(plugin.default?.rules ?? {}))
    if (registered.size === 0) {
      return { skip: `${id}: ${pluginPath} registers no rules, so none can be compared.` }
    }
    const gone = ids.filter((rule) => retired.has(rule) || !registered.has(rule))
    if (gone.length === 0) return null
    const named = gone.map((r) => `basalt/${r} (${RETIRED_FIX[r] ?? 'retired; delete the entry'})`)
    return {
      fail: `${id}: .oxlintrc.json sets rules the installed plugin does not register: ${named.join('; ')}. Fix: delete each entry (MIGRATING.md § 2.0).`,
    }
  })
}

/**
 * Strings and template literals (captured) and comments. Known, accepted gap: a regex literal that
 * contains a quote (`/'/`) opens a string this tokenizer never closes, which can blank or hide code
 * after it on that line; a template literal nested inside a `${…}` is not tracked either.
 */
const TOKEN =
  /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g

/**
 * A `basalt-ui/<subpath>` specifier in statement position: `import … from`, `import type … from`
 * (also split over lines), `export … from`, bare `import '…'`, `import('…')` and `require('…')`
 * (never a method call like `obj.require(…)`).
 */
const SUBPATH_IMPORT =
  /(?:(?:^|;)[ \t]*(?:(?:import|export)\b[^'"`;]*?\bfrom|import)\s*|(?<![.\w$])(?:import|require)\s*\(\s*)(['"])basalt-ui\/([^'"]+)\1/gm

/** Source with comments blanked (and template text), plus a test for "offset sits inside a string". */
function tokenize(src: string): { code: string; inLiteral: (at: number) => boolean } {
  const literals: [number, number][] = []
  const code = src.replace(TOKEN, (m, literal: string | undefined, at: number) => {
    if (literal === undefined) return m.replace(/[^\n]/g, ' ')
    if (!literal.startsWith('`')) {
      literals.push([at, at + m.length])
      return m
    }
    // Template literal: blank the text, keep the delimiters and the `${…}` code scannable.
    return m.replace(
      /(\$\{[^}]*\})|[^\n`]/g,
      (c, interpolation: string | undefined) => interpolation ?? ' ',
    )
  })
  return { code, inLiteral: (at) => literals.some(([from, to]) => at >= from && at < to) }
}

/** `[subpath, line]` per `basalt-ui/<subpath>` import that sits in code, not in a comment or literal. */
function basaltImports(src: string): [string, number][] {
  const { code, inLiteral } = tokenize(src)
  return [...code.matchAll(SUBPATH_IMPORT)]
    .filter((m) => !inLiteral(m.index))
    .map((m) => [m[2] as string, code.slice(0, m.index + m[0].length).split('\n').length])
}

/** `@import 'basalt-ui/x'`, `@import "basalt-ui/x"`, `@import url(basalt-ui/x)` in a stylesheet (at-rule position only). */
const CSS_SUBPATH_IMPORT = /(?:^|[;{}])\s*@import\s+(?:url\(\s*)?(['"]?)basalt-ui\/([^'")\s;]+)\1/g

/** `[subpath, line]` per `basalt-ui/<subpath>` `@import` in a stylesheet (comments blanked). */
function cssImports(src: string): [string, number][] {
  const blank = (m: string): string => m.replace(/[^\n]/g, ' ')
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    // A quoted string that is not an @import/url() target is a value: `content: "a; @import …"`.
    .replace(/(@import\s+|url\(\s*)?(["'])(?:\\.|(?!\2)[^\\\n])*\2/g, (m, target) =>
      target === undefined ? blank(m) : m,
    )
  return [...code.matchAll(CSS_SUBPATH_IMPORT)].map((m) => [
    m[2] as string,
    code.slice(0, m.index + m[0].length).split('\n').length,
  ])
}

/** `[subpath, file, line]` per `basalt-ui/<subpath>` import in the app's source and style files. */
const appImports = (cwd: string, cfg: BasaltConfig): [string, string, number][] =>
  scannableFiles(cwd, cfg).flatMap((rel) => {
    const isCode = /\.(?:[cm]?[jt]sx?|vue|astro)$/.test(rel)
    if (!isCode && !rel.endsWith('.css')) return []
    const src = readIfExists(resolve(cwd, rel)) ?? ''
    return (isCode ? basaltImports(src) : cssImports(src)).map(
      ([sub, line]): [string, string, number] => [sub, rel, line],
    )
  })

/** Subpaths 2.x removed, checked besides the install's `exports`: a walked-up 1.x install exports them. */
const DROPPED_FIXES = new Map([
  [
    'tokens.css',
    'commit the emit instead: `basalt-ui tokens:css --out src/tokens.css` and import that file',
  ],
  [
    'router-tanstack',
    'nav symbols (`defineNav`, `navTarget`, …) now import from `basalt-ui`, stores (`createSearchStore`, `field`, …) from `basalt-ui/state`',
  ],
])

/** `dropped-subpaths`: `basalt-ui/<subpath>` imports the installed `exports` map does not have. */
export function droppedSubpathsCheck(
  cwd: string,
  cfg: BasaltConfig,
  install: BasaltInstall,
): Check {
  const id = 'dropped-subpaths'
  return withInstall(id, install, 'exports', (dir) => {
    const pkg = readPackageJson<{ exports?: Record<string, unknown> }>(dir)
    if (pkg === null) throw new Error(`${dir}/package.json is unreadable`)
    const exportsMap = pkg.exports
    // No `exports` field means nothing restricts the deep imports.
    if (exportsMap === undefined) return null
    const keys = Object.keys(exportsMap)
    const hasExport = (sub: string): boolean =>
      keys.some(
        (k) => k === `./${sub}` || (k.endsWith('*') && `./${sub}`.startsWith(k.slice(0, -1))),
      )
    const isDropped = (sub: string): boolean => DROPPED_FIXES.has(sub) || !hasExport(sub)
    const found = appImports(cwd, cfg).filter(([sub]) => isDropped(sub))
    if (found.length === 0) return null
    const hits = found.map(([sub, rel, line]) => `${rel}:${line} imports basalt-ui/${sub}`)
    const more = hits.length > 10 ? ` (+${hits.length - 10} more)` : ''
    const fixes = [...new Set(found.map(([sub]) => sub))].flatMap((sub) => {
      const fix = DROPPED_FIXES.get(sub)
      return fix === undefined ? [] : [`basalt-ui/${sub}: ${fix}`]
    })
    fixes.push("see MIGRATING.md § 2.0 for each subpath's replacement")
    return { fail: `${id}: ${hits.slice(0, 10).join('; ')}${more}. Fix: ${fixes.join('; ')}.` }
  })
}

/** The oldest oxlint that parses the shipped preset (1.78 lacks `react/globals` and friends). */
const OXLINT_FLOOR = '1.79.0'

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(-[^+]+)?(?:\+.*)?$/

/** True when `version` is below `floor`; a prerelease of the floor is below it, build metadata is ignored. */
function isBelowFloor(version: string, floor: string): boolean {
  const [v, f] = [SEMVER.exec(version), SEMVER.exec(floor)]
  if (v === null || f === null) return false
  for (const i of [1, 2, 3]) {
    if (Number(v[i]) !== Number(f[i])) return Number(v[i]) < Number(f[i])
  }
  return v[4] !== undefined
}

/**
 * `oxlint-floor`: fails when the nearest installed oxlint is older than {@link OXLINT_FLOOR}, which
 * cannot parse the preset. Reads `cwd`, as `oxlint-preset` does; a missing oxlint is that check's job.
 */
export function oxlintFloorCheck(cwd: string): Check {
  const id = 'oxlint-floor'
  return guarded(id, () => {
    if (readIfExists(resolve(cwd, '.oxlintrc.json')) === null) return null
    const version = installedVersion(cwd, 'oxlint')
    if (version === null || !isBelowFloor(version, OXLINT_FLOOR)) return null
    return {
      fail: `${id}: oxlint ${version} is installed, but the shipped preset needs >= ${OXLINT_FLOOR} (older versions reject its react/* rules). Fix: \`bun add -D oxlint@^${OXLINT_FLOOR}\`.`,
    }
  })
}

/** True when a tsconfig's `include` or `files` names the `src` tree (`src`, `./src`, `src/**`, …). */
const includesSrc = (config: Record<string, unknown> | null): boolean =>
  [config?.['include'], config?.['files']].some(
    (list) =>
      Array.isArray(list) &&
      list.some((e) => typeof e === 'string' && /^(?:\.\/)?src(?:\/|$)/.test(e)),
  )

/**
 * `init`'s tsconfig step: make the tsconfig that covers `src` (`tsconfig.json`, or the reference that
 * includes `src` in a stock Vite app) extend the preset, by inserting the key textually (the file is
 * JSONC, possibly with a BOM). Never creates one. Returns the line to print, or null when nothing
 * needs saying.
 */
export function seedTsconfigExtends(cwd: string): string | null {
  const root = resolve(cwd, 'tsconfig.json')
  const rootText = readIfExists(root)
  if (rootText === null || tsconfigBaseCheck(cwd) === null) return null
  const refs = parseJsonc(rootText)?.['references']
  const covering = (Array.isArray(refs) ? (refs as unknown[]) : [])
    .map((r) => (r as { path?: unknown } | null)?.path)
    .flatMap((path) => (typeof path === 'string' ? [tsconfigFile(resolve(cwd, path))] : []))
    .find((f) => includesSrc(parseJsonc(readIfExists(f) ?? 'null')))
  const files = parseJsonc(rootText)?.['files']
  if (
    covering === undefined &&
    Array.isArray(refs) &&
    refs.length > 0 &&
    Array.isArray(files) &&
    files.length === 0
  ) {
    return `tsconfig.json is a solution-style config and no referenced config includes src — set ${TSCONFIG_FIX} in the one that covers src.`
  }
  const target = covering ?? root
  const text = readIfExists(target) ?? ''
  const name = relative(cwd, target)
  const parsed = parseJsonc(text)
  if (parsed === null) return `${name} does not parse — set ${TSCONFIG_FIX} by hand.`
  if (parsed['extends'] !== undefined) {
    return `${name} already extends something else — make it also extend ${TSCONFIG_FIX}.`
  }
  const open = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*\{/.exec(text)
  if (open === null) return `${name} is not a JSON object — set ${TSCONFIG_FIX} by hand.`
  const comma = Object.keys(parsed).length > 0 ? ',' : ''
  const at = open[0].length
  const key = `\n  "extends": "${TSCONFIG_PRESET_ID}"${comma}`
  writeFileSync(target, `${text.slice(0, at)}${key}${text.slice(at)}`)
  return `added "extends": "${TSCONFIG_PRESET_ID}" to ${name}.`
}

const VITE_CONFIGS = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map((e) => `vite.config.${e}`)
const SEED_HINT = 'node_modules/basalt-ui/agent/templates/main.tpl'
const ROUTER_PLUGIN_FIX =
  "Fix: `bun add -D @tanstack/router-plugin`, add `tanstackRouter({ target: 'react', autoCodeSplitting: true })` " +
  "from '@tanstack/router-plugin/vite' to `plugins` in vite.config.ts (before react()), then run vite once " +
  'to generate src/routeTree.gen.ts.'

/** The first local `<script type="module" src>` in index.html (comments and remote src skipped). */
function htmlEntry(html: string): string | undefined {
  for (const [, attrs = ''] of html
    .replace(/<!--[\s\S]*?-->/g, '')
    .matchAll(/<script\b([^>]*)>/gi)) {
    const src = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]
    if (
      /\btype\s*=\s*["']?module\b/i.test(attrs) &&
      src !== undefined &&
      !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(src)
    ) {
      return src
    }
  }
  return undefined
}

/** True when `code` calls a binding imported from `@tanstack/router-plugin` inside `plugins`. */
function registersRouterPlugin(src: string): boolean {
  const { code, inLiteral } = tokenize(src)
  const pluginsAt = [...code.matchAll(/\bplugins\b/g)].find((m) => !inLiteral(m.index))?.index
  if (pluginsAt === undefined) return false
  const imports = code.matchAll(
    /(?:^|;)[ \t]*import\s+(?:type\s+)?([^'"`;]*?)\s*from\s*(['"])@tanstack\/router-plugin(?:\/[^'"]*)?\2/gm,
  )
  return [...imports].some((m) => {
    if (inLiteral(m.index)) return false
    const names = (m[1] ?? '')
      .replace(/[{}]/g, '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '' && !/^type\s/.test(part))
      .map((part) => part.split(/\s+as\s+/).pop() as string)
    return names.some((name) =>
      [
        ...code.matchAll(
          new RegExp(`(?<![.\\w$])${name.replace(/\$/g, '\\$')}(?:\\.\\w+)?\\s*\\(`, 'g'),
        ),
      ].some((call) => call.index > pluginsAt && !inLiteral(call.index)),
    )
  })
}

const RELATIVE_IMPORT =
  /(?:\b(?:import|export)\b[^'";]*?\bfrom|\bimport)\s*['"](\.{1,2}\/[^'"]+)['"]/g

/** The source file a relative specifier names: as written, `.ts`/`.tsx` appended, or a directory index. */
function resolveRelative(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec.replace(/\.[jt]sx?$/, ''))
  return (
    [
      resolve(dirname(from), spec),
      `${base}.ts`,
      `${base}.tsx`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
    ].find((f) => /\.[jt]sx?$/.test(f) && existsSync(f)) ?? null
  )
}

/**
 * Whether a module the entry imports (relative imports, three deep) calls `createBasaltRouter` —
 * the router often lives in a singleton module other code also imports.
 */
function routerCreatedInImports(cwd: string, entry: string): boolean {
  const seen = new Set([resolve(cwd, entry)])
  let frontier = [...seen]
  for (let depth = 0; depth < 3 && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const file of frontier) {
      for (const m of (readIfExists(file) ?? '').matchAll(RELATIVE_IMPORT)) {
        const dep = resolveRelative(file, m[1] ?? '')
        if (dep === null || seen.has(dep)) continue
        seen.add(dep)
        const { code, inLiteral } = tokenize(readIfExists(dep) ?? '')
        const called = [...code.matchAll(/\bcreateBasaltRouter\b/g)].some(
          (c) => !inLiteral(c.index),
        )
        if (called) return true
        next.push(dep)
      }
    }
    frontier = next
  }
  return false
}

/** A Start app owns its router and entry: the wiring is `<BasaltProvider>` in its root route. */
function startWiring(cwd: string): { fail: string } | null {
  const root = 'src/routes/__root.tsx'
  const text = readIfExists(resolve(cwd, root))
  const { code, inLiteral } = tokenize(text ?? '')
  const mounted = [...code.matchAll(/\bBasaltProvider\b/g)].some((m) => !inLiteral(m.index))
  if (mounted) return null
  return {
    fail:
      `app-wiring: ${root} ${text === null ? 'does not exist' : 'does not use BasaltProvider'} ` +
      '(TanStack Start app). Fix: render <BasaltProvider>{children}</BasaltProvider> in the root route.',
  }
}

/**
 * `app-wiring`: the entry module `index.html` loads (default src/main.tsx) mounts `BasaltProvider`
 * on a `createBasaltRouter` router (called in the entry or a module it imports), and the router tree is generated: the vite config calls a
 * binding imported from `@tanstack/router-plugin` in `plugins`, or a `routeTree.gen.*` already sits
 * beside the entry (or in src/). `basaltViteConfig` does not register that plugin, so naming it
 * proves nothing.
 */
export function appWiringCheck(cwd: string): Check {
  return guarded('app-wiring', () => {
    if (isStartApp(cwd, '')) return startWiring(cwd)
    const entry = (
      htmlEntry(readIfExists(resolve(cwd, 'index.html')) ?? '') ?? 'src/main.tsx'
    ).replace(/^\//, '')
    const text = readIfExists(resolve(cwd, entry))
    if (text === null) {
      return { fail: `app-wiring: ${entry} does not exist. Fix: make it match ${SEED_HINT}.` }
    }
    const { code, inLiteral } = tokenize(text)
    const used = (name: string): boolean =>
      [...code.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].some((m) => !inLiteral(m.index))
    const missing = ['BasaltProvider', 'createBasaltRouter'].filter(
      (name) =>
        !used(name) && !(name === 'createBasaltRouter' && routerCreatedInImports(cwd, entry)),
    )
    if (missing.length > 0) {
      return {
        fail:
          `app-wiring: ${entry} does not use ${missing.join(' or ')}. ` +
          `Fix: make it match ${SEED_HINT} (\`init\` seeds it only when the file is absent).`,
      }
    }
    const vite =
      VITE_CONFIGS.map((f) => readIfExists(resolve(cwd, f))).find((t) => t !== null) ?? ''
    const dirs = [...new Set([dirname(entry), 'src'])]
    const generated = dirs.some((d) =>
      ['ts', 'tsx', 'js'].some((e) => existsSync(resolve(cwd, d, `routeTree.gen.${e}`))),
    )
    if (generated || registersRouterPlugin(vite)) return null
    return {
      fail: `app-wiring: no vite.config calls the TanStack router plugin and ${dirs.join(' or ')}/routeTree.gen.ts does not exist. ${ROUTER_PLUGIN_FIX}`,
    }
  })
}

/**
 * `config-keys`: a key in package.json's `basalt` object that `BasaltConfig` does not declare is
 * silently ignored, so a key retired in 2.0 keeps looking configured. Reads the raw file, not
 * `readBasaltConfig`, which is typed and would hide the very keys this looks for.
 */
export function unknownConfigKeysCheck(cwd: string): Check {
  return guarded('config-keys', () => {
    const block = readPackageJson<{ basalt?: unknown }>(cwd)?.basalt
    if (typeof block !== 'object' || block === null || Array.isArray(block)) return null
    const known = new Set<string>(BASALT_CONFIG_KEYS)
    const unknown = Object.keys(block).filter((k) => !known.has(k))
    if (unknown.length === 0) return null
    const named = unknown.map(
      (k) => `basalt.${k} (${RETIRED_CONFIG_KEYS[k] ?? 'not a basalt key'})`,
    )
    return {
      fail: `config-keys: package.json sets keys basalt-ui does not read: ${named.join('; ')}. Fix: delete each key.`,
    }
  })
}

/** The `peerDependencies` ranges declared by the package installed at `dir`. */
function peerRanges(dir: string): Record<string, string> {
  return readPackageJson<{ peerDependencies?: Record<string, string> }>(dir)?.peerDependencies ?? {}
}

const EXACT_VERSION = /^\d+\.\d+\.\d+$/

/** `node_modules/<pkg>/package.json`'s version, searching `cwd` then every ancestor. */
function installedVersion(cwd: string, pkg: string): string | null {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const manifest = readPackageJson<{ version?: string }>(resolve(dir, 'node_modules', pkg))
    if (manifest !== null) return typeof manifest.version === 'string' ? manifest.version : null
    if (dirname(dir) === dir) return null
  }
}

/**
 * `exact-peers`: basalt-ui pins some peers to one exact version, and `bun add` accepts any other
 * version without a word. Compares each installed one against the install's declared pin; a peer
 * that is not installed is not this check's business (optional peers are legitimately absent).
 */
export function exactPeersCheck(cwd: string, install: BasaltInstall): Check {
  const id = 'exact-peers'
  return withInstall(id, install, 'peers', (dir) => {
    const off = Object.entries(peerRanges(dir))
      .filter(([, range]) => EXACT_VERSION.test(range))
      .flatMap(([pkg, pin]) => {
        const have = installedVersion(cwd, pkg)
        return have === null || have === pin
          ? []
          : [`${pkg}@${have} (basalt-ui pins ${pin}): \`bun add ${pkg}@${pin}\``]
      })
    if (off.length === 0) return null
    return {
      fail: `${id}: installed peers differ from basalt-ui's exact pins. Fix: ${off.join('; ')}.`,
    }
  })
}

/**
 * The peers a subpath needs installed: V2-SPEC § 1's subpath-required class plus `./content`'s
 * shiki trio, which a bundler cannot resolve without them (argo friction row 15). The test pins it
 * to `package.json` and `surfaces.ts`.
 */
export const SUBPATH_REQUIRED_PEERS: Readonly<Record<string, readonly string[]>> = {
  agent: ['ai', '@ai-sdk/provider', 'motion'],
  charts: ['@tanstack/charts', 'd3-scale'],
  commands: ['@tanstack/react-hotkeys'],
  content: ['react-markdown', 'shiki', '@shikijs/langs', '@shikijs/themes'],
  'controls-dates': ['@mantine/dates', 'dayjs'],
  forms: ['@mantine/form'],
  table: ['@tanstack/react-table'],
}

/**
 * `subpath-peers`: every `basalt-ui/<subpath>` the app imports has its required peers installed. A
 * missing one still builds, then throws "Could not resolve" when the chunk loads.
 */
export function subpathPeersCheck(cwd: string, cfg: BasaltConfig, install: BasaltInstall): Check {
  const id = 'subpath-peers'
  return withInstall(id, install, 'peers', (dir) => {
    const missing = new Map<string, string[]>()
    for (const [sub, file] of new Map(
      appImports(cwd, cfg)
        .toReversed()
        .map(([s, f]) => [s, f]),
    )) {
      for (const peer of SUBPATH_REQUIRED_PEERS[sub] ?? []) {
        if (installedVersion(cwd, peer) !== null) continue
        missing.set(peer, [...(missing.get(peer) ?? []), `basalt-ui/${sub} (${file})`])
      }
    }
    if (missing.size === 0) return null
    const ranges = peerRanges(dir)
    const named = [...missing].map(([peer, by]) => `${peer} for ${by.join(', ')}`)
    const add = [...missing.keys()].map((peer) => (ranges[peer] ? `${peer}@${ranges[peer]}` : peer))
    return {
      fail: `${id}: peers a used basalt-ui subpath requires are not installed: ${named.join('; ')}. Fix: \`bun add ${add.join(' ')}\`.`,
    }
  })
}
