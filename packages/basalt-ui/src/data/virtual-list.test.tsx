/**
 * `BasaltVirtualList`'s imperative handle (A15 — `docs/archive/BLUEPRINT.md` maturation audit
 * #15): before this, the virtualizer's own `scrollToIndex`/`scrollToOffset`/`scrollToEnd` were
 * unreachable — the component owns `useVirtualizer()` internally and exposed no ref. Proves the
 * handle's convenience methods delegate to the SAME virtualizer instance `getVirtualizer()`
 * returns, not a re-derived one.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { createRef, useState } from 'react'
import { BasaltVirtualList } from './virtual-list'
import type { BasaltVirtualListHandle } from './virtual-list'

type Row = { id: number; label: string }

const ITEMS: Row[] = Array.from({ length: 200 }, (_, i) => ({ id: i, label: `Row ${i}` }))

function renderList(ref: React.RefObject<BasaltVirtualListHandle | null>) {
  return render(
    <MantineProvider>
      <BasaltVirtualList
        ref={ref}
        items={ITEMS}
        height={300}
        renderItem={(item) => <div>{item.label}</div>}
        getItemKey={(item) => item.id}
      />
    </MantineProvider>,
  )
}

describe('BasaltVirtualListHandle', () => {
  test('scrollToIndex calls the virtualizer with the same args', () => {
    const ref = createRef<BasaltVirtualListHandle>()
    renderList(ref)
    const virtualizer = ref.current?.getVirtualizer()
    if (!virtualizer) throw new Error('expected the handle to expose a virtualizer')
    const spy = spyOn(virtualizer, 'scrollToIndex')

    ref.current?.scrollToIndex(42, { align: 'center' })

    expect(spy).toHaveBeenCalledWith(42, { align: 'center' })
  })

  test('scrollToOffset calls the virtualizer with the same args', () => {
    const ref = createRef<BasaltVirtualListHandle>()
    renderList(ref)
    const virtualizer = ref.current?.getVirtualizer()
    if (!virtualizer) throw new Error('expected the handle to expose a virtualizer')
    const spy = spyOn(virtualizer, 'scrollToOffset')

    ref.current?.scrollToOffset(500)

    expect(spy).toHaveBeenCalledWith(500, undefined)
  })

  test('scrollToEnd calls the virtualizer', () => {
    const ref = createRef<BasaltVirtualListHandle>()
    renderList(ref)
    const virtualizer = ref.current?.getVirtualizer()
    if (!virtualizer) throw new Error('expected the handle to expose a virtualizer')
    const spy = spyOn(virtualizer, 'scrollToEnd')

    ref.current?.scrollToEnd({ behavior: 'smooth' })

    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  test('getVirtualizer returns the same instance across calls within a render', () => {
    const ref = createRef<BasaltVirtualListHandle>()
    renderList(ref)
    expect(ref.current?.getVirtualizer()).toBe(ref.current?.getVirtualizer())
  })
})

/** A row with its OWN state, so a click leaves a mark on whichever component instance renders it —
 * the mark survives a re-render only if React reconciled it by the SAME key. */
function ClickCounterRow({ item }: { item: Row }) {
  const [clicks, setClicks] = useState(0)
  return <button onClick={() => setClicks((c) => c + 1)}>{`${item.label}: ${clicks}`}</button>
}

describe('BasaltVirtualList — row identity survives a mutation to `items`', () => {
  const nativeOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')

  // `@tanstack/virtual-core`'s `getRect` reads `offsetHeight`, which happy-dom never lays out
  // (always 0) — with a zero measured size the virtualizer's own guard
  // (`measurements.length > 0 && outerSize > 0`) renders an EMPTY range, so no row ever mounts to
  // click. Stubbed for the suite only, restored after.
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 300,
    })
  })

  afterEach(() => {
    if (nativeOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', nativeOffsetHeight)
    }
  })

  test('inserting at index 0 keeps each row bound to its item id, not its rendered position', () => {
    const { rerender } = render(
      <MantineProvider>
        <BasaltVirtualList
          items={ITEMS}
          height={300}
          renderItem={(item) => <ClickCounterRow item={item} />}
          getItemKey={(item) => item.id}
        />
      </MantineProvider>,
    )

    // Row 0 (id 0) is clicked once — the click is now attached to id 0's component instance.
    fireEvent.click(screen.getByRole('button', { name: 'Row 0: 0' }))
    expect(screen.getByRole('button', { name: 'Row 0: 1' })).toBeTruthy()

    // Prepend a new row — id 0 now renders one slot further down, at the position id -1 used to
    // occupy... except nothing used to occupy it, since it didn't exist. The point is: whatever the
    // virtualizer's `getItemKey` binds the row TO is what must carry the click forward.
    const withInsert: Row[] = [{ id: -1, label: 'Row -1' }, ...ITEMS]
    rerender(
      <MantineProvider>
        <BasaltVirtualList
          items={withInsert}
          height={300}
          renderItem={(item) => <ClickCounterRow item={item} />}
          getItemKey={(item) => item.id}
        />
      </MantineProvider>,
    )

    // Keyed by POSITION, this slot would show a fresh, unclicked count (whatever previously
    // rendered one row up) instead. Keyed by IDENTITY — `getItemKey`'s contract — the same
    // component instance survives the shift and keeps its state.
    expect(screen.getByRole('button', { name: 'Row 0: 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Row -1: 0' })).toBeTruthy()
  })
})
