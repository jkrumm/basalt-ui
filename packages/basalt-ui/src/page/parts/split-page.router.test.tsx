/**
 * `SplitPage` over a real `defineControls` push field under a memory-history router: choosing the
 * fallback section writes it (`?section=general`) so the pane opens, Back returns to the list, and
 * `clear()` closes it again. The structural double is `split-page.test.tsx`'s.
 */
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { defineControls, resetControlsOwnersForTests } from '../../router/controls/define'
import { field } from '../../router/controls/field'
import { InnerNav } from './inner-nav'
import { SplitPage } from './split-page'

const GROUPS = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'general', label: 'General' },
      { id: 'billing', label: 'Billing' },
    ],
  },
] as const

type Router = {
  load(): Promise<void>
  history: { back(): void }
  state: { location: { href: string } }
}

async function mount(
  url: string,
): Promise<{ router: Router; clear: () => void; other: () => void }> {
  const store = defineControls({
    id: 'split-page-router',
    scope: 'page',
    fields: {
      section: field.enum(['general', 'billing'], 'general', { history: 'push' }),
      q: field.string(''),
    },
  })
  const pane = store.field.section
  let setQ: (v: string) => void = () => {}
  function Page() {
    const [section] = pane.use()
    ;[, setQ] = store.field.q.use()
    return (
      <SplitPage
        selected={pane.useIsSet()}
        list={() => <InnerNav label="Settings" state={pane} groups={GROUPS} />}
        detail={() => <p>Pane: {section}</p>}
      />
    )
  }
  const root = createRootRoute({
    validateSearch: store.validateSearch as never,
    search: { middlewares: store.middlewares as never },
    component: Page,
  })
  const create = createRouter as unknown as (o: object) => Router
  const router = create({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root as never, path: '/' }),
    ] as never),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  await router.load()
  render(createElement(RouterProvider as never, { router }))
  return { router, clear: () => pane.clear(), other: () => setQ('1') }
}

beforeEach(resetControlsOwnersForTests)
afterEach(cleanup)

const selected = (): boolean =>
  document.querySelector('[data-slot="split-page"]')?.hasAttribute('data-selected') === true

const settle = async (router: Router): Promise<void> => {
  await act(async () => {
    await router.load()
  })
}

describe('SplitPage on a defineControls push field', () => {
  test('unset: the list shows; nothing is in the URL', async () => {
    const { router } = await mount('/')
    expect(selected()).toBe(false)
    expect(router.state.location.href).toBe('/')
  })

  test('choosing the fallback writes it and opens its pane; Back returns to the list', async () => {
    const { router } = await mount('/')
    fireEvent.click(screen.getByRole('link', { name: /General/ }))
    await settle(router)
    expect(router.state.location.href).toBe('/?section=general')
    expect(selected()).toBe(true)

    await act(async () => {
      router.history.back()
      await router.load()
    })
    expect(router.state.location.href).toBe('/')
    expect(selected()).toBe(false)
  })

  test('a section that is not the fallback opens its pane and the fallback is still choosable', async () => {
    const { router } = await mount('/')
    fireEvent.click(screen.getByRole('link', { name: /Billing/ }))
    await settle(router)
    expect(router.state.location.href).toBe('/?section=billing')
    expect(selected()).toBe(true)

    fireEvent.click(screen.getByRole('link', { name: /General/ }))
    await settle(router)
    expect(router.state.location.href).toBe('/?section=general')
    expect(selected()).toBe(true)
  })

  test('a navigation that changes something else keeps the chosen fallback', async () => {
    const { router, other } = await mount('/')
    fireEvent.click(screen.getByRole('link', { name: /General/ }))
    await settle(router)
    act(() => other())
    await settle(router)
    expect(router.state.location.href).toBe('/?section=general&q=%221%22')
    expect(selected()).toBe(true)
  })

  test('clear() unsets the field and shows the list again', async () => {
    const { router, clear } = await mount('/')
    fireEvent.click(screen.getByRole('link', { name: /General/ }))
    await settle(router)
    act(() => clear())
    await settle(router)
    expect(router.state.location.href).toBe('/')
    expect(selected()).toBe(false)
  })
})
