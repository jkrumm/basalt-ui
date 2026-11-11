/**
 * `tokens:css --extra`: the app-owned half of the token system (tokens-visual 3.8). One file per app,
 * `src/basalt.tokens.ts`, an import-free default export `{ series, vars }`:
 *
 *   series: { <group>: { <key>: { hue, light?, dark? } | { light: '#hex', dark: '#hex' } } }
 *   vars:   { <name>: '<css value>' }
 *
 * `series` emits `--vx-<group>-<key>` per scheme (ramp steps resolve through `rampPair`), `vars`
 * emits `--vx-<name>` once on `:root`, and a sibling `.d.ts` augments `BasaltRegister` so the series
 * keys are typed. Keys are written verbatim: an app's existing `--vx-usage-*` names stay
 * byte-identical.
 *
 * Refused (the message names the fix): an emitted name that is a package name, and a `vars` value
 * reading a `--vx-*` that is neither a package name nor a name in this file. Pure apart from
 * {@link loadExtra}: {@link emitExtra} takes the data and the header and returns strings.
 */
import { createRequire } from 'node:module'

import { tokenNames } from '../tokens/emit'
import { block, schemeBlocks } from '../tokens/emit-fallback'
import type { Decl } from '../tokens/emit-fallback'
import { RAMPS, rampPair } from '../tokens/ramps'
import type { RampHue, RampStep } from '../tokens/ramps'

export type ExtraOutput = { css: string; dts: string }
export type ExtraResult = ({ ok: true } & ExtraOutput) | { ok: false; error: string }

/** The scheme selectors of the default sheet (`emit.ts`); `tokens-css.test.ts` pins them against it. */
const SELECTORS = {
  light: ":root,\n:root[data-theme='light']",
  dark: ":root[data-theme='dark']",
  auto: ':root:not([data-theme])',
} as const

const NAME = /^[A-Za-z0-9][A-Za-z0-9-]*$/
const HEX = /^#[0-9a-fA-F]{3,8}$/
const VX_REF = /--vx-[A-Za-z0-9_-]+/g

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Load the default export of an `--extra` file. Bun resolves a `.ts` file; Node needs a `.js` one. */
export function loadExtra(
  absPath: string,
): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    const load = createRequire(import.meta.url)
    // A CLI run is one process, but the loader is also called twice in one (tests, an editor task):
    // the second read must see the file as it is now, not the cached first one.
    delete load.cache[load.resolve(absPath)]
    const mod: unknown = load(absPath)
    const data = isRecord(mod) && 'default' in mod ? mod['default'] : mod
    return { ok: true, data }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `could not load ${absPath}: ${reason}` }
  }
}

type Pair = { light: string; dark: string }

function resolveEntry(path: string, entry: unknown): Pair | string {
  if (!isRecord(entry)) return `${path} must be { hue, light?, dark? } or { light, dark }`
  if ('hue' in entry) {
    const { hue, light, dark, ...rest } = entry
    if (Object.keys(rest).length > 0) {
      return `${path} has unknown keys (${Object.keys(rest).join(', ')}); a ramp entry is { hue, light?, dark? }`
    }
    if (typeof hue !== 'string' || !(hue in RAMPS)) {
      return `${path}.hue must be one of ${Object.keys(RAMPS).join(', ')} (got ${JSON.stringify(hue)})`
    }
    const steps: { light?: RampStep; dark?: RampStep } = {}
    for (const [side, value] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      if (value === undefined) continue
      if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 4) {
        return `${path}.${side} must be a ramp step 0..4 (got ${JSON.stringify(value)})`
      }
      steps[side] = value as RampStep
    }
    return rampPair(hue as RampHue, steps)
  }
  const { light, dark, ...rest } = entry
  if (Object.keys(rest).length > 0) {
    return `${path} has unknown keys (${Object.keys(rest).join(', ')}); a literal entry is { light, dark }`
  }
  if (
    typeof light !== 'string' ||
    typeof dark !== 'string' ||
    !HEX.test(light) ||
    !HEX.test(dark)
  ) {
    return `${path} must carry both light and dark as #hex (got ${JSON.stringify({ light, dark })})`
  }
  return { light, dark }
}

/** The valid name closest to `bad`: the longest dash-prefix of it, else the least edit distance. */
export function nearestName(bad: string, valid: ReadonlySet<string>): string {
  const prefixes = [...valid]
    .filter((v) => bad.startsWith(`${v}-`))
    .sort((a, b) => b.length - a.length)
  if (prefixes[0] !== undefined) return prefixes[0]
  let best = ''
  let bestDistance = Infinity
  for (const name of [...valid].sort()) {
    const d = editDistance(bad, name)
    if (d < bestDistance) {
      best = name
      bestDistance = d
    }
  }
  return best
}

function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        row[j]! + 1,
        next[j - 1]! + 1,
        row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    row = next
  }
  return row[b.length]!
}

/**
 * Emit the app sheet and its `.d.ts` for the file's data.
 * @param file the path as the user wrote it, for messages
 * @param header the two-line provenance header, written on both outputs
 */
export function emitExtra(data: unknown, file: string, header: string): ExtraResult {
  const fail = (error: string): ExtraResult => ({ ok: false, error: `${file}: ${error}` })
  if (!isRecord(data)) return fail('the default export must be an object { series?, vars? }')
  const { series = {}, vars = {}, ...rest } = data
  if (Object.keys(rest).length > 0) {
    return fail(`unknown keys (${Object.keys(rest).join(', ')}); the file is { series?, vars? }`)
  }
  if (!isRecord(series)) return fail('`series` must be { <group>: { <key>: entry } }')
  if (!isRecord(vars)) return fail('`vars` must be { <name>: "<css value>" }')

  const packageNames = new Set(tokenNames())
  const emitted = new Set<string>()
  const claim = (name: string, where: string): string | null => {
    if (packageNames.has(name))
      return `${where} emits ${name}, which is a basalt-ui name; rename it`
    if (emitted.has(name)) return `${where} emits ${name}, which another entry already emits`
    emitted.add(name)
    return null
  }

  const light: Decl[] = []
  const dark: Decl[] = []
  const registered: string[] = []
  for (const [group, entries] of Object.entries(series)) {
    if (!NAME.test(group)) return fail(`series group '${group}' must match ${NAME}`)
    if (!isRecord(entries)) return fail(`series.${group} must be { <key>: entry }`)
    for (const [key, entry] of Object.entries(entries)) {
      const path = `series.${group}.${key}`
      if (!NAME.test(key)) return fail(`${path}: the key must match ${NAME}`)
      const name = `--vx-${group}-${key}`
      const collision = claim(name, path)
      if (collision !== null) return fail(collision)
      const pair = resolveEntry(path, entry)
      if (typeof pair === 'string') return fail(pair)
      light.push([name, pair.light])
      dark.push([name, pair.dark])
      registered.push(`${group}-${key}`)
    }
  }

  const varDecls: Decl[] = []
  for (const [key, value] of Object.entries(vars)) {
    const path = `vars.${key}`
    if (!NAME.test(key)) return fail(`${path}: the name must match ${NAME}`)
    if (typeof value !== 'string' || value.trim() === '')
      return fail(`${path} must be a CSS value string`)
    const name = `--vx-${key}`
    const collision = claim(name, path)
    if (collision !== null) return fail(collision)
    varDecls.push([name, value])
  }

  const valid = new Set([...packageNames, ...emitted])
  for (const [name, value] of varDecls) {
    for (const ref of value.match(VX_REF) ?? []) {
      if (valid.has(ref)) continue
      return fail(
        `vars.${name.slice('--vx-'.length)} reads ${ref}, which is neither a basalt-ui name nor declared in this file; did you mean ${nearestName(ref, valid)}?`,
      )
    }
  }

  const css =
    header +
    (light.length === 0 ? '' : schemeBlocks(SELECTORS, light, dark)) +
    (varDecls.length === 0 ? '' : block(':root', varDecls))

  const slot = registered.map(
    (name) => `      readonly '${name}': { readonly light: string; readonly dark: string }`,
  )
  const dts =
    `${header}export {}\n\ndeclare module 'basalt-ui' {\n  interface BasaltRegister {\n` +
    (slot.length === 0 ? '' : `    series: {\n${slot.join('\n')}\n    }\n`) +
    `  }\n}\n`
  return { ok: true, css, dts }
}
