/**
 * `QueryState` exists because shipping only `EmptyState` produced a correctness bug in a real
 * consumer: a 500 rendered "No images", a dropped connection rendered "Share not found — it may
 * have been deleted". Every assertion here is aimed at that failure mode rather than at chrome.
 *
 *  1. A FAILED query never renders the empty copy. This is the bug, stated as a test.
 *  2. A failed query WITH cached data keeps the page and adds a banner — a background refetch
 *     failing must not blank a screen that already works.
 *  3. `fetchStatus: 'idle'` with no data is EMPTY, not loading (the `enabled: false` case);
 *     `'fetching'` with no data is loading.
 *  4. A result missing a branch flag THROWS. `QueryStateLike` is a structural subset on purpose,
 *     so the compiler stops policing it — and every field it can lose fails silently in the
 *     direction of a false claim about the data.
 */
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LoadingState, QueryState } from './query-state'
import type { QueryStateLike } from './query-state'

type Row = { id: number }

function result(over: Partial<QueryStateLike<Row[]>>): QueryStateLike<Row[]> {
  return {
    data: undefined,
    isError: false,
    error: null,
    fetchStatus: 'idle',
    refetch: () => undefined,
    ...over,
  }
}

const EMPTY = { title: 'No images match', description: 'Widen the capture dates.' }

function renderState(query: QueryStateLike<Row[]>, extra?: ReactNode): HTMLElement {
  const { container } = render(
    <MantineProvider>
      <QueryState query={query} empty={EMPTY} errorTitle="Could not load images">
        {(rows) => <div data-testid="body">{rows.length} rows</div>}
      </QueryState>
      {extra}
    </MantineProvider>,
  )
  return container
}

describe('the branch a 500 must not take', () => {
  test('an errored query renders the server message, never the empty copy', () => {
    renderState(
      result({ isError: true, error: { status: 500, value: { message: 'index is rebuilding' } } }),
    )
    expect(screen.getByText('index is rebuilding')).toBeTruthy()
    expect(screen.queryByText('No images match')).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  test('an opaque 500 envelope falls back to the errorTitle copy plus the status', () => {
    render(
      <MantineProvider>
        <QueryState
          query={result({ isError: true, error: { status: 500, value: {} } })}
          errorTitle="Could not load images"
          errorFallback="The library did not answer."
        >
          {() => null}
        </QueryState>
      </MantineProvider>,
    )
    expect(screen.getByText('The library did not answer. (HTTP 500)')).toBeTruthy()
  })

  test('retry calls refetch', () => {
    let calls = 0
    renderState(result({ isError: true, error: new Error('down'), refetch: () => ++calls }))
    ;(screen.getByRole('button', { name: 'Retry' }) as HTMLButtonElement).click()
    expect(calls).toBe(1)
  })
})

describe('cached data survives a failed refresh', () => {
  test('error WITH data renders the body plus a banner, not the error page', () => {
    renderState(result({ data: [{ id: 1 }], isError: true, error: new Error('refresh failed') }))
    expect(screen.getByTestId('body').textContent).toBe('1 rows')
    expect(screen.getByText('Showing cached data')).toBeTruthy()
  })
})

describe('empty vs loading', () => {
  test('no data + idle is EMPTY (the enabled:false case)', () => {
    renderState(result({ fetchStatus: 'idle' }))
    expect(screen.getByText('No images match')).toBeTruthy()
  })

  test('no data + fetching is LOADING', () => {
    renderState(result({ fetchStatus: 'fetching' }))
    expect(screen.queryByText('No images match')).toBeNull()
    expect(screen.getByLabelText('Loading')).toBeTruthy()
  })

  test('an empty array is empty; a populated one renders children', () => {
    renderState(result({ data: [] }))
    expect(screen.getByText('No images match')).toBeTruthy()
  })

  test('isEmpty overrides the default test', () => {
    render(
      <MantineProvider>
        <QueryState query={result({ data: [] })} empty={EMPTY} isEmpty={() => false}>
          {(rows) => <div data-testid="body">{rows.length} rows</div>}
        </QueryState>
      </MantineProvider>,
    )
    expect(screen.getByTestId('body').textContent).toBe('0 rows')
  })

  test('omitting `empty` renders nothing rather than inventing copy', () => {
    render(
      <MantineProvider>
        <QueryState query={result({ data: [] })}>{() => <div>rows</div>}</QueryState>
      </MantineProvider>,
    )
    expect(screen.queryByText('rows')).toBeNull()
  })
})

// `renderToStaticMarkup` for the same reason `empty-state.test.tsx` gives: happy-dom rejects a
// `paddingBlock` inline style whose value nests `var()` inside `calc()` at style set-time, so a
// real render drops the property from the DOM entirely and asserts nothing.
describe('LoadingState "page" padding is a var()-based calc expression', () => {
  test('never a frozen px literal', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <LoadingState />
      </MantineProvider>,
    )
    expect(html).toContain('var(--vx-space-stack-xs')
    expect(html).toContain('calc(')
    expect(html).not.toMatch(/padding-block:\s*64px/)
  })

  test('"section" renders the bare loader with no padding wrapper', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <LoadingState tier="section" />
      </MantineProvider>,
    )
    expect(html).not.toContain('padding-block')
  })
})

describe('common props (`common/props.ts`)', () => {
  test('className reaches the QueryState empty-branch root', () => {
    const { container } = render(
      <MantineProvider>
        <QueryState query={result({ fetchStatus: 'idle' })} empty={EMPTY} className="my-qs">
          {() => null}
        </QueryState>
      </MantineProvider>,
    )
    expect(container.querySelector('.my-qs')).toBeTruthy()
  })

  // One slot, four branches — `classNames.root` has to reach whichever one is live, and it joins
  // `className` rather than replacing it.
  test('classNames.root joins className on every branch it can render', () => {
    const branches: [string, QueryStateLike<Row[]>][] = [
      ['empty', result({ fetchStatus: 'idle' })],
      ['loading', result({ fetchStatus: 'fetching' })],
      ['error with no data', result({ isError: true, error: new Error('boom') })],
      ['cached data behind a failed refetch', result({ isError: true, data: [{ id: 1 }] })],
    ]
    for (const [, query] of branches) {
      const { container, unmount } = render(
        <MantineProvider>
          <QueryState
            query={query}
            empty={EMPTY}
            className="my-qs"
            classNames={{ root: 'slot-qs' }}
          >
            {() => <div>rows</div>}
          </QueryState>
        </MantineProvider>,
      )
      const root = container.querySelector('.slot-qs')
      expect(root).toBeTruthy()
      expect(root?.classList.contains('my-qs')).toBe(true)
      unmount()
    }
  })

  test('className reaches LoadingState', () => {
    const { container } = render(
      <MantineProvider>
        <LoadingState className="my-loading" />
      </MantineProvider>,
    )
    expect(container.querySelector('.my-loading')).toBeTruthy()
  })
})

describe('a malformed result throws instead of asserting absence', () => {
  const cases: [string, unknown][] = [
    ['missing isError', { data: undefined, error: null, fetchStatus: 'idle', refetch: () => 0 }],
    [
      'misspelled fetchStatus',
      { data: undefined, isError: false, error: null, fetchStatus: 'pending', refetch: () => 0 },
    ],
    ['missing refetch', { data: undefined, isError: false, error: null, fetchStatus: 'idle' }],
    ['not an object at all', ['a', 'b']],
  ]

  for (const [name, bad] of cases) {
    test(name, () => {
      expect(() =>
        render(
          <MantineProvider>
            <QueryState query={bad as QueryStateLike<Row[]>} empty={EMPTY}>
              {() => null}
            </QueryState>
          </MantineProvider>,
        ),
      ).toThrow(/QueryState: `query`/)
    })
  }
})

/**
 * `tier` is the package's word for "how loud is this" on `WidgetHeader` and `CtlSlot` too.
 */
const spinnerOnly = (markup: string): boolean => !markup.includes('padding-block')

describe('tier', () => {
  test('tier="section" renders the compact branch', () => {
    expect(
      spinnerOnly(
        renderToStaticMarkup(
          <MantineProvider>
            <LoadingState tier="section" />
          </MantineProvider>,
        ),
      ),
    ).toBe(true)
  })

  test('omitted falls back to page', () => {
    expect(
      spinnerOnly(
        renderToStaticMarkup(
          <MantineProvider>
            <LoadingState />
          </MantineProvider>,
        ),
      ),
    ).toBe(false)
  })
})
