/**
 * `useDiscreteCursor` — keyboard, focus and tap parity for a discrete target set (Donut slices,
 * Heatmap cells). A small harness component wires the hook's `hostProps`/`pointerProps` onto real
 * DOM nodes so pointer type, focus and document-level dismissal all go through actual events — the
 * same style `ChartLegend.test.tsx` uses for its disclosure panel's Escape/outside-tap pair.
 * `.tsx`, not the `.ts` a spec draft may have named it: the harness renders JSX.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useDiscreteCursor } from './useDiscreteCursor'

type Item = { id: string }

const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'f' }]

function Harness({ columns }: { columns?: number } = {}) {
  const cursor = useDiscreteCursor<Item>({
    targets: items,
    getKey: (t) => t.id,
    ...(columns !== undefined && { columns }),
  })
  return (
    <div>
      <div data-testid="host" {...cursor.hostProps}>
        {items.map((t) => (
          <div
            key={t.id}
            data-testid={`target-${t.id}`}
            id={cursor.optionId(t)}
            // A plain `<div>` stands in for an arc/cell shape — see the real kinds for why
            // `role="option"` has no matching HTML tag here.
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="option"
            aria-selected={cursor.tip?.target.id === t.id}
            {...cursor.pointerProps(t)}
          />
        ))}
      </div>
      <div data-testid="outside" />
      <div data-testid="tip-key">{cursor.tip?.target.id ?? 'none'}</div>
      <div data-testid="pinned">{String(cursor.isPinned)}</div>
    </div>
  )
}

const tipKey = (): string => screen.getByTestId('tip-key').textContent ?? ''
const pinned = (): string => screen.getByTestId('pinned').textContent ?? ''

afterEach(cleanup)

describe('useDiscreteCursor — fine pointer (hover)', () => {
  test('hover shows the tooltip and leave clears it, unpinned', () => {
    render(<Harness />)
    fireEvent.pointerEnter(screen.getByTestId('target-b'), {
      pointerType: 'mouse',
      clientX: 1,
      clientY: 2,
    })
    expect(tipKey()).toBe('b')
    expect(pinned()).toBe('false')

    fireEvent.pointerLeave(screen.getByTestId('target-b'), { pointerType: 'mouse' })
    expect(tipKey()).toBe('none')
  })

  test('a pointer cancel clears the same as a leave', () => {
    render(<Harness />)
    fireEvent.pointerEnter(screen.getByTestId('target-a'), { pointerType: 'mouse' })
    fireEvent.pointerCancel(screen.getByTestId('target-a'), { pointerType: 'mouse' })
    expect(tipKey()).toBe('none')
  })
})

describe('useDiscreteCursor — coarse pointer (touch)', () => {
  test('a tap shows AND pins the tooltip; lift (leave) does not dismiss it', () => {
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-c'), { pointerType: 'touch' })
    expect(tipKey()).toBe('c')
    expect(pinned()).toBe('true')

    fireEvent.pointerLeave(screen.getByTestId('target-c'), { pointerType: 'touch' })
    expect(tipKey()).toBe('c')
    expect(pinned()).toBe('true')
  })

  test('tapping a different target MOVES the pin', () => {
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-a'), { pointerType: 'touch' })
    expect(tipKey()).toBe('a')
    fireEvent.pointerDown(screen.getByTestId('target-b'), { pointerType: 'touch' })
    expect(tipKey()).toBe('b')
    expect(pinned()).toBe('true')
  })

  test('a tap outside the host dismisses the pin', () => {
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-a'), { pointerType: 'touch' })
    expect(pinned()).toBe('true')

    fireEvent.pointerDown(screen.getByTestId('outside'))
    expect(tipKey()).toBe('none')
    expect(pinned()).toBe('false')
  })

  test('Escape dismisses the pin from anywhere in the document', () => {
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-a'), { pointerType: 'touch' })
    expect(pinned()).toBe('true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(tipKey()).toBe('none')
    expect(pinned()).toBe('false')
  })
})

describe('useDiscreteCursor — keyboard', () => {
  test('the host is one focusable listbox; arrow keys step through targets by one', () => {
    render(<Harness />)
    const host = screen.getByRole('listbox')
    expect(host.getAttribute('tabindex')).toBe('0')
    expect(screen.getAllByRole('option')).toHaveLength(items.length)

    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(tipKey()).toBe('a')
    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(tipKey()).toBe('b')
    fireEvent.keyDown(host, { key: 'ArrowLeft' })
    expect(tipKey()).toBe('a')
  })

  test('stepping past the first target clamps there', () => {
    render(<Harness />)
    const host = screen.getByRole('listbox')
    // Nothing focused yet: Left starts one past the last target (mirrors `useChartCursor`'s
    // "no current selection" rule), landing on the last one.
    fireEvent.keyDown(host, { key: 'ArrowLeft' })
    expect(tipKey()).toBe('f')
    for (let i = 0; i < items.length - 1; i += 1) fireEvent.keyDown(host, { key: 'ArrowLeft' })
    expect(tipKey()).toBe('a')
    // One more Left has nowhere left to go.
    fireEvent.keyDown(host, { key: 'ArrowLeft' })
    expect(tipKey()).toBe('a')
  })

  test('aria-activedescendant tracks the focused option id', () => {
    render(<Harness />)
    const host = screen.getByRole('listbox')
    expect(host.getAttribute('aria-activedescendant')).toBeNull()

    fireEvent.keyDown(host, { key: 'ArrowRight' })
    const active = host.getAttribute('aria-activedescendant')
    expect(active).not.toBeNull()
    expect(document.getElementById(active as string)).toBe(screen.getByTestId('target-a'))
  })

  test('Escape clears keyboard focus', () => {
    render(<Harness />)
    const host = screen.getByRole('listbox')
    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(tipKey()).toBe('a')
    fireEvent.keyDown(host, { key: 'Escape' })
    expect(tipKey()).toBe('none')
  })

  test('with `columns`, Up/Down jump a full row and Left/Right stay within it', () => {
    render(<Harness columns={3} />)
    const host = screen.getByRole('listbox')
    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(tipKey()).toBe('a')
    fireEvent.keyDown(host, { key: 'ArrowDown' })
    expect(tipKey()).toBe('d')
    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(tipKey()).toBe('e')
    fireEvent.keyDown(host, { key: 'ArrowUp' })
    expect(tipKey()).toBe('b')
  })
})
