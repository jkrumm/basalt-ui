/**
 * `BasaltVirtualList`'s imperative handle (A15 — `docs/archive/BLUEPRINT.md` maturation audit
 * #15): before this, the virtualizer's own `scrollToIndex`/`scrollToOffset`/`scrollToEnd` were
 * unreachable — the component owns `useVirtualizer()` internally and exposed no ref. Proves the
 * handle's convenience methods delegate to the SAME virtualizer instance `getVirtualizer()`
 * returns, not a re-derived one.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { createRef, useState } from 'react'
import type { ReactNode } from 'react'
import { resetValidatedProps } from '../common/validate'
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

describe('className and classNames (common/props.ts)', () => {
  test('className and classNames.root both reach the scroll container', () => {
    const { container } = render(
      <MantineProvider>
        <BasaltVirtualList
          items={ITEMS}
          height={300}
          renderItem={(item) => <div>{item.label}</div>}
          getItemKey={(item) => item.id}
          className="my-list"
          classNames={{ root: 'my-root' }}
        />
      </MantineProvider>,
    )
    const root = container.querySelector('.my-list')
    expect(root).not.toBeNull()
    expect(root?.classList.contains('my-root')).toBe(true)
  })
})

// ── The uniform query contract (law C3, components audit #3) ──────────────────

function query(over: Partial<Record<string, unknown>> = {}) {
  return {
    data: undefined as unknown,
    isError: false,
    error: null as unknown,
    fetchStatus: 'idle' as 'fetching' | 'paused' | 'idle',
    refetch: () => undefined,
    ...over,
  }
}

function renderWithQuery(props: {
  items?: Row[]
  query?: ReturnType<typeof query>
  emptyState?: ReactNode
  isLoading?: boolean
}) {
  return render(
    <MantineProvider>
      <BasaltVirtualList
        items={props.items ?? ITEMS}
        height={300}
        renderItem={(item) => <div>{item.label}</div>}
        getItemKey={(item) => item.id}
        {...(props.query !== undefined && { query: props.query })}
        {...(props.emptyState !== undefined && { emptyState: props.emptyState })}
        {...(props.isLoading !== undefined && { isLoading: props.isLoading })}
      />
    </MantineProvider>,
  )
}

/**
 * The list took `isLoading` and nothing else, so a failed fetch and a genuinely empty list rendered
 * the SAME blank box. All four branches, plus the invariant that every one of them keeps the
 * declared height so the page does not reflow as the state resolves.
 */
// The virtualizer measures its scroll element, which has no layout under the DOM harness, so no
// virtual ROW is ever in the document there. The sizer div — total height, `position: relative` —
// is what proves the VIRTUAL branch was taken rather than a placeholder one.
const sizer = (container: HTMLElement) =>
  container.querySelector('div[style*="position: relative"]')

describe('query — the four container states', () => {
  test('pending renders the skeleton rows', () => {
    const { container } = renderWithQuery({ items: [], query: query({ fetchStatus: 'fetching' }) })
    expect(container.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0)
  })

  test('error renders the server message and a working Retry', () => {
    const refetch = mock(() => undefined)
    renderWithQuery({
      items: [],
      query: query({ isError: true, error: new Error('upstream exploded'), refetch }),
    })
    expect(screen.getByText('upstream exploded')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test('a resolved but empty result renders `emptyState`, never the error', () => {
    renderWithQuery({ items: [], query: query({ data: [] }), emptyState: <div>Nothing here</div> })
    expect(screen.getByText('Nothing here')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  test('data renders the virtual list itself, not a placeholder branch', () => {
    const { container } = renderWithQuery({ query: query({ data: ITEMS }) })
    expect(sizer(container)).not.toBeNull()
    expect(container.querySelector('.mantine-Skeleton-root')).toBeNull()
  })

  test('every branch keeps the declared height, so the box does not reflow', () => {
    for (const props of [
      { items: [], query: query({ fetchStatus: 'fetching' as const }) },
      { items: [], query: query({ isError: true, error: new Error('x') }) },
      { items: [], query: query({ data: [] }), emptyState: <div>empty</div> },
    ]) {
      const { container, unmount } = renderWithQuery(props)
      expect(container.querySelector('div[style*="height: 300px"]')).not.toBeNull()
      unmount()
    }
  })

  test('`emptyState` works without a query, and is absent when there are items', () => {
    const { unmount } = renderWithQuery({ items: [], emptyState: <div>Nothing here</div> })
    expect(screen.getByText('Nothing here')).toBeDefined()
    unmount()
    renderWithQuery({ emptyState: <div>Nothing here</div> })
    expect(screen.queryByText('Nothing here')).toBeNull()
  })

  test('query beats isLoading, and says so once in dev', () => {
    resetValidatedProps()
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    const { container } = renderWithQuery({ isLoading: true, query: query({ data: ITEMS }) })
    expect(container.querySelector('.mantine-Skeleton-root')).toBeNull()
    expect(spy.mock.calls.flat().join(' ')).toContain('"query" and "isLoading" are both set')
    spy.mockRestore()
  })
})
