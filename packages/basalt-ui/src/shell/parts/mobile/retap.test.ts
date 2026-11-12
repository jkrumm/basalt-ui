/**
 * The retap law as pure DOM: which scroller moves first, when the click is swallowed and when it
 * goes through. happy-dom cannot lay out, so a scroller is a node whose `scrollTop` is set by hand,
 * with `getClientRects` and `scrollTo` stubbed to behave like a visible, scrollable box.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { MouseEvent } from 'react'
import { SHELL_MAIN_ID } from '../a11y'
import { deepestScrolledDescendant, retap, scrollShellToTop } from './retap'

type Calls = ToScrollArgs[]
type ToScrollArgs = { top: number; behavior: string }

const calls: Calls = []
const originalMatchMedia = window.matchMedia

/** A visible box scrolled `top` px down; `scrollTo` records its arguments and moves it. */
function scroller(parent: Element, top: number, id?: string): HTMLElement {
  const node = document.createElement('div')
  if (id !== undefined) node.id = id
  node.scrollTop = top
  node.getClientRects = () => [{}] as unknown as DOMRectList
  node.scrollTo = ((options: ScrollToOptions) => {
    calls.push({ top: options.top ?? 0, behavior: String(options.behavior) })
    node.scrollTop = options.top ?? 0
  }) as Element['scrollTo']
  parent.append(node)
  return node
}

function reducedMotion(reduce: boolean): void {
  window.matchMedia = ((query: string) =>
    ({
      matches: reduce && query.includes('reduce'),
      media: query,
    }) as MediaQueryList) as typeof window.matchMedia
}

function tap(href: string): { event: MouseEvent<HTMLElement>; prevented: () => boolean } {
  const anchor = document.createElement('a')
  anchor.setAttribute('href', href)
  let prevented = false
  const event = {
    currentTarget: anchor,
    preventDefault: () => {
      prevented = true
    },
  } as unknown as MouseEvent<HTMLElement>
  return { event, prevented: () => prevented }
}

const ACTIVE = { active: true, disabled: false }

beforeEach(() => {
  calls.length = 0
  reducedMotion(false)
})

afterEach(() => {
  document.body.replaceChildren()
  window.matchMedia = originalMatchMedia
})

describe('deepestScrolledDescendant', () => {
  test('is null for a missing root and for a tree nothing in which is scrolled', () => {
    expect(deepestScrolledDescendant(null)).toBeNull()
    const root = document.createElement('div')
    root.append(document.createElement('div'))
    expect(deepestScrolledDescendant(root)).toBeNull()
  })

  test('the deepest scrolled node wins over its scrolled ancestor', () => {
    const root = document.createElement('div')
    const outer = scroller(root, 40)
    const inner = scroller(outer, 10)
    expect(deepestScrolledDescendant(root)).toBe(inner)
  })

  test('a scrolled node with no layout box (hidden) is not scrolled', () => {
    const root = document.createElement('div')
    const hidden = scroller(root, 40)
    hidden.getClientRects = () => [] as unknown as DOMRectList
    expect(deepestScrolledDescendant(root)).toBeNull()
  })
})

describe('scrollShellToTop', () => {
  test('scrolls shell-main to its top first and reports it moved', () => {
    const main = scroller(document.body, 120, SHELL_MAIN_ID)
    const pane = scroller(main, 30)
    expect(scrollShellToTop()).toBe(true)
    expect(main.scrollTop).toBe(0)
    expect(pane.scrollTop).toBe(30)
    expect(calls).toEqual([{ top: 0, behavior: 'smooth' }])
  })

  test('falls back to the deepest scrolled inner element when main is at rest', () => {
    const main = scroller(document.body, 0, SHELL_MAIN_ID)
    const outer = scroller(main, 50)
    const pane = scroller(outer, 20)
    expect(scrollShellToTop()).toBe(true)
    expect(pane.scrollTop).toBe(0)
    expect(outer.scrollTop).toBe(50)
  })

  test('falls back to the document scrolling element when nothing inside moved', () => {
    const doc = document.scrollingElement ?? document.documentElement
    doc.scrollTop = 200
    const scrollTo = mock((options: ScrollToOptions) => {
      doc.scrollTop = options.top ?? 0
    })
    doc.scrollTo = scrollTo as unknown as Element['scrollTo']
    scroller(document.body, 0, SHELL_MAIN_ID)
    expect(scrollShellToTop()).toBe(true)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(doc.scrollTop).toBe(0)
  })

  test('without a shell it still searches the body for a scrolled element', () => {
    const doc = document.scrollingElement ?? document.documentElement
    doc.scrollTop = 0
    const pane = scroller(document.body, 15)
    expect(scrollShellToTop()).toBe(true)
    expect(pane.scrollTop).toBe(0)
  })

  test('reports false when nothing is scrolled', () => {
    const doc = document.scrollingElement ?? document.documentElement
    doc.scrollTop = 0
    scroller(document.body, 0, SHELL_MAIN_ID)
    expect(scrollShellToTop()).toBe(false)
    expect(calls).toEqual([])
  })

  test('reduced motion scrolls with behavior auto, otherwise smooth', () => {
    reducedMotion(true)
    scroller(document.body, 80, SHELL_MAIN_ID)
    scrollShellToTop()
    expect(calls).toEqual([{ top: 0, behavior: 'auto' }])
  })
})

describe('retap', () => {
  test('a disabled row swallows the tap and returns false', () => {
    const { event, prevented } = tap('/runs')
    expect(retap({ active: false, disabled: true }, event, '/')).toBe(false)
    expect(prevented()).toBe(true)
  })

  test('a non-active row is never prevented and does not scroll', () => {
    scroller(document.body, 90, SHELL_MAIN_ID)
    const { event, prevented } = tap('/runs')
    expect(retap({ active: false, disabled: false }, event, '/runs')).toBe(true)
    expect(prevented()).toBe(false)
    expect(calls).toEqual([])
  })

  test('the active row scrolled main to top and swallows the navigation', () => {
    const main = scroller(document.body, 90, SHELL_MAIN_ID)
    const { event, prevented } = tap('/runs')
    expect(retap(ACTIVE, event, '/other')).toBe(true)
    expect(main.scrollTop).toBe(0)
    expect(prevented()).toBe(true)
  })

  test('the active row on a scrolled inner pane scrolls it and swallows the click', () => {
    const main = scroller(document.body, 0, SHELL_MAIN_ID)
    const pane = scroller(main, 25)
    const { event, prevented } = tap('/runs')
    retap(ACTIVE, event, '/other')
    expect(pane.scrollTop).toBe(0)
    expect(prevented()).toBe(true)
  })

  test('with nothing scrolled, an anchor equal to the current href still swallows the click', () => {
    scroller(document.body, 0, SHELL_MAIN_ID)
    const { event, prevented } = tap('/runs')
    expect(retap(ACTIVE, event, '/runs')).toBe(true)
    expect(prevented()).toBe(true)
  })

  test('with nothing scrolled, a different href (a deeper route is open) lets the click through', () => {
    scroller(document.body, 0, SHELL_MAIN_ID)
    const { event, prevented } = tap('/runs')
    expect(retap(ACTIVE, event, '/runs/42')).toBe(true)
    expect(prevented()).toBe(false)
  })

  test('a non-anchor target with nothing scrolled is not prevented', () => {
    scroller(document.body, 0, SHELL_MAIN_ID)
    const prevented = mock(() => {})
    const event = {
      currentTarget: document.createElement('button'),
      preventDefault: prevented,
    } as unknown as MouseEvent<HTMLElement>
    retap(ACTIVE, event, '/runs')
    expect(prevented).not.toHaveBeenCalled()
  })
})
