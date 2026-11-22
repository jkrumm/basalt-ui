/**
 * `usePeek` against a memory-history router and a real global store: the `?peek=` address, the one
 * click handler and what it leaves alone, the one-entry history (push to open, replace to swap, back
 * to close), the page the peek belongs to and the Escape rule.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { createElement, useEffect } from 'react'
import { defineControls, resetControlsOwnersForTests } from './controls/define'
import { field } from './controls/field'
import { recordAt, usePeek } from './peek'
import type { PeekState } from './peek'

type Loose = {
  load(): Promise<void>
  navigate(o: object): Promise<void>
  history: { back(): void; length: number }
  state: { location: { pathname: string; search: Record<string, unknown> } }
}

const KINDS = { issue: '/issues/$id', artifact: '/artifacts/$id' } as const

let peek: PeekState | undefined
let dockOn = true

function Probe(): null {
  const state = usePeek({
    field: globals.field.peek,
    ...(dockOn && { dockField: globals.field.dock }),
    kinds: KINDS,
  })
  useEffect(() => {
    peek = state
  })
  return null
}

// Defined per test: `resetControlsOwnersForTests` frees the global's params.
let globals: ReturnType<typeof makeGlobals>
const makeGlobals = () =>
  defineControls({
    id: 'globals',
    scope: 'global',
    fields: { peek: field.string(''), dock: field.string('') },
  })

const LINKS = (
  <nav>
    <a href="/issues/12">issue 12</a>
    <a href="/issues/13">issue 13</a>
    <a href="/artifacts/a-1">artifact</a>
    <a href="/other">other page</a>
    <a href="/issues/12" target="_blank">
      blank
    </a>
    <a href="/issues/12" download>
      download
    </a>
    <span data-peek="off">
      <a href="/issues/12">off</a>
    </span>
    <a href="https://elsewhere.example/issues/12">external</a>
    <a href="/issues/12" data-preview-first-tap="">
      first tap
    </a>
    <input aria-label="field" />
  </nav>
)

async function mount(url: string): Promise<Loose> {
  const root = createRootRoute({
    validateSearch: globals.validateSearch as never,
    search: { middlewares: globals.middlewares as never },
    component: () => createElement('div', null, createElement(Probe), LINKS, createElement(Outlet)),
  })
  const page = (path: string) => createRoute({ getParentRoute: () => root as never, path })
  const create = createRouter as unknown as (o: object) => Loose
  const router = create({
    routeTree: root.addChildren([
      page('/'),
      page('/other'),
      page('/issues/$id'),
      page('/artifacts/$id'),
    ] as never),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  await router.load()
  render(createElement(RouterProvider as never, { router }))
  return router
}

const link = (text: string): HTMLElement => {
  const el = [...document.querySelectorAll('a')].find((a) => a.textContent === text)
  if (el === undefined) throw new Error(`no link "${text}"`)
  return el
}

/**
 * Clicks a link and says whether the browser would have followed it: the handler under test stops
 * a click it took, so one that reaches the window unprevented is one it left alone. The window
 * listener then cancels it, so happy-dom does not try to fetch the link.
 */
const click = async (text: string, init: MouseEventInit = {}): Promise<boolean> => {
  let followed = false
  const swallow = (event: Event): void => {
    followed = !event.defaultPrevented
    event.preventDefault()
  }
  window.addEventListener('click', swallow)
  await act(async () => {
    fireEvent.click(link(text), { button: 0, ...init })
    await Promise.resolve()
  })
  window.removeEventListener('click', swallow)
  return followed
}

const key = async (name: string, target: Element | Window = window): Promise<void> => {
  await act(async () => {
    fireEvent.keyDown(target, { key: name })
    await Promise.resolve()
  })
}

const peekParam = (router: Loose): unknown => router.state.location.search['peek']
const dockParam = (router: Loose): unknown => router.state.location.search['dock']

beforeEach(() => {
  ;(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
    'http://localhost/',
  )
  resetControlsOwnersForTests()
  globals = makeGlobals()
  peek = undefined
  dockOn = true
})
afterEach(cleanup)

describe('usePeek: the address', () => {
  test('?peek=issue/12 opens the record and names its own page', async () => {
    await mount('/?peek=issue/12')
    expect(peek?.open).toEqual({ kind: 'issue', id: '12' })
    expect(peek?.fullPage).toBe('/issues/12')
  })

  test('an empty address and an unknown kind are closed', async () => {
    await mount('/?peek=ticket/12')
    expect(peek?.open).toBeNull()
    expect(peek?.fullPage).toBeNull()
  })

  test('an id is encoded in the full page path', async () => {
    await mount('/?peek=artifact/a%20b')
    expect(peek?.open).toEqual({ kind: 'artifact', id: 'a b' })
    expect(peek?.fullPage).toBe('/artifacts/a%20b')
  })
})

describe('usePeek: the click handler', () => {
  test('a plain click on a record link opens the peek and keeps the page', async () => {
    const router = await mount('/')
    const allowed = await click('issue 12')
    expect(allowed).toBe(false)
    expect(peekParam(router)).toBe('issue/12')
    expect(router.state.location.pathname).toBe('/')
    expect(peek?.open).toEqual({ kind: 'issue', id: '12' })
  })

  test('a modifier click, a middle click, a target, a download, data-peek="off", another origin and a non-record link are left alone', async () => {
    const router = await mount('/')
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }])
      expect(await click('issue 12', init)).toBe(true)
    expect(await click('issue 12', { button: 1 })).toBe(true)
    expect(await click('blank')).toBe(true)
    expect(await click('download')).toBe(true)
    expect(await click('off')).toBe(true)
    expect(await click('external')).toBe(true)
    expect(await click('other page')).toBe(true)
    expect(peekParam(router)).toBeUndefined()
  })

  test('a click on the record page itself, with the peek closed, is the full view', async () => {
    const router = await mount('/issues/12')
    expect(await click('issue 13')).toBe(true)
    expect(peekParam(router)).toBeUndefined()
  })

  test('swapping to the open record is a no-op that still holds the click', async () => {
    const router = await mount('/')
    await click('issue 12')
    expect(await click('issue 12')).toBe(false)
    expect(peekParam(router)).toBe('issue/12')
  })
})

describe('usePeek: history', () => {
  test('open pushes one entry, swap replaces it, and Back leaves the page as it was', async () => {
    const router = await mount('/')
    const before = router.history.length
    await click('issue 12')
    expect(router.history.length).toBe(before + 1)
    await click('issue 13')
    await click('artifact')
    expect(peekParam(router)).toBe('artifact/a-1')
    expect(router.history.length).toBe(before + 1)
    await act(async () => {
      router.history.back()
      await Promise.resolve()
    })
    expect(peekParam(router)).toBeUndefined()
    expect(peek?.open).toBeNull()
  })

  test('go swaps the record of the same kind in place, and Back still closes the peek', async () => {
    const router = await mount('/')
    const before = router.history.length
    await click('issue 12')
    await act(async () => {
      peek?.go('13')
      await Promise.resolve()
    })
    expect(peekParam(router)).toBe('issue/13')
    expect(peek?.open).toEqual({ kind: 'issue', id: '13' })
    expect(router.history.length).toBe(before + 1)
    await act(async () => {
      router.history.back()
      await Promise.resolve()
    })
    expect(peekParam(router)).toBeUndefined()
  })

  test('close steps back one entry when this hook pushed it', async () => {
    const router = await mount('/')
    await click('issue 12')
    await click('issue 13')
    await act(async () => {
      peek?.close()
      await Promise.resolve()
    })
    expect(peekParam(router)).toBeUndefined()
    expect(peek?.open).toBeNull()
  })

  test('close clears the address in place when the page was loaded with the peek open', async () => {
    const router = await mount('/?peek=issue/12')
    const before = router.history.length
    await act(async () => {
      peek?.close()
      await Promise.resolve()
    })
    expect(peekParam(router)).toBeUndefined()
    expect(router.history.length).toBe(before)
    expect(peek?.open).toBeNull()
  })
})

describe('usePeek: the page it belongs to', () => {
  test('navigating to another page drops it', async () => {
    const router = await mount('/')
    await click('issue 12')
    await act(async () => {
      await router.navigate({ to: '/other' })
    })
    expect(router.state.location.pathname).toBe('/other')
    expect(peek?.open).toBeNull()
    expect(peekParam(router)).toBeUndefined()
  })
})

describe('usePeek: Escape', () => {
  test('closes an open peek', async () => {
    const router = await mount('/')
    await click('issue 12')
    await key('Escape')
    expect(peekParam(router)).toBeUndefined()
  })

  test('does nothing while the peek is closed', async () => {
    const router = await mount('/')
    await key('Escape')
    expect(peekParam(router)).toBeUndefined()
    expect(peek?.open).toBeNull()
  })

  test('belongs to an open menu first', async () => {
    const router = await mount('/')
    await click('issue 12')
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    document.body.append(menu)
    await key('Escape')
    menu.remove()
    expect(peekParam(router)).toBe('issue/12')
  })

  test('in a field only leaves the field', async () => {
    const router = await mount('/')
    await click('issue 12')
    const input = document.querySelector('input')
    input?.focus()
    await key('Escape', input as HTMLInputElement)
    expect(document.activeElement).not.toBe(input)
    expect(peekParam(router)).toBe('issue/12')
  })
})

describe('usePeek: a card trigger', () => {
  test('a link marked as a first touch tap is left to its card, the next click opens the peek', async () => {
    await mount('/')
    expect(await click('first tap')).toBe(true)
    expect(peek?.open).toBeNull()
    expect(await click('issue 12')).toBe(false)
    expect(peek?.open).toEqual({ kind: 'issue', id: '12' })
  })
})

describe('recordAt', () => {
  test('names the record a link points at from the same kinds as the peek', () => {
    expect(recordAt(KINDS, '/issues/12')).toEqual({ kind: 'issue', id: '12' })
    expect(recordAt(KINDS, '/issues/12?tab=notes#top')).toEqual({ kind: 'issue', id: '12' })
    expect(recordAt(KINDS, 'http://localhost/artifacts/a%2D1/')).toEqual({
      kind: 'artifact',
      id: 'a-1',
    })
  })

  test('another origin, another page and a nested path are not a record', () => {
    expect(recordAt(KINDS, 'https://elsewhere.example/issues/12')).toBeNull()
    expect(recordAt(KINDS, '/other')).toBeNull()
    expect(recordAt(KINDS, '/issues/12/notes')).toBeNull()
    expect(recordAt(KINDS, '/issues/100%')).toBeNull()
  })
})

describe('usePeek: the dock', () => {
  test('?dock=issue/12 opens the docked record and names its own page', async () => {
    await mount('/?dock=issue/12')
    expect(peek?.dock.open).toEqual({ kind: 'issue', id: '12' })
    expect(peek?.dock.fullPage).toBe('/issues/12')
    expect(peek?.open).toBeNull()
  })

  test('without a dockField the dock is always closed and pin does nothing', async () => {
    dockOn = false
    const router = await mount('/')
    await click('issue 12')
    await act(async () => peek?.pin())
    expect(peek?.open).toEqual({ kind: 'issue', id: '12' })
    expect(dockParam(router)).toBeFalsy()
  })

  test('a docked record stays through a pathname change; a peek does not', async () => {
    const router = await mount('/?dock=issue/12&peek=issue/13')
    expect(peek?.open).toEqual({ kind: 'issue', id: '13' })
    await act(async () => {
      await router.navigate({ to: '/other', search: (prev: object) => prev })
    })
    expect(router.state.location.pathname).toBe('/other')
    expect(peek?.dock.open).toEqual({ kind: 'issue', id: '12' })
    expect(peek?.open).toBeNull()
  })

  test('while a dock is open a plain click swaps its record, opens no peek and adds no history', async () => {
    const router = await mount('/?dock=issue/12')
    const before = router.history.length
    expect(await click('issue 13')).toBe(false)
    expect(dockParam(router)).toBe('issue/13')
    expect(peekParam(router)).toBeFalsy()
    expect(router.history.length).toBe(before)
    expect(peek?.dock.open).toEqual({ kind: 'issue', id: '13' })
  })

  test('an open dock takes the click on a record page too, and holds a click on the docked record', async () => {
    const router = await mount('/issues/12?dock=issue/12')
    expect(await click('issue 13')).toBe(false)
    expect(dockParam(router)).toBe('issue/13')
    expect(await click('issue 13')).toBe(false)
    expect(dockParam(router)).toBe('issue/13')
  })

  test('pin moves the open peek into the dock in one replace', async () => {
    const router = await mount('/')
    await click('issue 12')
    const after = router.history.length
    await act(async () => peek?.pin())
    expect(dockParam(router)).toBe('issue/12')
    expect(peekParam(router)).toBeFalsy()
    expect(router.history.length).toBe(after)
    expect(peek?.open).toBeNull()
    expect(peek?.dock.open).toEqual({ kind: 'issue', id: '12' })
  })

  test('pin with no peek open writes nothing', async () => {
    const router = await mount('/')
    await act(async () => peek?.pin())
    expect(dockParam(router)).toBeFalsy()
  })

  test('dock.close clears the field in place', async () => {
    const router = await mount('/?dock=issue/12')
    const before = router.history.length
    await act(async () => peek?.dock.close())
    expect(peek?.dock.open).toBeNull()
    expect(router.history.length).toBe(before)
  })
})
