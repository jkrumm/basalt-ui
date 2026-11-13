/**
 * `ViewTabs` (v3): bound to a handle, never to `value`/`onChange`; both forms named and mounted once
 * each, swapped in CSS; `only` drops a tab from one form; a `row` home draws a panel row. Over a
 * real router: a deep link renders its tab in the server HTML and Back returns to the tab left.
 */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import type { ReactElement } from 'react'
import { defineControls, resetControlsOwnersForTests } from '../router/controls/define'
import { field } from '../router/controls/field'
import type { ControlPresentation } from './contract'
import { ControlPresentationContext } from './control-view'
import { memoryHandle } from './control-view.handles'
import { ViewTabs } from './view-tabs'
import type { ViewTabsOption, ViewTabsProps } from './view-tabs'
import { mountApp } from './view-tabs.test-support'

afterEach(() => {
  cleanup()
  resetControlsOwnersForTests()
})
beforeEach(resetControlsOwnersForTests)

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'history', label: 'History' },
  { value: 'train', label: 'Train' },
]

const handleOf = (initial = 'overview', options = TABS) =>
  memoryHandle<string>('tab', initial, { kind: 'enum', options })

const show = (node: ReactElement, presentation?: ControlPresentation) =>
  render(
    presentation === undefined ? (
      node
    ) : (
      <ControlPresentationContext value={presentation}>{node}</ControlPresentationContext>
    ),
  )

describe('the two forms', () => {
  test('one mount each: a strip from md up, a track below it, swapped by CSS classes only', () => {
    const { container } = show(<ViewTabs handle={handleOf()} />)
    const strip = container.querySelectorAll('[data-slot="tabs"]')
    const track = container.querySelectorAll('[data-slot="segmented"]')
    expect(strip).toHaveLength(1)
    expect(track).toHaveLength(1)
    expect(strip[0]?.className).toContain('max-md:hidden')
    expect(track[0]?.parentElement?.className).toContain('md:hidden')
  })

  test('both forms carry the accessible name', () => {
    const { container, getByRole } = show(<ViewTabs handle={handleOf()} label="Overview view" />)
    expect(getByRole('tablist', { name: 'Overview view' })).not.toBeNull()
    expect(container.querySelector('[data-slot="segmented"]')?.getAttribute('aria-label')).toBe(
      'Overview view',
    )
  })

  test('the name defaults to View', () => {
    const { getByRole } = show(<ViewTabs handle={handleOf()} />)
    expect(getByRole('tablist', { name: 'View' })).not.toBeNull()
  })

  test('past three options the narrow form is a named Select, the strip stays', () => {
    const many = [...TABS, { value: 'logs', label: 'Logs' }]
    const { container, getByRole } = show(
      <ViewTabs handle={handleOf('overview', many)} label="Section" />,
    )
    expect(container.querySelector('[data-slot="segmented"]')).toBeNull()
    expect(container.querySelector('[data-slot="select"]')).not.toBeNull()
    expect(getByRole('combobox', { name: 'Section' })).not.toBeNull()
    expect(getByRole('tablist', { name: 'Section' })).not.toBeNull()
  })

  test('the value comes from the handle in both forms', () => {
    const { getByRole, container } = show(<ViewTabs handle={handleOf('history')} />)
    expect(getByRole('tab', { name: 'History' }).getAttribute('aria-selected')).toBe('true')
    const pressed = container.querySelector('[data-slot="segmented-item"][data-pressed]')
    expect(pressed?.textContent).toBe('History')
  })

  test('a tab click writes through the handle; so does a track click', () => {
    const handle = handleOf()
    const { getByRole, container } = show(<ViewTabs handle={handle} />)
    fireEvent.click(getByRole('tab', { name: 'History' }))
    expect(handle.writes).toEqual(['history'])
    const items = container.querySelectorAll<HTMLElement>('[data-slot="segmented-item"]')
    fireEvent.click(items[2] as HTMLElement)
    expect(handle.writes).toEqual(['history', 'train'])
  })

  test('disabled makes every tab inert', () => {
    const { getAllByRole } = show(<ViewTabs handle={handleOf()} disabled />)
    for (const tab of getAllByRole('tab')) expect(tab.hasAttribute('data-disabled')).toBe(true)
  })

  test('className is layout only and lands on the one root', () => {
    const { container } = show(<ViewTabs handle={handleOf()} className="probe" />)
    expect(container.querySelectorAll('.probe')).toHaveLength(1)
    expect(container.querySelector('[data-slot="view-tabs"]')?.classList.contains('probe')).toBe(
      true,
    )
  })
})

describe('only', () => {
  const options: ViewTabsOption[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'history', label: 'History' },
    { value: 'train', label: 'Train', only: 'sm-down' },
    { value: 'export', label: 'Export', only: 'sm-up' },
  ]

  test("'sm-down' keeps a tab off the strip, 'sm-up' keeps it off the track", () => {
    const { getAllByRole, container } = show(<ViewTabs handle={handleOf()} options={options} />)
    expect(getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'History', 'Export'])
    const track = [...container.querySelectorAll('[data-slot="segmented-item"]')]
    expect(track.map((t) => t.textContent)).toEqual(['Overview', 'History', 'Train'])
  })

  test('a row offers every option: a panel is one width', () => {
    const { container, queryByRole } = show(
      <ViewTabs handle={handleOf()} options={options} label="Mode" />,
      'row',
    )
    expect(queryByRole('tablist')).toBeNull()
    expect(container.querySelectorAll('[data-slot="view-tabs"] [data-slot="select"]')).toHaveLength(
      1,
    )
  })
})

describe('inside a row home (PageAside)', () => {
  test('a label above one full-width form, named by that label', () => {
    const { container, queryByRole } = show(<ViewTabs handle={handleOf()} label="Mode" />, 'row')
    const root = container.querySelector('[data-slot="view-tabs"]') as HTMLElement
    expect(root.dataset['presentation']).toBe('row')
    expect(root.querySelector('span')?.textContent).toBe('Mode')
    expect(queryByRole('tablist')).toBeNull()
    const track = root.querySelector('[data-slot="segmented"]') as HTMLElement
    const labelId = root.querySelector('span')?.id as string
    expect(track.getAttribute('aria-labelledby')).toBe(labelId)
    expect(root.querySelectorAll('[data-slot="segmented"]')).toHaveLength(1)
  })
})

describe('the 2.x field form', () => {
  test('a call with neither handle nor field still names the missing prop', () => {
    expect(() => {
      render(<ViewTabs {...({} as unknown as ViewTabsProps)} />)
    }).toThrow('[basalt] ViewTabs: prop "field" is required')
  })
})

describe('over a router', () => {
  const store = () =>
    defineControls({
      id: 'vt-tabs',
      scope: 'page',
      fields: {
        tab: field
          .enum(['overview', 'history', 'train'], 'overview', { history: 'push' })
          .labels({ overview: 'Overview', history: 'History', train: 'Train' }),
      },
    })

  test('a deep link renders its tab in the server HTML', async () => {
    const vt = store()
    const { app } = await mountApp({
      url: '/p?tab=history',
      store: vt,
      page: () => <ViewTabs handle={vt.field.tab} />,
    })
    const html = renderToString(app)
    expect(html).toMatch(/<button[^>]*aria-selected="true"[^>]*>History<\/button>/)
    expect(html).not.toMatch(/aria-selected="true"[^>]*>Overview</)
  })

  test('with no tab in the URL the server renders the first', async () => {
    const vt = store()
    const { app } = await mountApp({
      url: '/p',
      store: vt,
      page: () => <ViewTabs handle={vt.field.tab} />,
    })
    expect(renderToString(app)).toMatch(/aria-selected="true"[^>]*>Overview</)
  })

  test('Back returns to the tab the visitor left', async () => {
    const vt = store()
    const { app, router, history } = await mountApp({
      url: '/p?tab=overview',
      store: vt,
      page: () => <ViewTabs handle={vt.field.tab} />,
    })
    const { getByRole } = render(app)
    await waitFor(() => getByRole('tab', { name: 'Overview' }))
    const selected = (): string | null =>
      document.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? null

    fireEvent.click(getByRole('tab', { name: 'History' }))
    await waitFor(() => expect(selected()).toBe('History'))
    fireEvent.click(getByRole('tab', { name: 'Train' }))
    await waitFor(() => expect(selected()).toBe('Train'))
    expect(router.state.location.search['tab']).toBe('train')

    await act(async () => {
      history.back()
    })
    await waitFor(() => expect(selected()).toBe('History'))
    await act(async () => {
      history.back()
    })
    await waitFor(() => expect(selected()).toBe('Overview'))
  })
})

// Compile-time (`tsc`): the handle form refuses a value/onChange pair and a size.
const bound = memoryHandle<string>('tab', 'overview', { kind: 'enum', options: TABS })
// @ts-expect-error `value` belongs to the handle, not the call site
export const withValue = <ViewTabs handle={bound} value="overview" />
// @ts-expect-error `onChange` belongs to the handle, not the call site
export const withOnChange = <ViewTabs handle={bound} onChange={() => {}} />
// @ts-expect-error `size` is the home's tier, never the control's
export const withSize = <ViewTabs handle={bound} size="sm" />
