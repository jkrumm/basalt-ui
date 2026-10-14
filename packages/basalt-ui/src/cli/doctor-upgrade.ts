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

const TSCONFIG_PRESET = /(?:^|\/)basalt-ui\/configs\/tsconfig\.(?:base|react-app)\.json$/
const TSCONFIG_PRESET_ID = 'basalt-ui/configs/tsconfig.react-app.json'
const TSCONFIG_FIX = `"extends": "${TSCONFIG_PRESET_ID}" (tsconfig.base.json for a package without a DOM)`

/** A reference path is a tsconfig file or the directory holding one. */
export const tsconfigFile = (p: string): string =>
  p.endsWith('.json') ? p : resolve(p, 'tsconfig.json')

const MAX_EXTENDS_DEPTH = 8

/** Bare `extends` specifier that node resolution cannot find from `dir` (null when it can). */
function resolveBare(spec: string, dir: string): string | null {
  const from = createRequire(resolve(dir, 'x.js'))
  for (const candidate of [spec, `${spec}.json`, `${spec}/tsconfig.json`]) {
    try {
      return from.resolve(candidate)
    } catch {}
  }
  return null
}

/**
 * True when `file` extends a shipped tsconfig preset, directly, through a local or package
 * `extends`, or through a `references` entry. Bare specifiers that do not resolve go to `unresolved`.
 */
function extendsPreset(file: string, unresolved: string[], seen = new Set<string>()): boolean {
  const parsed =
    seen.has(file) || seen.size > MAX_EXTENDS_DEPTH
      ? null
      : parseJsonc(readIfExists(file) ?? 'null')
  if (parsed === null) return false
  seen.add(file)
  const extended = [parsed['extends']].flat().filter((e): e is string => typeof e === 'string')
  if (extended.some((e) => TSCONFIG_PRESET.test(e))) return true
  const refs = Array.isArray(parsed['references']) ? (parsed['references'] as unknown[]) : []
  const next = [
    ...extended.flatMap((e) => {
      if (e.startsWith('.')) return [resolve(dirname(file), e.endsWith('.json') ? e : `${e}.json`)]
      const found = resolveBare(e, dirname(file))
      if (found === null) unresolved.push(e)
      return found === null ? [] : [found]
    }),
    ...refs.flatMap((r) => {
      const path = (r as { path?: unknown } | null)?.path
      return typeof path === 'string' ? [tsconfigFile(resolve(dirname(file), path))] : []
    }),
  ]
  return next.some((f) => extendsPreset(f, unresolved, seen))
}

/** `tsconfig-base`: the app's tsconfig must extend the preset the 2.0 types assume. */
export function tsconfigBaseCheck(cwd: string): Check {
  const file = resolve(cwd, 'tsconfig.json')
  if (readIfExists(file) === null) {
    return { fail: `tsconfig-base: tsconfig.json missing. Fix: create it with ${TSCONFIG_FIX}.` }
  }
  const unresolved: string[] = []
  if (extendsPreset(file, unresolved)) return null
  if (unresolved.length > 0) {
    return {
      skip: `tsconfig-base: cannot resolve extends ${unresolved.join(', ')} from tsconfig.json, so whether it reaches the shipped preset is unknown.`,
    }
  }
  return {
    fail:
      'tsconfig-base: tsconfig.json (and the configs it references) does not extend the shipped ' +
      'preset — the 2.0 types assume strict, exactOptionalPropertyTypes and ' +
      `noUncheckedIndexedAccess. Fix: set ${TSCONFIG_FIX}.`,
  }
}

const CHARTS_FIX =
  'charts moved to basalt-ui/charts; basalt/chart-engine-boundary replaces it. Delete the entry'
const RETIRED_FIX: Record<string, string> = {
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

/** Ids from `basalt/<id>` keys in `file`'s `rules` and `overrides[].rules`, following local extends. */
function basaltRuleIds(file: string, seen = new Set<string>()): string[] {
  const parsed = seen.has(file) ? null : parseJsonc(readIfExists(file) ?? 'null')
  if (parsed === null) return []
  seen.add(file)
  const blocks = [
    parsed['rules'],
    ...(Array.isArray(parsed['overrides'])
      ? parsed['overrides'].map((o) => (o as { rules?: unknown }).rules)
      : []),
  ]
  const ids = blocks.flatMap((b) =>
    typeof b === 'object' && b !== null
      ? Object.keys(b).filter((k) => k.startsWith('basalt/'))
      : [],
  )
  const local = [parsed['extends']]
    .flat()
    .filter((e): e is string => typeof e === 'string' && e.startsWith('.'))
  return [
    ...ids.map((k) => k.slice(7)),
    ...local.flatMap((e) => basaltRuleIds(resolve(dirname(file), e), seen)),
  ]
}

/** `retired-lint-rules`: `basalt/<id>` entries the installed plugin no longer registers. */
export function retiredLintRulesCheck(cwd: string, install: BasaltInstall): Check {
  if (install.dir === null) return null
  const ids = [...new Set(basaltRuleIds(resolve(cwd, '.oxlintrc.json')))]
  if (ids.length === 0) return null
  const pluginPath = resolve(install.dir, 'configs/oxlint-plugin.js')
  let retired: Set<string>
  let registered: Set<string>
  try {
    const plugin = createRequire(pluginPath)(pluginPath) as {
      RETIRED_RULE_IDS?: Set<string>
      default?: { rules?: Record<string, unknown> }
    }
    retired = new Set(plugin.RETIRED_RULE_IDS)
    registered = new Set(Object.keys(plugin.default?.rules ?? {}))
  } catch (error) {
    return { skip: `retired-lint-rules: cannot load ${pluginPath} (${(error as Error).message}).` }
  }
  if (registered.size === 0) {
    return {
      skip: `retired-lint-rules: ${pluginPath} registers no rules, so none can be compared.`,
    }
  }
  const gone = ids.filter((id) => retired.has(id) || !registered.has(id))
  if (gone.length === 0) return null
  const named = gone.map((id) => `basalt/${id} (${RETIRED_FIX[id] ?? 'retired; delete the entry'})`)
  return {
    fail: `retired-lint-rules: .oxlintrc.json sets rules the installed plugin does not register: ${named.join('; ')}. Fix: delete each entry (MIGRATING.md § 2.0).`,
  }
}

/** Comments blanked (newlines kept, so line numbers hold); string and template literals untouched. */
const stripComments = (src: string): string =>
  src.replace(
    /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    (m, literal?: string) => literal ?? m.replace(/[^\n]/g, ''),
  )

/**
 * A `basalt-ui/<subpath>` specifier in statement position: `import … from`, `import type … from`
 * (also split over lines), `export … from`, bare `import '…'`, `import('…')` and `require('…')`.
 * Anchoring to the statement start is what keeps a string that merely contains an import quiet.
 */
const SUBPATH_IMPORT =
  /(?:(?:^|;)[ \t]*(?:(?:import|export)\b[^'"`;]*?\bfrom|import)\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"])basalt-ui\/([^'"]+)\1/gm

/** `dropped-subpaths`: `basalt-ui/<subpath>` imports the installed `exports` map does not have. */
export function droppedSubpathsCheck(
  cwd: string,
  cfg: BasaltConfig,
  install: BasaltInstall,
): Check {
  if (install.dir === null) return null
  let exportKeys: string[] | null
  try {
    const pkg = JSON.parse(readFileSync(resolve(install.dir, 'package.json'), 'utf8')) as {
      exports?: Record<string, unknown>
    }
    exportKeys = pkg.exports === undefined ? null : Object.keys(pkg.exports)
  } catch (error) {
    return {
      skip: `dropped-subpaths: cannot read ${install.dir}/package.json (${(error as Error).message}).`,
    }
  }
  // No `exports` field means nothing restricts the deep imports.
  if (exportKeys === null) return null
  const keys = exportKeys
  const has = (sub: string): boolean =>
    keys.some((k) => k === `./${sub}` || (k.endsWith('*') && `./${sub}`.startsWith(k.slice(0, -1))))
  const hits: string[] = []
  for (const rel of scannableFiles(cwd, cfg).filter((f) => /\.(?:[jt]sx?|vue|astro)$/.test(f))) {
    const text = stripComments(readIfExists(resolve(cwd, rel)) ?? '')
    for (const m of text.matchAll(SUBPATH_IMPORT)) {
      if (has(m[2] as string)) continue
      const line = text.slice(0, m.index + m[0].length).split('\n').length
      hits.push(`${rel}:${line} imports basalt-ui/${m[2]}`)
    }
  }
  if (hits.length === 0) return null
  const shown = hits.slice(0, 10).join('; ')
  return {
    fail: `dropped-subpaths: ${shown}${hits.length > 10 ? ` (+${hits.length - 10} more)` : ''}. Fix: see MIGRATING.md § 2.0 for each subpath's replacement.`,
  }
}

/**
 * `init`'s tsconfig step: make the tsconfig that covers `src` (`tsconfig.json`, or the reference that
 * includes `src` in a stock Vite app) extend the preset, by inserting the key textually (the file is
 * JSONC). Returns the line to print, or null when it already does.
 */
export function seedTsconfigExtends(cwd: string): string | null {
  const root = resolve(cwd, 'tsconfig.json')
  const rootText = readIfExists(root)
  if (rootText === null) {
    writeFileSync(root, `{\n  "extends": "${TSCONFIG_PRESET_ID}",\n  "include": ["src"]\n}\n`)
    return `created tsconfig.json extending ${TSCONFIG_PRESET_ID}.`
  }
  if (tsconfigBaseCheck(cwd) === null) return null
  const refs = parseJsonc(rootText)?.['references']
  const covering = (Array.isArray(refs) ? (refs as { path?: string }[]) : [])
    .map((r) => tsconfigFile(resolve(cwd, r.path ?? '')))
    .find((f) => /"src\b/.test(readIfExists(f) ?? '') && /"include"/.test(readIfExists(f) ?? ''))
  const target = covering ?? root
  const text = readIfExists(target) ?? ''
  const name = relative(cwd, target)
  if (parseJsonc(text)?.['extends'] !== undefined) {
    return `${name} already extends something else — make it also extend ${TSCONFIG_FIX}.`
  }
  const open = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*\{/.exec(text)
  if (open === null) return `${name} is not a JSON object — set ${TSCONFIG_FIX} by hand.`
  const at = open[0].length
  writeFileSync(
    target,
    `${text.slice(0, at)}\n  "extends": "${TSCONFIG_PRESET_ID}",${text.slice(at)}`,
  )
  return `added "extends": "${TSCONFIG_PRESET_ID}" to ${name}.`
}
