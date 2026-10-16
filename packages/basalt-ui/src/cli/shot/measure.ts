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
}
export type Reading = Omit<Measurement, 'contrast'> & { texts: TextReading[] }

const hex = (c: readonly number[]): string =>
  '#' +
  c
    .slice(0, 3)
    .map((n) => Math.round(n).toString(16).padStart(2, '0'))
    .join('')

/** Contrast per text reading: `min` over all, `failures` below the WCAG AA threshold. */
export function finishMeasurement({ texts, ...rest }: Reading): Measurement {
  const failures: ContrastFailure[] = []
  let min: number | null = null
  for (const t of texts) {
    const ratio = Math.round(contrastRatio(t.fg, t.bg) * 100) / 100
    min = min === null ? ratio : Math.min(min, ratio)
    if (ratio < contrastThreshold(t.fontSize, t.bold)) {
      failures.push({ text: t.text, ratio, fg: hex(t.fg), bg: hex(t.bg), fontSize: t.fontSize })
    }
  }
  return { ...rest, contrast: { min, failures } }
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
  // Any CSS colour syntax (oklch, color-mix, …) → sRGBA, by letting the canvas parse it.
  const rgba = (css: string): number[] => {
    if (!ctx) return [0, 0, 0, 1]
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 0) / 255]
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
  /** The effective background: layers up to and including the first opaque ancestor, composited. */
  const backdrop = (el: Element): number[] => {
    const layers: number[][] = []
    for (let n: Element | null = el; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor)
      if ((c[3] ?? 0) > 0) layers.push(c)
      if ((c[3] ?? 0) >= 0.99) break
    }
    return layers.toReversed().reduce((under, c) => over(c, under), [255, 255, 255, 1])
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
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const s = visible(el)
    if (!s) continue
    const r = el.getBoundingClientRect()
    const hasBg = (rgba(s.backgroundColor)[3] ?? 0) > 0
    const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some(
      (e) => px(s.getPropertyValue(`border-${e.toLowerCase()}-width`)) > 0,
    )
    if ((hasBg || hasBorder) && nested.length < 60) {
      nested.push({
        path: pathOf(el),
        radius: px(s.borderTopLeftRadius),
        padding: sides(s, 'padding'),
      })
    }
    // Wrappers that span the anchor are layout, not content: only smaller painted boxes count.
    if (
      /^(svg|img|canvas|video|input|textarea)$/i.test(el.tagName) ||
      ((hasBg || hasBorder) && r.height < rect.height * 0.9)
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
    const fg = over(rgba(s.color), backdrop(el))
    const bg = backdrop(el)
    texts.push({
      text: (text[0]?.textContent ?? '').trim().slice(0, 40),
      fg,
      bg,
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
