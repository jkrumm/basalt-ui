/**
 * Expression cycle 11 (`v3-expr-11-kit-fixes` 4 and 6a): the ink of a value label standing on a bar is
 * chosen against the fill the bar shows in its state (at rest, focused, dimmed), not fixed to the
 * card's color or ink: that was 2.96:1 light and 1.44:1 dark on a highlighted bar, and a white label
 * on a dimmed bar took the bar's own dimmed color. Computed from the shipped tokens in both schemes;
 * the rendered geometry is `tests/layout/charts-expr11-labels.layout.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contrastRatio } from '../tokens/hct'
import { hexToOklab } from '../tokens/oklab'
import { barOnCard, dimmedPaint, focusedPaint, inkOn } from './marks'
import { paint } from './parts/bars-marks'

type Rgb = [number, number, number]
type Rgba = { rgb: Rgb; a: number }
type Scheme = 0 | 1

const tokens = readFileSync(join(import.meta.dirname, '../css/tokens.css'), 'utf8')
const token = (name: string, scheme: Scheme): string =>
  [...tokens.matchAll(new RegExp(`--basalt-${name}: (#[0-9a-f]{6});`, 'g'))][scheme]?.[1] as string
const hexToRgb = (hex: string): Rgb =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as Rgb
const toHex = (rgb: readonly number[]): string =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

function args(inner: string): string[] {
  const out: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '(') depth++
    else if (inner[i] === ')') depth--
    else if (inner[i] === ',' && depth === 0) {
      out.push(inner.slice(from, i).trim())
      from = i + 1
    }
  }
  out.push(inner.slice(from).trim())
  return out
}

/** A paint's branch for a scheme: `light-dark`, `var(--basalt-*)`, `transparent` and srgb `color-mix`. */
function evaluate(expr: string, scheme: Scheme): Rgba {
  if (expr.startsWith('light-dark('))
    return evaluate(args(expr.slice(11, -1))[scheme] as string, scheme)
  if (expr === 'transparent') return { rgb: [0, 0, 0], a: 0 }
  const named = /^var\(--basalt-([a-z0-9-]+)\)$/.exec(expr)
  if (named) return { rgb: hexToRgb(token(named[1] as string, scheme)), a: 1 }
  if (expr.startsWith('#')) return { rgb: hexToRgb(expr), a: 1 }
  const [first, second] = args(expr.slice('color-mix('.length, -1))
    .slice(1)
    .map((part) => {
      const pct = /\s(\d+(?:\.\d+)?)%$/.exec(part)
      return {
        color: evaluate(pct ? part.slice(0, pct.index) : part, scheme),
        share: pct ? Number(pct[1]) / 100 : null,
      }
    }) as [{ color: Rgba; share: number | null }, { color: Rgba; share: number | null }]
  const p1 = first.share ?? 1 - (second.share ?? 0.5)
  const p2 = 1 - p1
  const a = first.color.a * p1 + second.color.a * p2
  const rgb = [0, 1, 2].map(
    (i) =>
      (first.color.rgb[i]! * first.color.a * p1 + second.color.rgb[i]! * second.color.a * p2) / a,
  ) as Rgb
  return { rgb, a }
}

function onCard(expr: string, scheme: Scheme): string {
  const { rgb, a } = evaluate(expr, scheme)
  const card = hexToRgb(token('card', scheme))
  return toHex(rgb.map((v, i) => v * a + card[i]! * (1 - a)))
}

/** What `inkOn` resolves to: its lightness switch evaluated on the flattened fill, black or white. */
function inkHex(surface: string, scheme: Scheme): string {
  expect(inkOn(surface)).toContain(`oklch(from ${surface} `)
  return hexToOklab(onCard(surface, scheme)).L < 0.565 ? '#ffffff' : '#000000'
}

const COLORS = ['brand', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const
const SCHEMES: readonly [string, Scheme][] = [
  ['light', 0],
  ['dark', 1],
]
const STRENGTH = 0.85

describe('barOnCard is the bar a state paints, flattened over the card', () => {
  for (const [name, scheme] of SCHEMES)
    for (const c of COLORS) {
      const color = `var(--basalt-${c})`
      test(`${name} ${c}`, () => {
        const same = (a: string, b: string) => {
          const [x, y] = [hexToRgb(a), hexToRgb(b)]
          for (const i of [0, 1, 2]) expect(Math.abs(x[i]! - y[i]!)).toBeLessThanOrEqual(1)
        }
        same(
          onCard(barOnCard(color, STRENGTH, 'rest'), scheme),
          onCard(paint(color, STRENGTH), scheme),
        )
        same(
          onCard(barOnCard(color, STRENGTH, 'dimmed'), scheme),
          onCard(dimmedPaint(color, STRENGTH), scheme),
        )
        same(
          onCard(barOnCard(color, STRENGTH, 'focused'), scheme),
          onCard(focusedPaint(color), scheme),
        )
      })
    }
})

describe('a label on a bar reads at 4.5:1 in every state and scheme', () => {
  for (const [name, scheme] of SCHEMES)
    for (const c of COLORS)
      for (const state of ['rest', 'focused', 'dimmed'] as const)
        test(`${name} ${c} ${state}`, () => {
          const surface = barOnCard(`var(--basalt-${c})`, STRENGTH, state)
          const fill = onCard(surface, scheme)
          expect(contrastRatio(inkHex(surface, scheme), fill)).toBeGreaterThanOrEqual(4.5)
        })

  test('the old ink, the card color (white on a blue bar), did not: a dimmed or resting fill falls under 4.5', () => {
    const worst = SCHEMES.flatMap(([, scheme]) =>
      COLORS.flatMap((c) =>
        (['rest', 'dimmed'] as const).map((state) =>
          contrastRatio(
            token('card', scheme),
            onCard(barOnCard(`var(--basalt-${c})`, STRENGTH, state), scheme),
          ),
        ),
      ),
    )
    expect(Math.min(...worst)).toBeLessThan(4.5)
  })
})
