/**
 * `InnerNav`: real links on a push field, `aria-current` on the active one, badges, the per-item
 * menu, the `filter` slot, and the scroll reset a section change makes. Geometry (one DOM at 1440
 * and 390, the Back walk in Chrome) is `tests/layout/inner-nav.layout.test.ts`'s.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import type { ControlsSlot } from '../../core/ports'
import type { InnerNavGroup, PushField } from '../contract'
import { InnerNav } from './inner-nav'
import { pushField } from './inner-nav.test-support'
import { SplitPage } from './split-page'

const SECTIONS = ['general', 'billing', 'team'] as const
type Section = (typeof SECTIONS)[number]

const GROUPS: readonly InnerNavGroup[] = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'general', label: 'General' },
      { id: 'billing', label: 'Billing', badge: { count: 3, attention: true } },
    ],
  },
  {
    id: 'org',
    label: 'Organisation',
    items: [{ id: 'team', label: 'Team', badge: { dot: true } }],
  },
]

// happy-dom starts at about:blank, where pushState is a no-op: give the field a real origin.
beforeEach(() =>
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
    'http://localhost/',
  ),
)
afterEach(cleanup)

const links = (): HTMLAnchorElement[] => [
  ...document.querySelectorAll<HTMLAnchorElement>('a[href]'),
]

describe('InnerNav links', () => {
  test('every item is an <a href> and exactly one carries aria-current', () => {
    const state = pushField<Section>(SECTIONS, 'general', 'section')
    render(<InnerNav label="Settings" state={state} groups={GROUPS} />)
    expect(links()).toHaveLength(3)
    expect(links().map((a) => a.getAttribute('href'))).toEqual([
      '?section=general',
      '?section=billing',
      '?section=team',
    ])
    const current = document.querySelectorAll('[aria-current]')
    expect(current).toHaveLength(1)
    expect(current[0]?.textContent).toBe('General')
    expect(current[0]?.getAttribute('aria-current')).toBe('page')
  })

  test('the nav is named by its label and each group by its heading', () => {
    const state = pushField<Section>(SECTIONS, 'general', 'section')
    render(<InnerNav label="Settings" state={state} groups={GROUPS} />)
    expect(screen.getByRole('navigation', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Account' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Organisation' })).toBeTruthy()
  })

  test('a click pushes the value and moves aria-current', () => {
    const state = pushField<Section>(SECTIONS, 'general', 'section')
    render(<InnerNav label="Settings" state={state} groups={GROUPS} />)
    fireEvent.click(screen.getByRole('link', { name: /Billing/ }))
    expect(state.writes).toEqual(['billing'])
    expect(window.location.search).toBe('?section=billing')
    expect(document.querySelector('[aria-current]')?.textContent).toContain('Billing')
  })

  test('each click is its own history entry, so Back walks the sections (Chrome proves the walk)', () => {
    const state = pushField<Section>(SECTIONS, 'general', 'section')
    render(<InnerNav label="Settings" state={state} groups={GROUPS} />)
    const before = window.history.length
    for (const name of [/Billing/, /Team/, /General/]) {
      fireEvent.click(screen.getByRole('link', { name }))
    }
    expect(window.history.length).toBe(before + 3)
    expect(state.writes).toEqual(['billing', 'team', 'general'])
  })

  test('a handle without link() fails loudly instead of rendering dead links', () => {
    const bare = { ...pushField<Section>(SECTIONS, 'general', 'section'), link: undefined }
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <InnerNav label="Settings" state={bare as unknown as PushField<Section>} groups={GROUPS} />,
      ),
    ).toThrow(/push field whose handle has `link/)
    spy.mockRestore()
  })
})

describe('InnerNav parts', () => {
  test('a count badge renders its number and a dot with attention reads as text', () => {
    const state = pushField<Section>(SECTIONS, 'general', 'section')
    render(<InnerNav label="Settings" state={state} groups={GROUPS} />)
    expect(screen.getByText('3')).toBeTruthy()
    expect(document.querySelector('[data-slot="count-badge"]')).not.toBeNull()
  })

  test('an attention dot carries a screen-reader label; a quiet dot is decorative', () => {
    const state = pushField<Section>(SECTIONS, 'general', 'section')
    const groups: InnerNavGroup[] = [
      {
        id: 'g',
        label: 'G',
        items: [
          { id: 'general', label: 'General', badge: { dot: true, attention: true } },
          { id: 'team', label: 'Team', badge: { dot: true } },
        ],
      },
    ]
    render(<InnerNav label="Settings" state={state} groups={groups} />)
    expect(screen.getAllByText('Needs attention')).toHaveLength(1)
  })

  test('the filter slot renders above the groups', () => {
    const filter: ControlsSlot = {
      kind: 'controls-slot',
      count: 1,
      render: () => <input aria-label="Filter sections" />,
    }
    const state = pushField<Section>(SECTIONS, 'general', 'section')
    render(<InnerNav label="Settings" state={state} filter={filter} groups={GROUPS} />)
    const nav = screen.getByRole('navigation', { name: 'Settings' })
    expect(nav.firstElementChild?.getAttribute('data-slot')).toBe('inner-nav-filter')
    expect(screen.getByLabelText('Filter sections')).toBeTruthy()
  })

  test('a menu opens from a labelled trigger beside the link and runs its action', async () => {
    const state = pushField<Section>(SECTIONS, 'general', 'section')
    const ran: string[] = []
    const groups: InnerNavGroup[] = [
      {
        id: 'g',
        label: 'G',
        items: [
          {
            id: 'billing',
            label: 'Billing',
            menu: [
              { id: 'export', label: 'Export', onSelect: () => ran.push('export') },
              { id: 'reset', label: 'Reset', onSelect: () => ran.push('reset') },
            ],
          },
        ],
      },
    ]
    render(<InnerNav label="Settings" state={state} groups={groups} />)
    expect(links()).toHaveLength(1)
    const trigger = screen.getByRole('button', { name: 'Actions for Billing' })
    await act(async () => {
      fireEvent.click(trigger)
    })
    await act(async () => {
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Reset' }))
    })
    expect(ran).toEqual(['reset'])
  })

  test('an item without a menu has no trigger', () => {
    const state = pushField<Section>(SECTIONS, 'general', 'section')
    render(<InnerNav label="Settings" state={state} groups={GROUPS} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('InnerNav scroll', () => {
  test('a section change resets the scroll; a re-render with the same section does not', () => {
    const scrolled: number[] = []
    const spy = spyOn(window, 'scrollTo').mockImplementation(((arg: ScrollToOptions) => {
      scrolled.push(arg.top ?? -1)
    }) as typeof window.scrollTo)
    const state = pushField<Section>(SECTIONS, 'general', 'section')
    const { rerender } = render(<InnerNav label="Settings" state={state} groups={GROUPS} />)
    rerender(<InnerNav label="Settings" state={state} groups={GROUPS} />)
    expect(scrolled).toEqual([])
    fireEvent.click(screen.getByRole('link', { name: /Team/ }))
    expect(scrolled).toEqual([0])
    spy.mockRestore()
  })
})

describe('InnerNav in a SplitPage list', () => {
  test('stays a vertical list: no strip classes', () => {
    const state = pushField<Section>(SECTIONS, 'general', 'section')
    render(
      <SplitPage
        selected={false}
        list={() => <InnerNav label="Settings" state={state} groups={GROUPS} />}
        detail={() => <p>pane</p>}
      />,
    )
    const nav = screen.getByRole('navigation', { name: 'Settings' })
    expect(nav.className).toContain('flex-col')
    expect(nav.className).not.toContain('overflow-x-auto')
  })
})
