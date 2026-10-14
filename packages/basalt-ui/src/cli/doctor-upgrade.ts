/**
 * `doctor`'s 2.0 strictness and upgrade checks. Each returns the failure text (fix included) or null,
 * so `doctor.ts` stays a flat list of pass/fail rows.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { BasaltConfig } from './config'
import { parseJsonc, readIfExists, scannableFiles } from './index'
import type { BasaltInstall } from './index'

const TSCONFIG_PRESET = /(?:^|\/)basalt-ui\/configs\/tsconfig\.(?:base|react-app)\.json$/
const TSCONFIG_FIX =
  '"extends": "basalt-ui/configs/tsconfig.react-app.json" (tsconfig.base.json for a package without a DOM)'

/** A reference path is a tsconfig file or the directory holding one. */
const tsconfigFile = (p: string): string => (p.endsWith('.json') ? p : resolve(p, 'tsconfig.json'))

/** True when `file` extends a shipped tsconfig preset, directly, via a local extends, or a reference. */
function extendsPreset(file: string, depth = 0): boolean {
  const parsed = depth > 4 ? null : parseJsonc(readIfExists(file) ?? 'null')
  if (parsed === null) return false
  const extended = [parsed['extends']].flat().filter((e): e is string => typeof e === 'string')
  if (extended.some((e) => TSCONFIG_PRESET.test(e))) return true
  const refs = Array.isArray(parsed['references']) ? (parsed['references'] as unknown[]) : []
  const next = [
    ...extended
      .filter((e) => e.startsWith('.'))
      .map((e) => resolve(dirname(file), e.endsWith('.json') ? e : `${e}.json`)),
    ...refs.flatMap((r) => {
      const path = (r as { path?: unknown } | null)?.path
      return typeof path === 'string' ? [tsconfigFile(resolve(dirname(file), path))] : []
    }),
  ]
  return next.some((f) => extendsPreset(f, depth + 1))
}

/** `tsconfig-base`: the app's tsconfig must extend the preset the 2.0 types assume. */
export function tsconfigBaseProblem(cwd: string): string | null {
  const file = resolve(cwd, 'tsconfig.json')
  if (readIfExists(file) === null) {
    return `tsconfig-base: tsconfig.json missing. Fix: create it with ${TSCONFIG_FIX}.`
  }
  if (extendsPreset(file)) return null
  return (
    'tsconfig-base: tsconfig.json (and the configs it references) does not extend the shipped ' +
    'preset — the 2.0 types assume strict, exactOptionalPropertyTypes and ' +
    `noUncheckedIndexedAccess. Fix: set ${TSCONFIG_FIX}.`
  )
}

const RETIRED_FIX: Record<string, string> = {
  'provider-above-router': 'BasaltProvider mounts the router; delete the entry',
  'page-bar-budget': 'the PageBarActions/SectionActions tuple types enforce it; delete the entry',
  'agent-resume-guard': 'useChat/Chat are banned outright; delete the entry',
  'deprecated-export': '2.0 ships no deprecations; delete the entry',
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

/** The single-quoted ids in a source slice, `//` comments ignored. */
const quoted = (block: string | undefined): string[] =>
  [...(block ?? '').replace(/\/\/.*/g, '').matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1] as string)

/** `retired-lint-rules`: `basalt/<id>` entries the installed plugin no longer registers. */
export function retiredLintRulesProblem(cwd: string, install: BasaltInstall): string | null {
  const plugin =
    install.dir === null ? null : readIfExists(resolve(install.dir, 'configs/oxlint-plugin.js'))
  if (plugin === null) return null
  const retired = new Set(quoted(/RETIRED_RULE_IDS = new Set\(\[([\s\S]*?)\]\)/.exec(plugin)?.[1]))
  const registered = new Set(
    [
      ...(/export default \{[\s\S]*?rules: \{([\s\S]*?)\n {2}\}/.exec(plugin)?.[1] ?? '').matchAll(
        /'([a-z0-9-]+)':/g,
      ),
    ].map((m) => m[1] as string),
  )
  const gone = [...new Set(basaltRuleIds(resolve(cwd, '.oxlintrc.json')))].filter(
    (id) => retired.has(id) || (registered.size > 0 && !registered.has(id)),
  )
  if (gone.length === 0) return null
  const named = gone.map(
    (id) =>
      `basalt/${id} (${RETIRED_FIX[id] ?? 'removed with the 2.0 chart/lint layer; delete the entry'})`,
  )
  return `retired-lint-rules: .oxlintrc.json sets rules the installed plugin does not register: ${named.join('; ')}. Fix: delete each entry (MIGRATING.md § 2.0).`
}

/** `dropped-subpaths`: `basalt-ui/<subpath>` imports the installed `exports` map does not have. */
export function droppedSubpathsProblem(
  cwd: string,
  cfg: BasaltConfig,
  install: BasaltInstall,
): string | null {
  if (install.dir === null) return null
  let exportKeys: string[]
  try {
    const pkg = JSON.parse(readFileSync(resolve(install.dir, 'package.json'), 'utf8')) as {
      exports?: Record<string, unknown>
    }
    exportKeys = Object.keys(pkg.exports ?? {})
  } catch {
    return null
  }
  const has = (sub: string): boolean =>
    exportKeys.some(
      (k) => k === `./${sub}` || (k.endsWith('*') && `./${sub}`.startsWith(k.slice(0, -1))),
    )
  const hits: string[] = []
  for (const rel of scannableFiles(cwd, cfg).filter((f) => /\.(?:[jt]sx?|vue|astro)$/.test(f))) {
    ;(readIfExists(resolve(cwd, rel)) ?? '').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(?:from|import)\s*\(?\s*['"]basalt-ui\/([^'"]+)['"]/g)) {
        if (!has(m[1] as string)) hits.push(`${rel}:${i + 1} imports basalt-ui/${m[1]}`)
      }
    })
  }
  if (hits.length === 0) return null
  const shown = hits.slice(0, 10).join('; ')
  return `dropped-subpaths: ${shown}${hits.length > 10 ? ` (+${hits.length - 10} more)` : ''}. Fix: see MIGRATING.md § 2.0 for each subpath's replacement.`
}
