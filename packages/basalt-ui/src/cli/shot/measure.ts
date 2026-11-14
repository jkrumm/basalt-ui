/**
 * `measureAnchor` runs in the page (Playwright sends its source: it must close over nothing) and
 * returns raw readings; `finishMeasurement` turns the radii into numbers here in Node. Contrast is
 * not read: axe owns it.
 */
import type { Measurement } from './types'

/** A computed `border-top-left-radius` as the page read it, with the box it rounds. */
export type RawRadius = { value: string; width: number; height: number }
export type Reading = Omit<Measurement, 'radius' | 'nested'> & {
  radius: RawRadius
  nested: { path: string; radius: RawRadius; padding: Measurement['padding'] }[]
}

/**
 * A radius in px, or `'full'` when it rounds the box completely: a percentage of 50 or more, or a
 * px radius of at least half the shorter side (`9999px`). A zero-size box has nothing to round: 0.
 * A smaller percentage resolves against the shorter side.
 */
export function radiusReading({ value, width, height }: RawRadius): number | 'full' {
  const first = value.trim()
  const n = Number.parseFloat(first)
  if (width <= 0 || height <= 0 || !Number.isFinite(n) || n <= 0) return 0
  if (first.endsWith('%'))
    return n >= 50 ? 'full' : Math.round((n / 100) * Math.min(width, height) * 100) / 100
  if (n >= Math.min(width, height) / 2) return 'full'
  return Math.round(n * 100) / 100
}

export function finishMeasurement({ radius, nested, ...rest }: Reading): Measurement {
  return {
    ...rest,
    radius: radiusReading(radius),
    nested: nested.map((n) => ({ ...n, radius: radiusReading(n.radius) })),
  }
}

/* oxlint-disable unicorn/consistent-function-scoping -- the helpers below are serialised into the page with it: no outer scope */
export function measureAnchor(root: Element): Reading {
  const px = (v: string | number): number => Math.round(parseFloat(String(v)) * 100) / 100
  const edges = (s: CSSStyleDeclaration, p: string, x = ''): number[] =>
    ['top', 'right', 'bottom', 'left'].map((e) => px(s.getPropertyValue(`${p}-${e}${x}`)))
  const sides = (s: CSSStyleDeclaration): Measurement['padding'] => {
    const [top = 0, right = 0, bottom = 0, left = 0] = edges(s, 'padding')
    return { top, right, bottom, left }
  }
  const shown = (s: CSSStyleDeclaration): boolean =>
    s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'
  const filled = (c: string): boolean => c !== 'transparent' && !/(,|\/)\s*0\)$/.test(c)
  const fills = (s: CSSStyleDeclaration): boolean =>
    shown(s) && s.content !== 'none' && filled(s.backgroundColor)
  const pathOf = (el: Element): string => {
    const parts: string[] = []
    for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
      const cls = n.classList.item(0)
      parts.unshift(n.tagName.toLowerCase() + (cls ? `.${cls}` : ''))
    }
    return parts.join(' > ') || root.tagName.toLowerCase()
  }

  const cs = getComputedStyle(root)
  const rect = root.getBoundingClientRect()

  // gap: the first flex/grid box (breadth-first) that actually spaces its children.
  let gap = { row: 0, column: 0 }
  const queue: Element[] = [root]
  for (let i = 0; i < queue.length && i < 80; i++) {
    const item = queue[i] as Element
    const s = getComputedStyle(item)
    const [row, column] = [px(s.rowGap) || 0, px(s.columnGap) || 0]
    if ((s.display.includes('flex') || s.display.includes('grid')) && (row > 0 || column > 0)) {
      gap = { row, column }
      break
    }
    queue.push(...Array.from(item.children))
  }

  const fontSizes = new Set<number>()
  const painted: [number, number][] = []
  const nested: Reading['nested'] = []
  const small: string[] = []
  const words: { el: Element; r: DOMRect }[] = []
  const control =
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"]'
  const range = document.createRange()
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (!shown(s) || r.width === 0) continue
    const hasBg = fills(s)
    const hasBorder = edges(s, 'border', '-width').some((w) => w > 0)
    if (el !== root && (hasBg || hasBorder) && nested.length < 60) {
      nested.push({
        path: pathOf(el),
        radius: { value: s.borderTopLeftRadius, width: px(r.width), height: px(r.height) },
        padding: sides(s),
      })
    }
    // Only boxes smaller than the anchor count (wrappers are layout); a pseudo fill is paint (Skeleton) only if it covers its host.
    const pseudo = ['::before', '::after'].some((p) => {
      const ps = getComputedStyle(el, p)
      return (
        fills(ps) &&
        [px(ps.width) - r.width, px(ps.height) - r.height].every((d) => Math.abs(d) <= 2)
      )
    })
    if (
      el !== root &&
      (/^(svg|img|canvas|video|input|textarea)$/i.test(el.tagName) ||
        ((hasBg || hasBorder || pseudo) && r.height < rect.height * 0.9))
    ) {
      painted.push([r.top, r.bottom])
    }
    const clipped = r.width <= 1 || r.height <= 1
    if (el.matches(control) && s.display !== 'inline' && !clipped && !el.closest('label')) {
      // WCAG 2.5.8: a control is at least 24 px each way.
      if (r.width < 24 || r.height < 24) small.push(`${pathOf(el)} ${px(r.width)}x${px(r.height)}`)
    }
    const text = Array.from(el.childNodes).filter(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
    )
    if (text.length === 0) continue
    fontSizes.add(px(s.fontSize))
    for (const node of text) {
      range.selectNodeContents(node)
      const tr = range.getBoundingClientRect()
      painted.push([tr.top, tr.bottom])
      if (words.length < 150 && !clipped) words.push({ el, r: tr })
    }
  }

  // overlap: two text boxes that cover each other by more than a hairline.
  const overlaps: string[] = []
  for (const [i, a] of words.entries()) {
    for (const b of words.slice(i + 1)) {
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
      if (w > 2 && h > 2 && overlaps.length < 10) overlaps.push(`${pathOf(a.el)} × ${pathOf(b.el)}`)
    }
  }

  // emptyRatio: the largest vertical run (edges included) with nothing painted in it.
  const { top, bottom } = rect
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
    padding: sides(cs),
    gap,
    radius: { value: cs.borderTopLeftRadius, width: px(rect.width), height: px(rect.height) },
    borderWidth: Math.max(...edges(cs, 'border', '-width')),
    fontSizes: [...fontSizes].toSorted((a, b) => a - b),
    nested,
    emptyRatio,
    small,
    overlaps,
  }
}
