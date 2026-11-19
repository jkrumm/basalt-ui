import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act } from 'react'
import { useChartFocus } from '../charts/focus'
import { RowList } from './row-list'
import type { RowListItem, RowListProps } from './row-list'

afterEach(cleanup)

// The list shapes the owner's review found hand-written: n02 (two lines, two figures), n04 (one
// line, one figure), n07 (a verdict dot and word) and c10 (a tree depth with a chip).
const N02: RowListItem[] = [
  {
    key: 'issue_1',
    label: 'issue_1',
    meta: 'building',
    detail: 'Lists: a bare border',
    value: '3.1 d',
    valueDetail: '2.4× of 1.3 d',
  },
  { key: 'issue_2', label: 'issue_2', meta: 'review', detail: 'Row rules', value: '1 d' },
]
const N04: RowListItem[] = [
  { key: 'a', label: 'Mon 06:00 – 09:00', value: '3 h' },
  { key: 'b', label: 'Tue 14:00 – 15:00', value: '1 h' },
]
const N07: RowListItem[] = [
  { label: 'Fri 12 Nov', status: { tone: 'accent', label: 'Best' }, detail: 'Moon', value: '71°' },
  { label: 'Sat 13 Nov', status: { tone: 'neutral', label: 'Clear' }, value: '64°' },
]
const C10: RowListItem[] = [
  { label: 'root', value: '0' },
  { label: 'child', indent: 2, status: { tone: 'bad', label: 'Affected' } },
]

const draw = (props: Partial<RowListProps> = {}): ReturnType<typeof render> =>
  render(<RowList title="Open Issues" items={N02} {...props} />)

/** True when any element under the root carries a border or divide utility other than the hairline opt-in. */
const borderClasses = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[class]')].flatMap((el) =>
    el.className
      .toString()
      .split(/\s+/)
      .filter((c) => /^(border|divide)(-|$)/.test(c) && !/^border-(0|none)$/.test(c)),
  )

describe('RowList', () => {
  test('is a list with an accessible name and one row per item', () => {
    const { getByRole, container } = draw()
    expect(getByRole('list', { name: 'Open Issues' })).toBeTruthy()
    expect(container.querySelectorAll('[data-slot="row-list-row"]')).toHaveLength(2)
  })

  test('n02 and n04 rows are written with the part and no page-local border class', () => {
    for (const items of [N02, N04, N07, C10]) {
      const { container, unmount } = draw({ items })
      expect(borderClasses(container), JSON.stringify(items[0])).toEqual([])
      unmount()
    }
  })

  test('a row prints label, meta, detail, value and value detail as given', () => {
    const { container } = draw({ lines: 2, mono: true })
    const first = container.querySelector('[data-slot="row-list-row"]')!
    expect(first.querySelector('[data-slot="row-list-label"]')?.textContent).toBe('issue_1')
    expect(first.querySelector('[data-slot="row-list-label"]')?.className).toContain('font-mono')
    expect(first.querySelector('[data-slot="row-list-meta"]')?.textContent).toBe('building')
    expect(first.querySelector('[data-slot="row-list-detail"]')?.textContent).toBe(
      'Lists: a bare border',
    )
    expect(first.querySelector('[data-slot="row-list-value"]')?.textContent).toBe('3.1 d')
    expect(first.querySelector('[data-slot="row-list-value-detail"]')?.textContent).toBe(
      '2.4× of 1.3 d',
    )
  })

  test('the label is mono only when the list says so', () => {
    const { container } = draw()
    expect(container.querySelector('[data-slot="row-list-label"]')?.className).not.toContain(
      'font-mono',
    )
  })

  test('a status is a dot and a word', () => {
    const { container } = draw({ items: N07 })
    const status = container.querySelector('[data-slot="status"]')
    expect(status?.textContent).toBe('Best')
  })

  test('indent pads the label by the spacing step', () => {
    const { container } = draw({ items: C10 })
    const mains = [...container.querySelectorAll<HTMLElement>('[data-slot="row-list-main"]')]
    expect(mains[0]!.style.paddingInlineStart).toBe('')
    expect(mains[1]!.style.paddingInlineStart).toBe('calc(var(--spacing) * 6)')
  })

  test('rows are separated by spacing by default; hairline opts in to the grid token, never ink', () => {
    const quiet = draw()
    expect(borderClasses(quiet.container)).toEqual([])
    quiet.unmount()
    const ruled = draw({ separator: 'hairline' })
    const rows = [...ruled.container.querySelectorAll('[data-slot="row-list-row"]')]
    for (const row of rows) {
      expect(row.className).toContain('border-grid')
      expect(row.className).not.toContain('border-foreground')
    }
    expect(rows[0]!.className).toContain('last:border-b-0')
  })

  test('a row is a link, a button or plain text', () => {
    const onClick = mock(() => undefined)
    const { container } = draw({
      items: [{ label: 'a', href: '/a' }, { label: 'b', onClick }, { label: 'c' }],
    })
    const targets = container.querySelectorAll('[data-slot="row-list-target"]')
    expect(targets).toHaveLength(2)
    expect(targets[0]!.tagName).toBe('A')
    fireEvent.click(targets[1]!)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('an empty list says so, and a caller cause replaces it', () => {
    expect(draw({ items: [] }).container.textContent).toContain('Nothing to list yet')
    const custom = draw({ items: [], empty: { cause: 'No windows today' } })
    expect(custom.container.textContent).toContain('No windows today')
  })

  test('the body holds the same height at every phase', () => {
    const heightOf = (root: ParentNode): string | undefined =>
      root.querySelector<HTMLElement>('[data-slot="inset"]')?.style.height
    const ready = draw({ bodyRows: 6, lines: 2 })
    expect(heightOf(ready.container)).toBe('calc(var(--spacing) * 78)')
    ready.unmount()
    const loading = draw({ bodyRows: 6, lines: 2, phase: 'loading' })
    expect(heightOf(loading.container)).toBe('calc(var(--spacing) * 78)')
  })

  test('a long list says how many rows show', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ label: `row ${i}` }))
    const { container } = draw({ items, bodyRows: 4 })
    expect(container.querySelector('[data-slot="row-list-scroll-cue"]')?.textContent).toBe(
      '4 of 9 shown',
    )
  })
})

function Linked({ items }: { items: RowListItem[] }): ReturnType<typeof RowList> {
  const focus = useChartFocus(items, { announce: (d) => d.label })
  return (
    <>
      <output data-testid="index">{String(focus.index)}</output>
      <RowList title="Open Issues" items={items} focus={focus} />
    </>
  )
}

describe('RowList focus', () => {
  test('pointing at a row focuses its item and leaving clears it', () => {
    const { container, getByTestId } = render(<Linked items={N04} />)
    const rows = container.querySelectorAll('[data-slot="row-list-row"]')
    act(() => {
      fireEvent.pointerEnter(rows[1]!)
    })
    expect(getByTestId('index').textContent).toBe('1')
    expect(rows[1]!.hasAttribute('data-focused')).toBe(true)
    act(() => {
      fireEvent.pointerLeave(container.querySelector('ul')!)
    })
    expect(getByTestId('index').textContent).toBe('null')
  })

  test("a row's pointerover alone focuses it, as a pointer arriving from a removed chart node", () => {
    const { container, getByTestId } = render(<Linked items={N04} />)
    const rows = container.querySelectorAll('[data-slot="row-list-row"]')
    act(() => {
      fireEvent.pointerOver(rows[1]!, { relatedTarget: container.querySelector('ul')! })
    })
    expect(getByTestId('index').textContent).toBe('1')
  })

  test('the list is one tab stop that steps the shared focus with the arrow keys', () => {
    const { container, getByTestId } = render(<Linked items={N04} />)
    const list = container.querySelector('ul')!
    expect(list.getAttribute('tabindex')).toBe('0')
    act(() => {
      fireEvent.keyDown(list, { key: 'ArrowDown' })
    })
    expect(getByTestId('index').textContent).toBe('0')
    act(() => {
      fireEvent.keyDown(list, { key: 'End' })
    })
    expect(getByTestId('index').textContent).toBe('1')
    act(() => {
      fireEvent.keyDown(list, { key: 'Escape' })
    })
    expect(getByTestId('index').textContent).toBe('null')
  })
})
