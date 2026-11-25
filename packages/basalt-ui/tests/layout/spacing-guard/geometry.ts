/**
 * The spacing guard's measurements, run inside the page (owner review 3, Issue 3304). One function,
 * `geometryFindings`, reads real geometry and returns one finding per defect; `spacing-guard.layout.test.ts`
 * runs it over every tour page at 1800 and 390 and over a seeded offender.
 *
 * Self-contained on purpose: Playwright serializes it into the page, so it closes over nothing.
 *
 * - `inset`: a surface's own padding (plus the room its scrollbar takes) is the same on opposite sides, and a
 *   scroll region inside a surface leaves the same distance to the surface's edge on both sides, scrollbar included.
 * - `under-bar`: nothing sits under a visible scrollbar.
 * - `stray-bar`: no scrollbar draws for four pixels of overflow or less (a focus ring, an underline).
 * - `row-top`: siblings in a row share their top edge; an icon or a radio (a mark of 24 px or less, no text) is
 *   aligned by its middle to the first line of its text instead.
 * - `gap`: a gap between siblings is on the spacing ladder (an even px up to 16, a multiple of 4 above) and one
 *   stack keeps one gap.
 */
export type GeometryKind = 'inset' | 'under-bar' | 'stray-bar' | 'row-top' | 'gap' | 'edge'
export type GeometryFinding = { kind: GeometryKind; where: string; detail: string }
/**
 * Classic scrollbars, 11 px, on every platform: a bar that takes layout room is the case the guard measures. The
 * headless shell and a trackpad Mac draw overlay bars with no room of their own, which would hide the defect.
 * The standard properties (`scrollbar-width`, `scrollbar-color`) are reset because they switch the
 * `::-webkit-scrollbar` rules off.
 */
export const CLASSIC_SCROLLBARS =
  '*{scrollbar-width:auto !important;scrollbar-color:auto !important}' +
  '*::-webkit-scrollbar{width:11px;height:11px;background:#ddd}*::-webkit-scrollbar-thumb{background:#888}'

export type GeometryOptions = {
  /** The distance a measured edge may differ from its twin, px. */
  tolerance: number
}

export function geometryFindings({ tolerance }: GeometryOptions): GeometryFinding[] {
  const found: GeometryFinding[] = []
  const seen = new Set<string>()

  const label = (el: Element): string => {
    const slot = el.getAttribute('data-slot')
    const own = el.tagName.toLowerCase() + (slot === null ? '' : '[' + slot + ']')
    const parent = el.parentElement
    const via =
      parent === null
        ? ''
        : parent.tagName.toLowerCase() +
          (parent.getAttribute('data-slot') === null
            ? ''
            : '[' + parent.getAttribute('data-slot') + ']') +
          ' > '
    const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24)
    return via + own + (text === '' ? '' : ' "' + text + '"')
  }
  const report = (kind: GeometryKind, el: Element, detail: string): void => {
    const key = kind + '|' + label(el) + '|' + detail
    if (seen.has(key)) return
    seen.add(key)
    found.push({ kind, where: label(el), detail })
  }
  const px = (v: string): number => {
    const n = parseFloat(v)
    return Number.isNaN(n) ? 0 : n
  }
  const shown = (el: Element): boolean => {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') return false
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    // sr-only: a 1 px absolutely placed box
    return !((s.position === 'absolute' || s.position === 'fixed') && r.width <= 1 && r.height <= 1)
  }
  const ink = (c: string): boolean => {
    const m = /rgba?\(([^)]*)\)|color\(([^)]*)\)/.exec(c)
    if (m === null) return false
    if (c.startsWith('rgb(')) return true
    const a = /\/\s*([\d.]+)\s*\)/.exec(c) ?? /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(c)
    return a === null ? !c.includes('transparent') : parseFloat(a[1]!) > 0.2
  }
  const inRoot = (el: Element): boolean =>
    el.closest('[data-slot="shell-main"], [data-slot="page-main"]') !== null
  const roots = [...document.querySelectorAll('[data-slot="page-main"]')]
  const all = roots
    .flatMap((r) => [r, ...r.querySelectorAll('*')])
    .filter((el) => inRoot(el) && el.namespaceURI === 'http://www.w3.org/1999/xhtml')

  const FRAME_SLOTS =
    /^(button|input|select|textarea|badge|tag|chip|tab|tabs-trigger|toggle|switch|checkbox|radio|menu-item|option|kbd|avatar|skeleton|progress|meter|separator|status)/
  const isControl = (el: Element): boolean =>
    el.matches(
      'button, input, select, textarea, a, label, summary, [role=button], [role=tab], [role=option], [role=menuitem], [role=checkbox], [role=switch], [role=radio]',
    ) || FRAME_SLOTS.test(el.getAttribute('data-slot') ?? '')
  const surface = (el: Element): boolean => {
    if (isControl(el)) return false
    const s = getComputedStyle(el)
    if (
      !s.display.startsWith('block') &&
      !s.display.includes('flex') &&
      !s.display.includes('grid') &&
      s.display !== 'flow-root'
    )
      return false
    const edged = ['Top', 'Right', 'Bottom', 'Left'].some(
      (side) =>
        px(s.getPropertyValue('border-' + side.toLowerCase() + '-width')) > 0 &&
        ink(s.getPropertyValue('border-' + side.toLowerCase() + '-color')),
    )
    const filled = ink(s.backgroundColor) && px(s.borderTopLeftRadius) > 0
    return (edged || filled) && el.getBoundingClientRect().width >= 80
  }
  const kids = (el: Element): Element[] => {
    const out: Element[] = []
    for (const c of el.children) {
      if (getComputedStyle(c).display === 'contents') out.push(...kids(c))
      else if (shown(c)) out.push(c)
    }
    return out
  }
  const inflow = (el: Element): boolean => {
    const p = getComputedStyle(el).position
    return p !== 'absolute' && p !== 'fixed'
  }

  // The scrollbar a scroller draws: a classic bar takes layout room, an overlay bar none.
  const bars = (el: HTMLElement): { v: number; h: number } => {
    const s = getComputedStyle(el)
    const v = /auto|scroll/.test(s.overflowY)
      ? el.offsetWidth - el.clientWidth - px(s.borderLeftWidth) - px(s.borderRightWidth)
      : 0
    const h = /auto|scroll/.test(s.overflowX)
      ? el.offsetHeight - el.clientHeight - px(s.borderTopWidth) - px(s.borderBottomWidth)
      : 0
    // `both-edges` reserves the same room on the left, which `clientWidth` leaves out too.
    const bar = s.scrollbarGutter.includes('both-edges') ? v / 2 : v
    return { v: Math.max(0, Math.round(bar)), h: Math.max(0, Math.round(h)) }
  }

  // inset: a surface's own sides
  for (const el of all) {
    if (!surface(el)) continue
    const s = getComputedStyle(el)
    const b = bars(el as HTMLElement)
    const left =
      px(s.borderLeftWidth) +
      px(s.paddingLeft) +
      (s.scrollbarGutter.includes('both-edges') ? b.v : 0)
    const right = px(s.borderRightWidth) + px(s.paddingRight) + b.v
    if (Math.abs(left - right) > tolerance && kids(el).some(inflow)) {
      report(
        'inset',
        el,
        'left ' +
          left +
          ' px, right ' +
          right +
          ' px' +
          (b.v > 0 ? ' (scrollbar ' + b.v + ')' : ''),
      )
    }
  }

  // stray-bar: a bar that draws for a few pixels of overflow nobody meant to scroll (a `stable` gutter's
  // empty track is no bar: it needs overflow) (a ring, an underline)
  for (const el of all as HTMLElement[]) {
    if (!shown(el)) continue
    const b = bars(el)
    const over = (axis: 'v' | 'h'): number =>
      axis === 'v' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth
    if (b.v > 0 && over('v') > 0 && over('v') <= 4)
      report(
        'stray-bar',
        el,
        'draws a ' + b.v + ' px vertical scrollbar for ' + over('v') + ' px of overflow',
      )
    if (b.h > 0 && over('h') > 0 && over('h') <= 4)
      report(
        'stray-bar',
        el,
        'draws a ' + b.h + ' px horizontal scrollbar for ' + over('h') + ' px of overflow',
      )
  }

  // inset of a scroll region within its surface, and under-bar
  for (const el of all as HTMLElement[]) {
    const s = getComputedStyle(el)
    const scrolls =
      (/auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) ||
      (/auto|scroll/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1)
    if (!scrolls || !shown(el)) continue
    const b = bars(el)
    const r = el.getBoundingClientRect()
    if (b.v > 0) {
      // Whatever answers a hit on the bar's track other than the scroller itself is drawn over it.
      const x = r.right - px(s.borderRightWidth) - b.v / 2
      const top = Math.max(r.top, 0)
      const bottom = Math.min(r.bottom, window.innerHeight)
      for (const f of [0.15, 0.5, 0.85]) {
        const hit = document.elementFromPoint(x, top + (bottom - top) * f)
        if (hit !== null && hit !== el) {
          report('under-bar', hit, 'covers the ' + b.v + ' px scrollbar of ' + label(el))
          break
        }
      }
    }
    const items = kids(el).filter(inflow)
    let host: Element | null = el.parentElement
    while (host !== null && !surface(host)) host = host.parentElement
    if (host === null || !inRoot(host) || items.length === 0) continue
    const hs = getComputedStyle(host)
    const h = host.getBoundingClientRect()
    const innerLeft = h.left + px(hs.borderLeftWidth)
    const innerRight = h.right - px(hs.borderRightWidth)
    const contentLeft = Math.min(...items.map((c) => c.getBoundingClientRect().left))
    const contentRight = Math.max(
      ...items.map((c) =>
        Math.min(c.getBoundingClientRect().right, r.right - px(s.borderRightWidth) - b.v),
      ),
    )
    const gapL = contentLeft - innerLeft
    const gapR = innerRight - contentRight
    if (b.v > 0 && Math.abs(gapL - gapR) > tolerance) {
      report(
        'inset',
        el,
        'content is ' +
          Math.round(gapL * 10) / 10 +
          ' px from the left edge of ' +
          label(host) +
          ' and ' +
          Math.round(gapR * 10) / 10 +
          ' px from the right (scrollbar ' +
          b.v +
          ')',
      )
    }
  }

  // edge: a framed child (a card) and a plain sibling (a header) start on one edge, or an indent apart
  type Ink = { left: number; right: number; boxedLeft: boolean; boxedRight: boolean }
  const framed = (el: Element): boolean => surface(el) || isControl(el)
  const inkEdges = (el: Element): Ink | null => {
    if (framed(el)) {
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, boxedLeft: true, boxedRight: true }
    }
    const ink: Ink = { left: Infinity, right: -Infinity, boxedLeft: false, boxedRight: false }
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    let steps = 0
    for (let n = walker.nextNode(); n !== null && steps < 600; n = walker.nextNode(), steps++) {
      let box: DOMRect
      let boxed = false
      if (n.nodeType === Node.TEXT_NODE) {
        if (
          (n.textContent ?? '').trim() === '' ||
          n.parentElement === null ||
          !shown(n.parentElement)
        )
          continue
        const range = document.createRange()
        range.selectNodeContents(n)
        box = range.getBoundingClientRect()
      } else {
        const e = n as Element
        const frame = framed(e)
        if (!(frame || e instanceof SVGElement || e.matches('img, video, canvas')) || !shown(e))
          continue
        box = e.getBoundingClientRect()
        boxed = frame
      }
      if (box.width < 1) continue
      if (box.left < ink.left - 0.01) {
        ink.left = box.left
        ink.boxedLeft = boxed
      } else if (Math.abs(box.left - ink.left) <= 0.01) ink.boxedLeft ||= boxed
      if (box.right > ink.right + 0.01) {
        ink.right = box.right
        ink.boxedRight = boxed
      } else if (Math.abs(box.right - ink.right) <= 0.01) ink.boxedRight ||= boxed
    }
    return ink.left === Infinity ? null : ink
  }
  for (const el of all) {
    const s = getComputedStyle(el)
    if (!surface(el) && el.getAttribute('data-slot') !== 'page-main') continue
    if (
      s.display.includes('grid') ||
      (s.display.includes('flex') && !s.flexDirection.startsWith('column'))
    )
      continue
    const items = kids(el)
      .filter(inflow)
      .filter(
        (i) => px(getComputedStyle(i).marginLeft) >= 0 && px(getComputedStyle(i).marginRight) >= 0,
      )
    if (items.length < 2 || items.length > 16) continue
    const edges = items
      .map((i) => ({ i, e: inkEdges(i) }))
      .filter((x): x is { i: Element; e: Ink } => x.e !== null)
    for (const side of ['left', 'right'] as const) {
      const boxed = side === 'left' ? 'boxedLeft' : 'boxedRight'
      // A right edge is ink only where the row pushes its last item there.
      const usable = edges.filter(
        (x) =>
          side === 'left' || x.e[boxed] || getComputedStyle(x.i).justifyContent === 'space-between',
      )
      const near = usable.filter((a) =>
        usable.some((b) => {
          const d = Math.abs(a.e[side] - b.e[side])
          return d > tolerance && d < 8 && a.e[boxed] !== b.e[boxed]
        }),
      )
      if (near.length > 0) {
        report(
          'edge',
          el,
          'children do not share their ' +
            side +
            ' edge: ' +
            [
              ...new Set(near.map((x) => label(x.i) + ' at ' + Math.round(x.e[side] * 10) / 10)),
            ].join(' | '),
        )
      }
    }
  }

  // row-top and gap: flex and grid containers
  const LADDER = (n: number): boolean => {
    const r = Math.round(n)
    if (Math.abs(n - r) > 0.5) return false
    return r <= 16 ? r % 2 === 0 : r % 4 === 0
  }
  for (const el of all) {
    const s = getComputedStyle(el)
    const flex = s.display.includes('flex')
    const grid = s.display.includes('grid')
    if (!flex && !grid) continue
    const items = kids(el)
      .filter(inflow)
      .filter((i) => {
        const m = getComputedStyle(i)
        return (
          px(m.marginTop) >= 0 &&
          px(m.marginBottom) >= 0 &&
          px(m.marginLeft) >= 0 &&
          px(m.marginRight) >= 0
        )
      })
    if (items.length < 2) continue
    const column = flex && s.flexDirection.startsWith('column')
    const align = s.alignItems
    if (
      !column &&
      (align === 'normal' ||
        align === 'stretch' ||
        align === 'flex-start' ||
        align === 'start' ||
        align === 'flow-start') &&
      !(flex && s.flexWrap !== 'nowrap')
    ) {
      // group the items into rows by overlap of their vertical spans
      const rows: Element[][] = []
      for (const item of items) {
        const t = item.getBoundingClientRect()
        const row = rows.find((g) =>
          g.some((o) => {
            const q = o.getBoundingClientRect()
            const overlap = Math.min(q.bottom, t.bottom) - Math.max(q.top, t.top)
            return overlap > 0.5 * Math.min(q.height, t.height)
          }),
        )
        if (row === undefined) rows.push([item])
        else row.push(item)
      }
      for (const row of rows) {
        const free = row.filter((i) => getComputedStyle(i).alignSelf === 'auto')
        // An icon is aligned by its middle to the first line of its text, not by its top.
        const mark = (i: Element): boolean => {
          const r = i.getBoundingClientRect()
          return (
            i instanceof SVGElement ||
            ((i.textContent ?? '').trim() === '' && r.width <= 24 && r.height <= 24)
          )
        }
        const icons = free.filter(mark)
        const boxes = free.filter((i) => !mark(i))
        if (boxes.length >= 2) {
          const tops = boxes.map((i) => i.getBoundingClientRect().top)
          const spread = Math.max(...tops) - Math.min(...tops)
          if (spread > tolerance)
            report(
              'row-top',
              el,
              'siblings start ' +
                Math.round(spread * 10) / 10 +
                ' px apart: ' +
                boxes.map((i) => label(i)).join(' | '),
            )
        }
        const lead = boxes[0]
        // The first line is the first text's own block: a column's line-height is not its title's.
        let first: Element | null = null
        if (lead !== undefined) {
          const texts = document.createTreeWalker(lead, NodeFilter.SHOW_TEXT)
          for (let n = texts.nextNode(); n !== null && first === null; n = texts.nextNode()) {
            const host = n.parentElement
            if ((n.textContent ?? '').trim() !== '' && host !== null && shown(host)) first = host
          }
        }
        const line = first === null ? NaN : px(getComputedStyle(first).lineHeight)
        if (first !== null && !Number.isNaN(line)) {
          const middle =
            first.getBoundingClientRect().top + px(getComputedStyle(first).paddingTop) + line / 2
          for (const icon of icons) {
            const r = icon.getBoundingClientRect()
            if (r.height > line + tolerance) continue
            const off = Math.abs(r.top + r.height / 2 - middle)
            if (off > tolerance)
              report(
                'row-top',
                el,
                'an icon is ' +
                  Math.round(off * 10) / 10 +
                  ' px off the middle of the first line: ' +
                  label(icon),
              )
          }
        }
      }
    }
    if (flex && s.justifyContent.startsWith('space')) continue
    const gaps: number[] = []
    const ordered = items.toSorted((a, b) =>
      column
        ? a.getBoundingClientRect().top - b.getBoundingClientRect().top
        : a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1]!.getBoundingClientRect()
      const b = ordered[i]!.getBoundingClientRect()
      const g = column ? b.top - a.bottom : b.left - a.right
      if (g >= -0.5) gaps.push(Math.round(g * 10) / 10)
    }
    if (gaps.length === 0) continue
    const declared = column ? px(s.rowGap) : px(s.columnGap)
    // A chart legend's pitch is its hit-target arithmetic (legend.tsx), not a rung.
    if (declared > 0 && !LADDER(declared) && !el.hasAttribute('data-basalt-chart-legend'))
      report('gap', el, 'gap ' + declared + ' px is off the ladder')
    if (
      Math.max(...gaps) - Math.min(...gaps) > tolerance &&
      declared > 0 &&
      !(flex && s.flexWrap !== 'nowrap')
    ) {
      report('gap', el, 'one stack, gaps ' + [...new Set(gaps)].join(', ') + ' px')
    }
  }
  return found
}
