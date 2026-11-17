/** A dimmed mark keeps a floor against the card in the light scheme as in the dark: computed, not eyeballed. */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contrastRatio } from '../tokens/hct'
import { dimmedHuePaint, dimmedPaint } from './marks'

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

/** The top-level comma split of a function's arguments. */
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

/** A paint's branch for a scheme, evaluated: srgb `color-mix` over hex, `transparent` and the muted ink. */
function evaluate(expr: string, scheme: Scheme): Rgba {
  if (expr.startsWith('light-dark('))
    return evaluate(args(expr.slice(11, -1))[scheme] as string, scheme)
  if (expr === 'transparent') return { rgb: [0, 0, 0], a: 0 }
  if (expr === 'var(--basalt-ink-muted)') return { rgb: hexToRgb(token('ink-muted', scheme)), a: 1 }
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

/** The colour a paint shows on the card of a scheme. */
function onCard(paint: string, scheme: Scheme): string {
  const { rgb, a } = evaluate(paint, scheme)
  const card = hexToRgb(token('card', scheme))
  return toHex(rgb.map((v, i) => v * a + card[i]! * (1 - a)))
}

describe('dimmedPaint floor', () => {
  for (const color of ['#4d9bd4', '#d4a13a', '#6fbf73', '#9a9aa8']) {
    test(`a dimmed ${color} stays at 3:1 on the light card`, () => {
      const card = token('card', 0)
      expect(contrastRatio(onCard(dimmedPaint(color), 0), card)).toBeGreaterThanOrEqual(3)
    })
  }

  test('a faded bar (strength below 1) keeps the floor too', () => {
    const card = token('card', 0)
    expect(contrastRatio(onCard(dimmedPaint('#d4a13a', 0.85), 0), card)).toBeGreaterThanOrEqual(3)
  })
})

describe('dimmedHuePaint', () => {
  for (const color of ['#1f6fb0', '#a06a00', '#2d7d3a']) {
    test(`a dimmed ${color} line keeps 3:1 on the light card and its own hue`, () => {
      const card = token('card', 0)
      const shown = onCard(dimmedHuePaint(color), 0)
      expect(contrastRatio(shown, card)).toBeGreaterThanOrEqual(3)
      // Told apart from the shared slate a plain dim gives every line.
      expect(shown).not.toBe(onCard(dimmedPaint(color), 0))
    })
  }

  test('two lines stay different colours dimmed, as one slate they would not', () => {
    const [a, b] = ['#1f6fb0', '#a06a00'].map((c) => onCard(dimmedHuePaint(c), 0))
    expect(a).not.toBe(b)
  })
})
