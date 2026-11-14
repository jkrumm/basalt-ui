/**
 * `init`'s tsconfig step, kept from the 2.x doctor: the helpers that make the tsconfig covering
 * `src` extend the shipped preset, and the router-plugin advice line. A leaf; v3-sk-3 replaces
 * `init` and takes this file with it.
 */
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'

import { parseJsonc, readIfExists } from './source-text'

type Check = { fail: string } | { skip: string } | null

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

export const ROUTER_PLUGIN_FIX =
  "Fix: `bun add -D @tanstack/router-plugin`, add `tanstackRouter({ target: 'react', autoCodeSplitting: true })` " +
  "from '@tanstack/router-plugin/vite' to `plugins` in vite.config.ts (before react()), then run vite once " +
  'to generate src/routeTree.gen.ts — or define the tree in code (`createRootRoute` + `createRoute`), drop the routeTree.gen import and pass the tree to createBasaltRouter.'
