/**
 * `InnerNav` over a real `defineControls` push field (concept 4.4): every item is an `<a href>` that
 * names the section it opens, the active one carries `aria-current`, a click pushes one history entry
 * and Back walks the sections. The handle's `link()` speaks the router's `Link` props
 * (`{ search, replace }`); `InnerNav` wants `{ href, onClick }`, so the suite binds the two with the
 * `bindPush` adapter below, the shape the controls layer hands a page.
 */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { MouseEvent } from 'react'
import type { InnerNavHandle } from '../page/parts/inner-nav'
import { InnerNav } from '../page/parts/inner-nav'
import type { InnerNavGroup, PushField } from '../page/contract'
import { defineControls, resetControlsOwnersForTests } from '../router/controls/define'
import { field } from '../router/controls/field'
import { mountApp } from './view-tabs.test-support'
import type { TestRouter } from './view-tabs.test-support'

afterEach(() => {
  cleanup()
  resetControlsOwnersForTests()
})
beforeEach(resetControlsOwnersForTests)

type Section = 'general' | 'billing' | 'team'

const GROUPS: readonly InnerNavGroup[] = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'general', label: 'General' },
      { id: 'billing', label: 'Billing' },
    ],
  },
  { id: 'org', label: 'Organisation', items: [{ id: 'team', label: 'Team' }] },
]

const store = () =>
  defineControls({
    id: 'vt-settings',
    scope: 'page',
    fields: { section: field.enum(['general', 'billing', 'team'], 'general', { history: 'push' }) },
  })

/** A router push field as `InnerNav` reads it: `isSet` from the URL, `link()` as `href` + `onClick`. */
function bindPush(
  handle: ReturnType<typeof store>['field']['section'],
  router: TestRouter,
): InnerNavHandle<Section> {
  const to = (value: string): { search: (prev: object) => object; replace: boolean } => ({
    ...handle.link(value as never),
    search: (prev) => ({ ...prev, ...handle.link(value as never).search }),
  })
  return Object.create(handle, {
    isSet: {
      get: () =>
        new URL(router.state.location.href, 'http://localhost').searchParams.has(handle.key),
    },
    link: {
      value: (value: Section) => ({
        href: router.buildLocation({ to: '.', ...to(value) }).href,
        onClick: (event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault()
          void router.navigate({ to: '.', ...to(value) })
        },
      }),
    },
  }) as InnerNavHandle<Section>
}

async function mountNav(url: string) {
  const settings = store()
  let state!: InnerNavHandle<Section>
  const mounted = await mountApp({
    url,
    store: settings,
    page: () => <InnerNav label="Settings" state={state as PushField<Section>} groups={GROUPS} />,
  })
  state = bindPush(settings.field.section, mounted.router)
  return { ...mounted, state }
}

const links = (): HTMLAnchorElement[] => [
  ...document.querySelectorAll<HTMLAnchorElement>('[data-slot="inner-nav-item"] a'),
]
const current = (): string | null =>
  document.querySelector('a[aria-current="page"]')?.textContent ?? null

describe('InnerNav over a push field', () => {
  test('the field is a push field', async () => {
    const { state } = await mountNav('/p')
    expect(state.history).toBe('push')
  })

  test('every item is a real link naming its section; the deep-linked one is current', async () => {
    const { app } = await mountNav('/p?section=billing')
    render(app)
    await waitFor(() => expect(links()).toHaveLength(3))
    expect(links().map((a) => a.getAttribute('href'))).toEqual([
      '/p', // the default is absent from the URL (defaults never pin)
      '/p?section=billing',
      '/p?section=team',
    ])
    expect(current()).toBe('Billing')
    expect(document.querySelectorAll('a[aria-current]')).toHaveLength(1)
  })

  test('a click pushes one entry per section and Back walks them', async () => {
    const { app, history, router } = await mountNav('/p?section=general')
    render(app)
    await waitFor(() => expect(links()).toHaveLength(3))
    const length = history.length

    fireEvent.click(links()[1] as HTMLAnchorElement)
    await waitFor(() => expect(current()).toBe('Billing'))
    fireEvent.click(links()[2] as HTMLAnchorElement)
    await waitFor(() => expect(current()).toBe('Team'))
    expect(history.length).toBe(length + 2)
    expect(router.state.location.search['section']).toBe('team')

    await act(async () => {
      history.back()
    })
    await waitFor(() => expect(current()).toBe('Billing'))
    await act(async () => {
      history.back()
    })
    await waitFor(() => expect(current()).toBe('General'))
  })

  test('picking the current section again adds no history entry', async () => {
    const { app, history } = await mountNav('/p?section=billing')
    render(app)
    await waitFor(() => expect(links()).toHaveLength(3))
    const length = history.length
    fireEvent.click(links()[1] as HTMLAnchorElement)
    await act(async () => {})
    expect(history.length).toBe(length)
  })
})
