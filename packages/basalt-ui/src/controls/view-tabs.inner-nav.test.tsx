/**
 * `InnerNav` over a real `defineControls` push field (concept 4.4): every item is an `<a href>` that
 * names the section it opens, the active one carries `aria-current`, a click pushes one history entry
 * and Back walks the sections. The handle is the store's own field: its `useHref()` builds each href
 * through the router, so `InnerNav` itself imports none.
 */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { InnerNav } from '../page/parts/inner-nav'
import type { InnerNavGroup } from '../page/contract'
import { defineControls, resetControlsOwnersForTests } from '../router/controls/define'
import { field } from '../router/controls/field'
import { mountApp } from './view-tabs.test-support'

afterEach(() => {
  cleanup()
  resetControlsOwnersForTests()
})
beforeEach(resetControlsOwnersForTests)

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

async function mountNav(url: string) {
  const settings = store()
  const state = settings.field.section
  const mounted = await mountApp({
    url,
    store: settings,
    page: () => <InnerNav label="Settings" state={state} groups={GROUPS} />,
  })
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
      '/p?section=general', // choosing the fallback writes it: that is what opens its pane
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
