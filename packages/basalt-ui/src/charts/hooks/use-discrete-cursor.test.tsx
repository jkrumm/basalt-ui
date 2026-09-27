/**
 * `useDiscreteCursor` — keyboard, focus and tap parity for a discrete target set (Donut slices,
 * Heatmap cells). A small harness component wires the hook's `hostProps`/`pointerProps` onto real
 * DOM nodes so pointer type, focus and document-level dismissal all go through actual events — the
 * same style `ChartLegend.test.tsx` uses for its disclosure panel's Escape/outside-tap pair.
 * `.tsx`, not the `.ts` a spec draft may have named it: the harness renders JSX.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useDiscreteCursor } from './use-discrete-cursor'

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
  test('hover shows the tooltip and leave clears it, unpinned', async () => {
    render(<Harness />)
    fireEvent.pointerEnter(screen.getByTestId('target-b'), {
      pointerType: 'mouse',
      clientX: 1,
      clientY: 2,
    })
    // Round 3: `onPointerEnter`/`onPointerMove` are now rAF-coalesced (mirrors `useChartCursor`'s
    // own hover path), so the readout lands one animation frame after the event, not synchronously.
    await waitFor(() => expect(tipKey()).toBe('b'))
    expect(pinned()).toBe('false')

    fireEvent.pointerLeave(screen.getByTestId('target-b'), { pointerType: 'mouse' })
    expect(tipKey()).toBe('none')
  })

  /**
   * Regression: `onPointerEnter`'s readout is rAF-coalesced (`scheduleActive`) — a leave arriving
   * before that frame flushes used to clear via a bare `setActive(null)`, which neither cancelled
   * the pending frame nor cleared `pendingActiveRef`. The frame then fired AFTER the leave and
   * resurrected the tooltip a tick later. Routing the leave through `clear()` (which cancels the
   * frame and drops the pending value) means the frame never fires at all.
   */
  test('a leave arriving before the enter frame flushes leaves the tooltip unrendered — it never resurrects', async () => {
    render(<Harness />)
    fireEvent.pointerEnter(screen.getByTestId('target-b'), {
      pointerType: 'mouse',
      clientX: 1,
      clientY: 2,
    })
    // Immediately — before the enter's own animation frame has had a chance to flush.
    fireEvent.pointerLeave(screen.getByTestId('target-b'), { pointerType: 'mouse' })
    expect(tipKey()).toBe('none')

    // Give the (would-be) enter frame every chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 50))
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
  test('a completed tap (pointerdown + pointerup) pins the tooltip and lift (leave) does not dismiss it', () => {
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-c'), {
      pointerType: 'touch',
      pointerId: 1,
    })
    expect(tipKey()).toBe('c')
    fireEvent.pointerUp(screen.getByTestId('target-c'), { pointerType: 'touch', pointerId: 1 })
    expect(tipKey()).toBe('c')
    expect(pinned()).toBe('true')

    fireEvent.pointerLeave(screen.getByTestId('target-c'), { pointerType: 'touch' })
    expect(tipKey()).toBe('c')
    expect(pinned()).toBe('true')
  })

  test('pointerdown alone shows the readout but does not pin; a cancel for the same pointer clears it', () => {
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-a'), {
      pointerType: 'touch',
      pointerId: 1,
    })
    expect(tipKey()).toBe('a')
    expect(pinned()).toBe('false')

    fireEvent.pointerCancel(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
    expect(tipKey()).toBe('none')
    expect(pinned()).toBe('false')
  })

  test('pointerdown alone shows the readout but does not pin; a LEAVE for the same pointer clears it too', () => {
    // Regression: a finger dragging off a small hit target during a scroll commonly fires
    // `pointerleave` before `pointercancel` — `onPointerLeave` used to skip the uncommitted-press
    // guard `onPointerCancel` already had, leaving `pressRef` stale and the readout stuck visible.
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-a'), {
      pointerType: 'touch',
      pointerId: 1,
    })
    expect(tipKey()).toBe('a')
    expect(pinned()).toBe('false')

    fireEvent.pointerLeave(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
    expect(tipKey()).toBe('none')
    expect(pinned()).toBe('false')
  })

  test('a document scroll clears a pinned tooltip', () => {
    // Regression: the pinned-dismissal effect wired outside-tap + Escape but no `scroll` listener,
    // so a pinned Donut/Heatmap tooltip stayed anchored to a viewport point after the chart scrolled
    // away underneath it — the same bug `useChartCursor`'s cartesian pin was fixed for.
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
    expect(pinned()).toBe('true')

    fireEvent.scroll(document)
    expect(tipKey()).toBe('none')
    expect(pinned()).toBe('false')
  })

  test('tapping a different target MOVES the pin', () => {
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
    expect(tipKey()).toBe('a')
    fireEvent.pointerDown(screen.getByTestId('target-b'), { pointerType: 'touch', pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('target-b'), { pointerType: 'touch', pointerId: 1 })
    expect(tipKey()).toBe('b')
    expect(pinned()).toBe('true')
  })

  test('a cancelled SECOND press restores the previously committed pin instead of dropping it', () => {
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
    expect(tipKey()).toBe('a')
    expect(pinned()).toBe('true')

    // A tap on a different target is provisional — it moves the readout immediately…
    fireEvent.pointerDown(screen.getByTestId('target-b'), { pointerType: 'touch', pointerId: 2 })
    expect(tipKey()).toBe('b')

    // …but the browser taking THIS press as a scroll must restore the FIRST target's committed
    // pin, not drop it — the R2C-1/P0-2 regression this test pins.
    fireEvent.pointerCancel(screen.getByTestId('target-b'), { pointerType: 'touch', pointerId: 2 })
    expect(tipKey()).toBe('a')
    expect(pinned()).toBe('true')
  })

  test('a tap outside the host dismisses the pin', () => {
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
    expect(pinned()).toBe('true')

    fireEvent.pointerDown(screen.getByTestId('outside'))
    expect(tipKey()).toBe('none')
    expect(pinned()).toBe('false')
  })

  test('Escape dismisses the pin from anywhere in the document', () => {
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('target-a'), { pointerType: 'touch', pointerId: 1 })
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

  /**
   * Regression: a hover's readout is rAF-coalesced (`scheduleActive`) — a keyboard step arriving
   * while that frame is still in flight used to write `active` synchronously and then get
   * overwritten a tick later when the stale hover frame finally fired, reverting the keyboard
   * target back to whatever was last hovered. `onKeyDown` now cancels the pending frame before its
   * own synchronous write, the same guard `onPointerDown` and `clear()` already carry.
   */
  test('a pointermove scheduled just before a keyboard step does not revert it once the frame flushes', async () => {
    render(<Harness />)
    fireEvent.pointerEnter(screen.getByTestId('target-c'), {
      pointerType: 'mouse',
      clientX: 1,
      clientY: 2,
    })
    // Immediately — before the hover's own animation frame has had a chance to flush.
    const host = screen.getByRole('listbox')
    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(tipKey()).toBe('a')

    // Give the (would-be) hover frame every chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(tipKey()).toBe('a')
  })
})
