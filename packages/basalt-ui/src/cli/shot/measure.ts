// theme-allow-file raw-hex — canvas colour parsing and sRGB readings, not styling
// theme-allow-file raw-color-fn — reads the page's computed colours, never styles with them
/**
 * `measureAnchor` runs in the page (Playwright sends its source: it must close over nothing) and
 * returns raw readings; the contrast maths runs here in Node, where it is unit-testable.
 */
import type { ContrastFailure, Measurement } from './types'

const linear = (v: number | undefined): number => {
  const s = (v ?? 0) / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = (c: readonly number[]): number =>
  0.2126 * linear(c[0]) + 0.7152 * linear(c[1]) + 0.0722 * linear(c[2])

/** WCAG contrast ratio of two sRGB colours (channels 0–255). */
export function contrastRatio(a: readonly number[], b: readonly number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

/** 3 for large text (≥ 24px, or ≥ 18.66px bold), else 4.5. */
export function contrastThreshold(fontSize: number, bold: boolean): number {
  return fontSize >= 24 || (bold && fontSize >= 18.66) ? 3 : 4.5
}

export type TextReading = {
  text: string
  fg: number[]
  bg: number[]
  fontSize: number
  bold: boolean
  /** No opaque ancestor background was found: `bg` is white by assumption. */
  assumedWhite: boolean
}
export type Reading = Omit<Measurement, 'contrast'> & { texts: TextReading[] }

const hex = (c: readonly number[]): string =>
  '#' +
  c
    .slice(0, 3)
    .map((n) => Math.round(n).toString(16).padStart(2, '0'))
    .join('')

/**
 * Contrast per text reading: `min` over all, `failures` below the WCAG AA threshold. The threshold
 * is tested on the UNROUNDED ratio; only the stored value is rounded.
 */
export function finishMeasurement({ texts, ...rest }: Reading): Measurement {
  const failures: ContrastFailure[] = []
  let min: number | null = null
  for (const t of texts) {
    const exact = contrastRatio(t.fg, t.bg)
    const ratio = Math.round(exact * 100) / 100
    min = min === null ? ratio : Math.min(min, ratio)
    if (exact < contrastThreshold(t.fontSize, t.bold)) {
      failures.push({ text: t.text, ratio, fg: hex(t.fg), bg: hex(t.bg), fontSize: t.fontSize })
    }
  }
  const backdrop = texts.some((t) => t.assumedWhite) ? ({ backdrop: 'assumed-white' } as const) : {}
  return { ...rest, contrast: { min, failures, ...backdrop } }
}

/* oxlint-disable unicorn/consistent-function-scoping -- the helpers below are serialised into the page with it: no outer scope */
export function measureAnchor(root: Element): Reading {
  const px = (v: string | number): number => Math.round(parseFloat(String(v)) * 100) / 100
  const sides = (s: CSSStyleDeclaration, p: 'padding'): Measurement['padding'] => ({
    top: px(s[`${p}Top`]),
    right: px(s[`${p}Right`]),
    bottom: px(s[`${p}Bottom`]),
    left: px(s[`${p}Left`]),
  })
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d canvas context: cannot read colours')
  const parsed = new Map<string, number[]>()
  const paint = (start: string, css: string): number[] => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = start
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    return Array.from(ctx.getImageData(0, 0, 1, 1).data)
  }
  // Any CSS colour syntax (oklch, color-mix, …) → sRGBA, by letting the canvas parse it. An
  // unparseable value leaves the start colour in place, so two different starts disagree.
  const rgba = (css: string): number[] => {
    const known = parsed.get(css)
    if (known) return known
    const onBlack = paint('#000000', css)
    const onWhite = paint('#ffffff', css)
    if (onBlack.some((v, i) => v !== onWhite[i])) throw new Error(`unparseable colour: ${css}`)
    const out = [onBlack[0] ?? 0, onBlack[1] ?? 0, onBlack[2] ?? 0, (onBlack[3] ?? 0) / 255]
    parsed.set(css, out)
    return out
  }
  const over = (top: number[], under: number[]): number[] => {
    const a = top[3] ?? 1
    return [0, 1, 2, 3].map((i) => (i === 3 ? 1 : (top[i] ?? 0) * a + (under[i] ?? 0) * (1 - a)))
  }
  const visible = (el: Element): CSSStyleDeclaration | null => {
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0' || r.width === 0
      ? null
      : s
  }
  /** The effective background: layers up to the first opaque ancestor (html/body included), composited. */
  const backdrop = (el: Element): { color: number[]; assumedWhite: boolean } => {
    const layers: number[][] = []
    let opaque = false
    for (let n: Element | null = el; n && !opaque; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor)
      if ((c[3] ?? 0) > 0) layers.push(c)
      opaque = (c[3] ?? 0) >= 0.99
    }
    const color = layers.toReversed().reduce((under, c) => over(c, under), [255, 255, 255, 1])
    return { color, assumedWhite: !opaque }
  }

  const cs = getComputedStyle(root)
  const rect = root.getBoundingClientRect()
  const widest = Math.max(
    ...['Top', 'Right', 'Bottom', 'Left'].map((e) =>
      px(cs.getPropertyValue(`border-${e.toLowerCase()}-width`)),
    ),
  )

  // gap: the first flex/grid box (breadth-first) that actually spaces its children.
  let gap = { row: 0, column: 0 }
  const queue: Element[] = [root]
  for (let i = 0; i < queue.length && i < 80; i++) {
    const item = queue[i]
    if (!item) break
    const s = getComputedStyle(item)
    const row = px(s.rowGap) || 0
    const column = px(s.columnGap) || 0
    if ((s.display.includes('flex') || s.display.includes('grid')) && (row > 0 || column > 0)) {
      gap = { row, column }
      break
    }
    queue.push(...Array.from(item.children))
  }

  const fontSizes = new Set<number>()
  const texts: Reading['texts'] = []
  const painted: [number, number][] = []
  const nested: Measurement['nested'] = []
  const pathOf = (el: Element): string => {
    const parts: string[] = []
    for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
      const cls = n.classList.item(0)
      parts.unshift(n.tagName.toLowerCase() + (cls ? `.${cls}` : ''))
    }
    return parts.join(' > ')
  }
  const range = document.createRange()
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const s = visible(el)
    if (!s) continue
    const r = el.getBoundingClientRect()
    const hasBg = (rgba(s.backgroundColor)[3] ?? 0) > 0
    const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some(
      (e) => px(s.getPropertyValue(`border-${e.toLowerCase()}-width`)) > 0,
    )
    if (el !== root && (hasBg || hasBorder) && nested.length < 60) {
      nested.push({
        path: pathOf(el),
        radius: px(s.borderTopLeftRadius),
        padding: sides(s, 'padding'),
      })
    }
    // Wrappers that span the anchor are layout, not content: only smaller painted boxes count.
    if (
      el !== root &&
      (/^(svg|img|canvas|video|input|textarea)$/i.test(el.tagName) ||
        ((hasBg || hasBorder) && r.height < rect.height * 0.9))
    ) {
      painted.push([r.top, r.bottom])
    }
    const text = Array.from(el.childNodes).filter(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
    )
    if (text.length === 0) continue
    const size = px(s.fontSize)
    fontSizes.add(size)
    for (const node of text) {
      range.selectNodeContents(node)
      const tr = range.getBoundingClientRect()
      painted.push([tr.top, tr.bottom])
    }
    const back = backdrop(el)
    texts.push({
      text: (text[0]?.textContent ?? '').trim().slice(0, 40),
      fg: over(rgba(s.color), back.color),
      bg: back.color,
      assumedWhite: back.assumedWhite,
      fontSize: size,
      bold: parseInt(s.fontWeight, 10) >= 700,
    })
  }

  // emptyRatio: the largest vertical run (edges included) with nothing painted in it.
  const top = rect.top
  const bottom = rect.bottom
  let cursor = top
  let longest = 0
  for (const [a, b] of painted.toSorted((x, y) => x[0] - y[0])) {
    longest = Math.max(longest, Math.min(a, bottom) - cursor)
    cursor = Math.max(cursor, Math.min(b, bottom))
  }
  longest = Math.max(longest, bottom - cursor)
  const emptyRatio =
    rect.height > 0 ? Math.round((Math.max(longest, 0) / rect.height) * 1000) / 1000 : 1

  return {
    box: { width: px(rect.width), height: px(rect.height) },
    padding: sides(cs, 'padding'),
    gap,
    radius: px(cs.borderTopLeftRadius),
    borderWidth: widest,
    fontSizes: [...fontSizes].toSorted((a, b) => a - b),
    nested,
    emptyRatio,
    texts,
  }
}
