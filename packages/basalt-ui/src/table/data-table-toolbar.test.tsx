/**
 * The table toolbar's two pieces of state the layout suite cannot own cheaply: the phone tier
 * (`useNarrowerThan` → `FilterSet inline`), and the `initialColumnFilters` seed
 * (`useDataTableState`). Geometry — one row, equal heights, wrapping at 240px — lives in
 * `tests/layout/data-table-toolbar-w42.layout.test.ts`.
 *
 * happy-dom lays nothing out, so `clientWidth` is stubbed from `data-test-width` and the
 * `ResizeObserver` callbacks are fired by hand, the same way `data-table-containment.test.tsx` does.
 */
import { MantineProvider } from '@mantine/core'
import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { CONTAINER_CLASSES } from '../tokens'
import { BasaltDataTable } from './data-table'
import { useDataTableState } from './data-table-state'
import { createColumnHelper } from './index'

type Row = { project: string; cost: number }
const col = createColumnHelper<Row>()
const ROWS: Row[] = [
  { project: 'argo', cost: 12 },
  { project: 'linewatch', cost: 3 },
]
const COLUMNS = [
  col.accessor('project', { header: 'Project' }),
  col.accessor('cost', { header: 'Cost' }),
]
const FACETS = [
  {
    columnId: 'project',
    label: 'Project',
    options: [
      { value: 'argo', label: 'Argo' },
      { value: 'linewatch', label: 'Linewatch' },
    ],
  },
]

afterEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 0,
  })
})

describe('the narrow-toolbar tier', () => {
  const observers: (() => void)[] = []
  const nativeObserver = window.ResizeObserver

  function stubLayout(): void {
    observers.length = 0
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return Number(this.dataset['testWidth'] ?? '0')
      },
    })
    class ObserverStub {
      constructor(callback: () => void) {
        observers.push(callback)
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = ObserverStub as unknown as typeof ResizeObserver
  }

  afterEach(() => {
    window.ResizeObserver = nativeObserver
  })

  async function widthOfHeader(container: HTMLElement, width: number): Promise<void> {
    const toolbar = container.querySelector('[data-basalt-tier="ctl"]')
    const header = toolbar?.parentElement
    if (!(header instanceof HTMLElement)) throw new Error('expected the header row')
    header.dataset['testWidth'] = String(width)
    await act(async () => {
      for (const fire of observers) fire()
    })
  }

  const firstSlotIsInline = (container: HTMLElement): boolean =>
    container.querySelector('[data-filter-slot]')?.hasAttribute('data-inline') === true

  function mount() {
    stubLayout()
    return render(
      <MantineProvider>
        <BasaltDataTable data={ROWS} columns={COLUMNS} facets={FACETS} />
      </MantineProvider>,
    )
  }

  test('below the regular class the facets leave the row; a zero reading keeps them inline', async () => {
    const { container } = mount()
    expect(firstSlotIsInline(container)).toBe(true)

    // An un-laid-out ancestor (the aside animating in from 0) is not a narrow table.
    await widthOfHeader(container, 0)
    expect(firstSlotIsInline(container)).toBe(true)

    await widthOfHeader(container, CONTAINER_CLASSES.regular - 1)
    expect(firstSlotIsInline(container)).toBe(false)
    expect(screen.getByRole('button', { name: 'Filters' })).toBeDefined()

    await widthOfHeader(container, CONTAINER_CLASSES.regular)
    expect(firstSlotIsInline(container)).toBe(true)
  })
})

describe('initialColumnFilters', () => {
  const SEED = [{ id: 'project', value: 'argo' }]

  test('seeds on mount, is not re-applied on re-render, and absent means none', () => {
    const { result, rerender } = renderHook(
      ({ initial }: { initial: typeof SEED | undefined }) =>
        useDataTableState({ initialColumnFilters: initial }, 10),
      { initialProps: { initial: SEED as typeof SEED | undefined } },
    )
    expect(result.current.columnFilters).toEqual(SEED)
    rerender({ initial: [{ id: 'project', value: 'linewatch' }] })
    expect(result.current.columnFilters).toEqual(SEED)

    const absent = renderHook(() => useDataTableState({}, 10))
    expect(absent.result.current.columnFilters).toEqual([])
  })

  test('onColumnFiltersChange reports later edits, not the seed', () => {
    const onChange = mock(() => {})
    const { result } = renderHook(() =>
      useDataTableState({ initialColumnFilters: SEED, onColumnFiltersChange: onChange }, 10),
    )
    expect(onChange).not.toHaveBeenCalled()
    act(() => {
      result.current.onColumnFiltersChange([])
    })
    expect(onChange).toHaveBeenCalledWith([])
    expect(result.current.columnFilters).toEqual([])
  })
})
