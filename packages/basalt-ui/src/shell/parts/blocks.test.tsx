/**
 * `RailBlock`: the rows, folds and rail projection of every block kind. happy-dom evaluates no
 * container query, so the collapsed-rail RULES are not testable here; what is testable is the DOM
 * they select against (`data-slot`, `data-rail`, the dot node, the named trigger) and the state
 * (persisted fold, handlers). A custom block must stay mounted whatever the rail width.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import type { ReactNode } from 'react'
import type { SidebarBlock } from '../contract'
import type { CoreBlock } from '../core/block-model'
import { projectRail } from '../core/projector'
import type { RailBlockRow } from '../core/projector'
import { RailBlock } from './blocks'

afterEach(cleanup)
beforeEach(() => localStorage.clear())

const NO_STATE = { activeId: undefined, ancestorIds: new Set<string>() }

/** The projected row for one declared block, exactly as the rail receives it. */
function rowOf(block: CoreBlock | SidebarBlock): RailBlockRow {
  const model = projectRail({
    nav: { sections: [] },
    state: NO_STATE,
    badges: {},
    blocks: [block as CoreBlock],
  })
  const row = [...model.blocks.nav, ...model.blocks.bottom][0]
  if (row === undefined) throw new Error('expected one block row')
  return row
}

const mount = (block: CoreBlock | SidebarBlock): ReturnType<typeof render> =>
  render(<RailBlock row={rowOf(block)} />)

const Glyph = ({ className }: { className?: string }): ReactNode => (
  <svg data-testid="glyph" className={className} />
)

const AWAITING: CoreBlock = {
  kind: 'list',
  id: 'awaiting',
  label: 'Awaiting action',
  count: 3,
  items: [
    { id: 'a', label: 'Review PR', tone: 'warn' },
    { id: 'b', label: 'Sign contract', tone: 'bad', onClick: () => {} },
    { id: 'c', label: 'Reply to Jo', meta: '2h' },
  ],
}

const railOf = (container: HTMLElement): string | null | undefined =>
  container.querySelector('[data-slot="shell-rail-block"]')?.getAttribute('data-rail')

describe('rail blocks: rendering per kind', () => {
  test("a 'list' block renders its label, count badge and rows", () => {
    mount(AWAITING)
    expect(screen.getByText('Awaiting action')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('Review PR')).toBeTruthy()
    expect(screen.getByText('Reply to Jo')).toBeTruthy()
  })

  test('the block root carries the slot and the rail form', () => {
    const { container } = mount(AWAITING)
    const root = container.querySelector('[data-slot="shell-rail-block"]')
    expect(root).not.toBeNull()
    expect(root?.getAttribute('data-rail')).toBe('hidden')
  })

  test('meta is muted trailing text on its row', () => {
    mount(AWAITING)
    expect(screen.getByText('2h').closest('[data-slot="shell-rail-block-item"]')).toBe(
      screen.getByText('Reply to Jo').closest('[data-slot="shell-rail-block-item"]'),
    )
  })

  test('a row with nowhere to go is plain text, not a link or button', () => {
    mount({
      kind: 'list',
      id: 'recents',
      label: 'Recents',
      items: [
        { id: 'r1', label: 'Q3 plan' },
        { id: 'r2', label: 'Q4 plan', onClick: () => {} },
      ],
    })
    expect(screen.getByText('Q3 plan').closest('a')).toBeNull()
    expect(screen.getByText('Q3 plan').closest('button')).toBeNull()
    expect(screen.getByText('Q4 plan').closest('button')).not.toBeNull()
  })

  test('a clickable row fires its handler', () => {
    let fired = 0
    mount({
      kind: 'list',
      id: 'l',
      label: 'L',
      items: [{ id: 'x', label: 'Go', onClick: () => (fired += 1) }],
    })
    fireEvent.click(screen.getByText('Go'))
    expect(fired).toBe(1)
  })

  test('a toned row without an icon shows a status dot named by its tone', () => {
    const { container } = mount(AWAITING)
    expect(container.querySelector('[data-tone="warn"]')).not.toBeNull()
    expect(container.querySelector('[data-tone="bad"]')).not.toBeNull()
  })

  test('an icon replaces the status dot', () => {
    const { container } = mount({
      kind: 'list',
      id: 'i',
      label: 'I',
      items: [{ id: 'a', label: 'A', tone: 'good', icon: Glyph }],
    })
    expect(screen.getByTestId('glyph')).toBeTruthy()
    expect(container.querySelector('[data-tone]')).toBeNull()
  })

  test("a 'progress' block renders its label, a percent and a Progress track", () => {
    const { container } = mount({ kind: 'progress', id: 'p', label: 'Quota', value: 0.7 })
    expect(screen.getByText('Quota')).toBeTruthy()
    expect(screen.getByText('70%')).toBeTruthy()
    expect(container.querySelector('[data-slot="progress"]')).not.toBeNull()
    expect(screen.getByRole('progressbar', { name: 'Quota' })).toBeTruthy()
  })

  test('a progress block without onClick is not a button; with one it is', () => {
    const plain = mount({ kind: 'progress', id: 'p', label: 'Quota', value: 0.5 })
    expect(plain.container.querySelector('button')).toBeNull()
    plain.unmount()
    let fired = 0
    mount({ kind: 'progress', id: 'p', label: 'Quota', value: 0.5, onClick: () => (fired += 1) })
    fireEvent.click(screen.getByRole('button'))
    expect(fired).toBe(1)
  })

  test("a 'custom' block mounts render(box) verbatim", () => {
    const seen: unknown[] = []
    mount({
      kind: 'custom',
      id: 'tree',
      render: (box) => {
        seen.push(box)
        return <div data-testid="extra">Extra</div>
      },
    })
    expect(screen.getByTestId('extra')).toBeTruthy()
    expect(seen[0]).toMatchObject({ height: 32 })
    expect(['compact', 'medium', 'expanded']).toContain(
      (seen[0] as { sizeClass: string }).sizeClass,
    )
  })

  test('a custom block without a render function renders nothing and warns in dev', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = mount({ kind: 'custom', id: 'broken' } as unknown as SidebarBlock)
    expect(container.firstChild).toBeNull()
    expect(warn.mock.calls[0]?.[0]).toContain('[basalt] RailBlock: custom block "broken"')
    warn.mockRestore()
  })
})

describe('rail blocks: Show more', () => {
  const LONG: CoreBlock = {
    kind: 'list',
    id: 'long',
    label: 'Long',
    max: 3,
    items: Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, label: `Item ${i}` })),
  }

  test('max shows the first N and a toggle that reveals the rest', () => {
    mount(LONG)
    expect(screen.getByText('Item 2')).toBeTruthy()
    expect(screen.queryByText('Item 3')).toBeNull()
    fireEvent.click(screen.getByText('Show more'))
    expect(screen.getByText('Item 5')).toBeTruthy()
    expect(screen.getByText('Show less')).toBeTruthy()
  })

  test('Show less hides the extra rows again', () => {
    mount(LONG)
    fireEvent.click(screen.getByText('Show more'))
    fireEvent.click(screen.getByText('Show less'))
    expect(screen.queryByText('Item 3')).toBeNull()
  })

  test('no max, or a max past the item count, renders no toggle', () => {
    mount(AWAITING)
    expect(screen.queryByText('Show more')).toBeNull()
    cleanup()
    mount({ ...LONG, max: 99 } as CoreBlock)
    expect(screen.queryByText('Show more')).toBeNull()
  })

  test('Show more is ephemeral and persists nothing', () => {
    mount(LONG)
    fireEvent.click(screen.getByText('Show more'))
    expect(localStorage.getItem('basalt:sidebar-block:long')).toBeNull()
  })
})

describe('rail blocks: persisted folds', () => {
  test('a collapsible fold writes the versioned envelope at basalt:sidebar-block:<id>', () => {
    mount({ ...AWAITING, id: 'awaiting-fold', collapsible: true } as CoreBlock)
    fireEvent.click(screen.getByText('Awaiting action'))
    expect(localStorage.getItem('basalt:sidebar-block:awaiting-fold')).toBe(
      JSON.stringify({ v: 1, value: true }),
    )
  })

  test('a folded block hides its rows; unfolding shows them and writes false', async () => {
    mount({ ...AWAITING, id: 'fold-toggle', collapsible: true } as CoreBlock)
    const trigger = screen.getByText('Awaiting action').closest('button')
    expect(trigger?.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(trigger as HTMLElement)
    await waitFor(() => expect(screen.queryByText('Review PR')).toBeNull())
    fireEvent.click(trigger as HTMLElement)
    await waitFor(() => expect(screen.getByText('Review PR')).toBeTruthy())
    expect(localStorage.getItem('basalt:sidebar-block:fold-toggle')).toBe(
      JSON.stringify({ v: 1, value: false }),
    )
  })

  test('a persisted fold is restored on the next mount', () => {
    localStorage.setItem('basalt:sidebar-block:restored', JSON.stringify({ v: 1, value: true }))
    mount({ ...AWAITING, id: 'restored', collapsible: true } as CoreBlock)
    expect(
      screen.getByText('Awaiting action').closest('button')?.getAttribute('aria-expanded'),
    ).toBe('false')
  })

  test('a non-collapsible block has no fold button', () => {
    mount({ ...AWAITING, id: 'plain-block' } as CoreBlock)
    expect(screen.getByText('Awaiting action').closest('button')).toBeNull()
  })
})

describe('rail blocks: rail projection', () => {
  test("a list with a count and an icon is data-rail='dot' with a dot and a named trigger", () => {
    const { container } = mount({ ...AWAITING, icon: Glyph } as CoreBlock)
    expect(railOf(container)).toBe('dot')
    expect(container.querySelector('[data-slot="shell-rail-block-dot"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Awaiting action' })).toBeTruthy()
  })

  test('the dot trigger opens the rows in a popover', async () => {
    mount({ ...AWAITING, icon: Glyph } as CoreBlock)
    fireEvent.click(screen.getByRole('button', { name: 'Awaiting action' }))
    await waitFor(() =>
      expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull(),
    )
    const popover = document.querySelector('[data-slot="popover-content"]') as HTMLElement
    expect(popover.textContent).toContain('Review PR')
  })

  test("a list with no count is data-rail='hidden' and has no dot", () => {
    const { container } = mount({
      kind: 'list',
      id: 'recents',
      label: 'Recents',
      icon: Glyph,
      items: [{ id: 'a', label: 'A' }],
    } as CoreBlock)
    expect(railOf(container)).toBe('hidden')
    expect(container.querySelector('[data-slot="shell-rail-block-dot"]')).toBeNull()
  })

  test("rail:'hidden' overrides the count default", () => {
    const { container } = mount({ ...AWAITING, icon: Glyph, rail: 'hidden' } as CoreBlock)
    expect(railOf(container)).toBe('hidden')
    expect(container.querySelector('[data-slot="shell-rail-block-dot"]')).toBeNull()
  })

  test('a count with no icon leaves the rail', () => {
    const { container } = mount(AWAITING)
    expect(railOf(container)).toBe('hidden')
  })

  test("a progress block is data-rail='ring'", () => {
    const { container } = mount({ kind: 'progress', id: 'p', label: 'Quota', value: 0.2 })
    expect(railOf(container)).toBe('ring')
  })

  test('an unnamed custom block is hidden in the rail yet stays mounted', () => {
    const { container } = mount({
      kind: 'custom',
      id: 'tree',
      render: () => <span data-testid="node">tree</span>,
    })
    expect(railOf(container)).toBe('hidden')
    expect(screen.getByTestId('node')).toBeTruthy()
  })

  test("a named custom block is data-rail='icon' with a trigger named by mobile.label", () => {
    const { container } = mount({
      kind: 'custom',
      id: 'tree',
      mobile: { label: 'Albums', icon: Glyph },
      render: () => <span data-testid="node">tree</span>,
    })
    expect(railOf(container)).toBe('icon')
    expect(screen.getByRole('button', { name: 'Albums' }).getAttribute('aria-label')).toBe('Albums')
    expect(screen.getAllByTestId('node')).toHaveLength(1)
  })

  test('the named trigger opens the same node in a popover', async () => {
    mount({
      kind: 'custom',
      id: 'tree',
      mobile: { label: 'Albums', icon: Glyph },
      render: () => <span data-testid="node">tree</span>,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Albums' }))
    await waitFor(() => expect(screen.getAllByTestId('node')).toHaveLength(2))
  })

  test("a custom block with rail:'hidden' has no trigger even when named", () => {
    const { container } = mount({
      kind: 'custom',
      id: 'tree',
      mobile: { label: 'Albums', icon: Glyph },
      rail: 'hidden',
      render: () => <span>tree</span>,
    })
    expect(railOf(container)).toBe('hidden')
    expect(screen.queryByRole('button', { name: 'Albums' })).toBeNull()
  })
})
