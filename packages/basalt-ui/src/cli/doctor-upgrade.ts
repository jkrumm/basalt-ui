/**
 * `doctor`'s 2.0 strictness and upgrade checks. Each returns null (pass), `{ fail }` (the problem
 * plus its fix) or `{ skip }` (the check could not run: a check that cannot run is not a pass).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'

import type { BasaltConfig } from './config'
import { parseJsonc, readIfExists, scannableFiles } from './index'
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
  const dir = install.dir
  if (dir === null)
    return { skip: `${id}: basalt-ui does not resolve, so its plugin cannot be read.` }
  return guarded(id, () => {
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

/** `[subpath, line]` per `basalt-ui/<subpath>` import that sits in code, not in a comment or literal. */
function basaltImports(src: string): [string, number][] {
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
  return [...code.matchAll(SUBPATH_IMPORT)]
    .filter((m) => !literals.some(([from, to]) => m.index >= from && m.index < to))
    .map((m) => [m[2] as string, code.slice(0, m.index + m[0].length).split('\n').length])
}

/** `dropped-subpaths`: `basalt-ui/<subpath>` imports the installed `exports` map does not have. */
export function droppedSubpathsCheck(
  cwd: string,
  cfg: BasaltConfig,
  install: BasaltInstall,
): Check {
  const id = 'dropped-subpaths'
  const dir = install.dir
  if (dir === null)
    return { skip: `${id}: basalt-ui does not resolve, so its exports cannot be read.` }
  return guarded(id, () => {
    const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as {
      exports?: Record<string, unknown>
    }
    // No `exports` field means nothing restricts the deep imports.
    if (pkg.exports === undefined) return null
    const keys = Object.keys(pkg.exports)
    const has = (sub: string): boolean =>
      keys.some(
        (k) => k === `./${sub}` || (k.endsWith('*') && `./${sub}`.startsWith(k.slice(0, -1))),
      )
    const hits: string[] = []
    for (const rel of scannableFiles(cwd, cfg).filter((f) =>
      /\.(?:[cm]?[jt]sx?|vue|astro)$/.test(f),
    )) {
      for (const [sub, line] of basaltImports(readIfExists(resolve(cwd, rel)) ?? '')) {
        if (!has(sub)) hits.push(`${rel}:${line} imports basalt-ui/${sub}`)
      }
    }
    if (hits.length === 0) return null
    const more = hits.length > 10 ? ` (+${hits.length - 10} more)` : ''
    return {
      fail: `${id}: ${hits.slice(0, 10).join('; ')}${more}. Fix: see MIGRATING.md § 2.0 for each subpath's replacement.`,
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
