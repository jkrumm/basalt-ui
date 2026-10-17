/**
 * `series-palette` — the series file's palette is computed, never eyeballed.
 *
 * Pure: source text and the two scheme surfaces in, issues out. Reads every
 * `defineSeries({ key: { light, dark } })` call as one ordered categorical group and judges each
 * scheme against its own surface. The surfaces are the CALLER's to supply: this module is on the
 * guard's import graph, which never loads the `derive` engine (see `guard/index.ts`'s header) —
 * `series-file.ts` computes them. Colour math lives in `../tokens/oklab`; contrast is `hct.ts`'s
 * WCAG ratio.
 */
import { contrastRatio } from '../tokens/hct'
import { deltaEOk, deltaEOkCvd, hexToOklch } from '../tokens/oklab'

export type SeriesScheme = 'light' | 'dark'
/** The surface each scheme's series are judged against. */
export type SeriesSurfaces = Record<SeriesScheme, string>

export type SeriesCheck =
  | 'format'
  | 'lightness'
  | 'chroma'
  | 'cvd'
  | 'separation'
  | 'contrast'
  | 'order'

export type SeriesEntry = {
  readonly key: string
  readonly light: string
  readonly dark: string
  /** 1-based line of the entry in the scanned source. */
  readonly line: number
}
export type SeriesGroup = { readonly line: number; readonly entries: readonly SeriesEntry[] }

export type SeriesIssue = {
  readonly check: SeriesCheck
  readonly scheme: SeriesScheme
  readonly keys: readonly string[]
  readonly measured: number
  readonly threshold: number
  /** Line of the first named key. */
  readonly line: number
  readonly message: string
}

/**
 * OKLCH lightness bands, per scheme.
 *  - light [0.43, 0.77] — the brief's band: below 0.43 a series reads as ink, above 0.77 it washes
 *    out on the panel (3:1 bites earlier, near L 0.67, on the default light panel).
 *  - dark [0.58, 0.88] — lower bound is where a hue clears 3:1 against the default dark panel
 *    (#2b2b2e, L 0.29 → L ≈ 0.56, rounded up for margin); the upper bound keeps a clear step below
 *    white so a bright series does not glow against the dark page.
 */
export const LIGHTNESS_BAND: Record<SeriesScheme, readonly [number, number]> = {
  light: [0.43, 0.77],
  dark: [0.58, 0.88],
}
/** Minimum OKLCH chroma of a categorical hue. */
export const CHROMA_FLOOR = 0.1
/** Minimum OKLab ΔE×100 between ADJACENT series under protanopia and deuteranopia. */
export const CVD_ADJACENT_MIN = 8
/** Minimum OKLab ΔE×100 of the worst pair in a group, normal vision. */
export const SEPARATION_MIN = 15
/** Minimum WCAG contrast of a series against its scheme's surface. */
export const CONTRAST_MIN = 3
/** More categorical series than this and the next one folds into Other. */
export const MAX_SERIES = 8
/** The one escape: a series keyed `other` is deliberately neutral — exempt from the chroma floor only. */
export const NEUTRAL_KEY = 'other'

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** The string literal after `light:` / `dark:`, in either order. */
const ENTRY =
  /([A-Za-z_$][\w$]*|'[^']+'|"[^"]+")\s*:\s*\{\s*(?:light\s*:\s*(['"])(.*?)\2\s*,\s*dark\s*:\s*(['"])(.*?)\4|dark\s*:\s*(['"])(.*?)\6\s*,\s*light\s*:\s*(['"])(.*?)\8)/g

const lineOf = (text: string, at: number): number => text.slice(0, at).split('\n').length

/** Every `defineSeries(...)` call in `source`, as an ordered group of its literal `{ light, dark }` hex pairs. */
export function parseSeriesGroups(source: string): SeriesGroup[] {
  const groups: SeriesGroup[] = []
  for (const call of source.matchAll(/\bdefineSeries\s*\(/g)) {
    const open = (call.index ?? 0) + call[0].length
    const lineStart = source.lastIndexOf('\n', call.index ?? 0) + 1
    if (/^\s*(?:\/\/|\*|\/\*)/.test(source.slice(lineStart, call.index))) continue
    let depth = 1
    let end = open
    while (end < source.length && depth > 0) {
      const ch = source[end]
      if (ch === '(') depth += 1
      else if (ch === ')') depth -= 1
      end += 1
    }
    const body = source.slice(open, end)
    const entries = [...body.matchAll(ENTRY)].map((m): SeriesEntry => {
      const light = m[3] ?? m[9] ?? ''
      const dark = m[5] ?? m[7] ?? ''
      return {
        key: (m[1] ?? '').replace(/^['"]|['"]$/g, ''),
        light: light.trim(),
        dark: dark.trim(),
        line: lineOf(source, open + (m.index ?? 0)),
      }
    })
    groups.push({ line: lineOf(source, call.index ?? 0), entries })
  }
  return groups
}

const fix = (n: number, digits = 2): string => n.toFixed(digits)

/** Judge every group against the six checks. */
export function auditSeriesGroups(
  groups: readonly SeriesGroup[],
  surfaces: SeriesSurfaces,
): SeriesIssue[] {
  const issues: SeriesIssue[] = []
  for (const group of groups) {
    const { entries: allEntries } = group
    const lineOfKey = (key: string) => allEntries.find((e) => e.key === key)?.line ?? group.line

    const categorical = allEntries.filter((e) => e.key !== NEUTRAL_KEY)
    if (categorical.length > MAX_SERIES) {
      const extra = categorical.slice(MAX_SERIES).map((e) => e.key)
      issues.push({
        check: 'order',
        scheme: 'light',
        keys: extra,
        measured: categorical.length,
        threshold: MAX_SERIES,
        line: lineOfKey(extra[0] ?? ''),
        message: `${categorical.length} series in one group (max ${MAX_SERIES}) — ${extra.join(', ')} should fold into \`${NEUTRAL_KEY}\``,
      })
    }

    for (const scheme of ['light', 'dark'] as const) {
      const [lo, hi] = LIGHTNESS_BAND[scheme]
      const value = (e: SeriesEntry) => e[scheme]
      // A value that is not `#rgb` / `#rrggbb` (an alpha hex, a colour name, a typo) cannot be
      // measured — it is reported, and left out of this scheme's other checks rather than guessed at.
      const entries = allEntries.filter((e) => {
        if (HEX.test(value(e))) return true
        issues.push({
          check: 'format',
          scheme,
          keys: [e.key],
          measured: 0,
          threshold: 0,
          line: e.line,
          message: `${e.key} (${scheme}) "${value(e)}" is not a #rgb or #rrggbb hex — it cannot be checked`,
        })
        return false
      })

      for (const e of entries) {
        const { L, C } = hexToOklch(value(e))
        if (L < lo || L > hi) {
          issues.push({
            check: 'lightness',
            scheme,
            keys: [e.key],
            measured: L,
            threshold: L < lo ? lo : hi,
            line: e.line,
            message: `${e.key} (${scheme}) OKLCH lightness ${fix(L)} is outside ${lo}–${hi}`,
          })
        }
        if (e.key !== NEUTRAL_KEY && C < CHROMA_FLOOR) {
          issues.push({
            check: 'chroma',
            scheme,
            keys: [e.key],
            measured: C,
            threshold: CHROMA_FLOOR,
            line: e.line,
            message: `${e.key} (${scheme}) OKLCH chroma ${fix(C, 3)} is below ${CHROMA_FLOOR} — a categorical hue must read as a hue (key a deliberately neutral series \`${NEUTRAL_KEY}\`)`,
          })
        }
        const ratio = contrastRatio(value(e), surfaces[scheme])
        if (ratio < CONTRAST_MIN) {
          issues.push({
            check: 'contrast',
            scheme,
            keys: [e.key],
            measured: ratio,
            threshold: CONTRAST_MIN,
            line: e.line,
            message: `${e.key} (${scheme}) contrast ${fix(ratio)}:1 against the surface is below ${CONTRAST_MIN}:1`,
          })
        }
      }

      // Cycling: an identical colour twice in one scheme is one series standing in for two.
      const seen = new Map<string, string>()
      const duplicated = new Set<string>()
      for (const e of entries) {
        const first = seen.get(value(e).toLowerCase())
        if (first === undefined) seen.set(value(e).toLowerCase(), e.key)
        else {
          duplicated.add(`${first}|${e.key}`)
          issues.push({
            check: 'order',
            scheme,
            keys: [first, e.key],
            measured: 0,
            threshold: SEPARATION_MIN,
            line: e.line,
            message: `${first} and ${e.key} (${scheme}) are the same colour ${value(e)} — a group does not cycle`,
          })
        }
      }

      // Adjacent pairs, worst of the two dichromacies.
      for (let i = 1; i < entries.length; i += 1) {
        const a = entries[i - 1] as SeriesEntry
        const b = entries[i] as SeriesEntry
        if (duplicated.has(`${a.key}|${b.key}`)) continue
        const sims = (['protan', 'deutan'] as const).map(
          (kind) => [kind, deltaEOkCvd(value(a), value(b), kind)] as const,
        )
        const [kind, worst] = sims.reduce((m, s) => (s[1] < m[1] ? s : m))
        if (worst < CVD_ADJACENT_MIN) {
          issues.push({
            check: 'cvd',
            scheme,
            keys: [a.key, b.key],
            measured: worst,
            threshold: CVD_ADJACENT_MIN,
            line: b.line,
            message: `${a.key} → ${b.key} (${scheme}) are ΔE ${fix(worst, 1)} apart under ${kind === 'protan' ? 'protanopia' : 'deuteranopia'}, below ${CVD_ADJACENT_MIN}`,
          })
        }
      }

      // Worst pair over the whole group, normal vision (identical pairs are `order`'s).
      let worstPair: { a: SeriesEntry; b: SeriesEntry; de: number } | null = null
      for (let i = 0; i < entries.length; i += 1) {
        for (let j = i + 1; j < entries.length; j += 1) {
          const a = entries[i] as SeriesEntry
          const b = entries[j] as SeriesEntry
          if (duplicated.has(`${a.key}|${b.key}`)) continue
          const de = deltaEOk(value(a), value(b))
          if (worstPair === null || de < worstPair.de) worstPair = { a, b, de }
        }
      }
      if (worstPair !== null && worstPair.de < SEPARATION_MIN) {
        issues.push({
          check: 'separation',
          scheme,
          keys: [worstPair.a.key, worstPair.b.key],
          measured: worstPair.de,
          threshold: SEPARATION_MIN,
          line: worstPair.b.line,
          message: `${worstPair.a.key} and ${worstPair.b.key} (${scheme}) are only ΔE ${fix(worstPair.de, 1)} apart, below ${SEPARATION_MIN}`,
        })
      }
    }
  }
  return issues
}
