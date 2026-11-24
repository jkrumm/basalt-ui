/**
 * The favorites: a record's star adds it to the rail's section and takes it off, the list persists
 * as `{ id, label, href }` under `<storageKey>-favorites`, a stored entry that leaves the app is
 * dropped, and the section draws nothing while it is empty.
 */
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { FavoriteToggle, FavoritesContext, persistedFavorites } from '../../page/favorites'
import { useFavoritesApi } from '../favorites-host'
import { RailFavorites } from './rail-favorites'
import { renderInRouter } from './rail-test-kit'

/** Mounts under the memory router and waits for the first match to paint. */
async function mount(ui: React.ReactElement, collapsed = false): Promise<void> {
  await renderInRouter(ui, collapsed)
  await waitFor(() => expect(document.querySelector('[aria-pressed]')).not.toBeNull())
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const KEY = 'basalt:argo-sidebar-favorites'

function Host(): React.ReactElement {
  const api = useFavoritesApi(undefined, 'argo-sidebar')
  return (
    <FavoritesContext value={api}>
      <FavoriteToggle id="run-12" label="Run 12" target="/runs/12" />
      <FavoriteToggle id="run-7" label="Run 7" target="/runs/7" />
      <RailFavorites />
    </FavoritesContext>
  )
}

const stored = (): unknown => JSON.parse(localStorage.getItem(KEY) ?? 'null')

describe('favouriting a record', () => {
  test('no favorite, no section', async () => {
    await mount(<Host />)
    expect(document.querySelector('[data-slot="shell-rail-favorites"]')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Add to favorites' })).toHaveLength(2)
  })

  test('the star adds the record: the section appears, the entry persists as text', async () => {
    await mount(<Host />)
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Add to favorites' })[0]!)
    })
    const section = document.querySelector('[data-slot="shell-rail-favorites"]')!
    expect(section.querySelector('a[href="/runs/12"]')?.textContent).toContain('Run 12')
    expect(stored()).toEqual({ v: 1, value: [{ id: 'run-12', label: 'Run 12', href: '/runs/12' }] })
    expect(
      screen.getByRole('button', { name: 'Remove from favorites' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  test('the star again takes it off, and the section goes with the last entry', async () => {
    await mount(<Host />)
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Add to favorites' })[0]!)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites' }))
    })
    expect(document.querySelector('[data-slot="shell-rail-favorites"]')).toBeNull()
    expect(stored()).toEqual({ v: 1, value: [] })
  })

  test('a reload shows what was stored', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ v: 1, value: [{ id: 'run-7', label: 'Run 7', href: '/runs/7' }] }),
    )
    await mount(<Host />)
    expect(document.querySelector('a[data-favorite="run-7"]')?.getAttribute('href')).toBe('/runs/7')
    expect(screen.getByRole('button', { name: 'Remove from favorites' })).toBeTruthy()
  })

  test('the row is reorderable while the rail is open: one handle per row', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        v: 1,
        value: [
          { id: 'run-7', label: 'Run 7', href: '/runs/7' },
          { id: 'run-12', label: 'Run 12', href: '/runs/12' },
        ],
      }),
    )
    await mount(<Host />)
    expect(document.querySelectorAll('[data-sortable="handle"]')).toHaveLength(2)
    const handle = document.querySelector<HTMLElement>('[data-sortable="handle"]')!
    await act(async () => {
      fireEvent.keyDown(handle, { key: 'ArrowDown' })
    })
    expect((stored() as { value: { id: string }[] }).value.map((e) => e.id)).toEqual([
      'run-12',
      'run-7',
    ])
  })

  test('collapsed: plain icon rows, no handles', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ v: 1, value: [{ id: 'run-7', label: 'Run 7', href: '/runs/7' }] }),
    )
    await mount(<Host />, true)
    expect(document.querySelectorAll('[data-sortable="handle"]')).toHaveLength(0)
    expect(document.querySelector('a[data-favorite="run-7"]')).not.toBeNull()
  })
})

describe('the default store', () => {
  test('entries that leave the app or are not entries are dropped when read', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        v: 1,
        value: [
          { id: 'a', label: 'A', href: '/a' },
          { id: 'b', label: 'B', href: 'https://example.com' },
          { id: 'c', label: 'C', href: '//example.com' },
          { id: 'd', label: 'D', href: 'javascript:alert(1)' },
          { id: 'f', label: 'F', href: '/\\example.com' },
          { id: 'e' },
          'text',
        ],
      }),
    )
    const store = persistedFavorites('argo-sidebar-favorites')
    expect(store.get()).toEqual([{ id: 'a', label: 'A', href: '/a' }])
    expect(store.get()).toBe(store.get())
  })

  test('the toggle draws nothing outside an AppShell', async () => {
    await renderInRouter(<FavoriteToggle id="x" label="X" target="/x" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
