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
import { usePeek } from './peek'
import type { PeekState } from './peek'

type Loose = {
  load(): Promise<void>
  navigate(o: object): Promise<void>
  history: { back(): void; length: number }
  state: { location: { pathname: string; search: Record<string, unknown> } }
}

const KINDS = { issue: '/issues/$id', artifact: '/artifacts/$id' } as const

let peek: PeekState | undefined

function Probe(): null {
  const state = usePeek({ field: globals.field.peek, kinds: KINDS })
  useEffect(() => {
    peek = state
  })
  return null
}

// Defined per test: `resetControlsOwnersForTests` frees the global's params.
let globals: ReturnType<typeof makeGlobals>
const makeGlobals = () =>
  defineControls({ id: 'globals', scope: 'global', fields: { peek: field.string('') } })

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

beforeEach(() => {
  ;(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
    'http://localhost/',
  )
  resetControlsOwnersForTests()
  globals = makeGlobals()
  peek = undefined
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
