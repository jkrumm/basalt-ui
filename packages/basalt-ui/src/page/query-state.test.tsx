/**
 * `QueryState` exists because a wrapper that renders only the empty branch steers every page into
 * showing "nothing here" for "the server failed". Every assertion is aimed at that failure mode:
 *
 *  1. A failed query never renders the empty copy.
 *  2. A failed refetch over data keeps the data and adds a banner.
 *  3. A pending query is loading even when `empty` is set; `empty` applies once it settled.
 *  4. A paused fetch with nothing to show reads Offline, never an endless spinner.
 *  5. A 403 reads forbidden with no retry; a 404 reads not-found.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import type { Phase, QueryStateLike } from '../core/ports'
import { IntlScope } from '../core/provider-props'
import { QueryState } from './query-state'
import type { QueryStateProps } from './query-state'

afterEach(cleanup)

type Result = QueryStateLike & { fetchStatus?: 'fetching' | 'paused' | 'idle' }

function result(over: Partial<Result>): Result {
  return { isPending: false, isError: false, error: null, refetch: () => undefined, ...over }
}

const BODY = <div data-testid="body">rows</div>

function show(phase: QueryStateProps['phase'], extra: Partial<QueryStateProps> = {}) {
  return render(
    <QueryState phase={phase} {...extra}>
      {BODY}
    </QueryState>,
  )
}

const tag = (): string | undefined =>
  document.querySelector<HTMLElement>('[data-slot="query-state"]')?.dataset['phase']
const body = (): HTMLElement | null => screen.queryByTestId('body')

describe('the branch a 500 must not take', () => {
  test('a failed query renders the error line, never the empty copy', () => {
    show(result({ isError: true, error: new Error('index is rebuilding') }), {
      empty: { cause: 'No images match' },
    })
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.getByText('Could not load this.')).toBeDefined()
    expect(screen.queryByText('No images match')).toBeNull()
    expect(body()).toBeNull()
  })

  test('an Error message shows under the line when there is no kind', () => {
    show(result({ isError: true, error: new Error('index is rebuilding') }))
    expect(screen.getByText('index is rebuilding')).toBeDefined()
  })

  test('retry calls refetch', () => {
    const refetch = mock(() => undefined)
    show(result({ isError: true, error: new Error('down'), refetch }))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test('no refetch, no retry button', () => {
    const { refetch: _drop, ...noRefetch } = result({ isError: true, error: new Error('x') })
    show(noRefetch)
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  test('a Phase error carries its own retry', () => {
    const retry = mock(() => {})
    show({ tag: 'error', retry })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe('error kinds', () => {
  test('a 403 reads forbidden and offers no retry', () => {
    show(result({ isError: true, error: { status: 403 } }))
    expect(screen.getByText('You do not have access to this.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  test('a 404 reads not-found and keeps retry', () => {
    show(result({ isError: true, error: { status: 404 } }))
    expect(screen.getByText('This no longer exists.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined()
  })

  test('a Phase error of kind forbidden reads forbidden', () => {
    show({ tag: 'error', kind: 'forbidden' })
    expect(screen.getByText('You do not have access to this.')).toBeDefined()
  })

  test('a Phase error of kind not-found reads not-found', () => {
    show({ tag: 'error', kind: 'not-found' })
    expect(screen.getByText('This no longer exists.')).toBeDefined()
  })

  test('a kind hides the raw message', () => {
    show({ tag: 'error', kind: 'forbidden', message: 'token expired at 12:01' })
    expect(screen.queryByText('token expired at 12:01')).toBeNull()
  })

  test('a Phase error message shows when there is no kind', () => {
    show({ tag: 'error', message: 'the library did not answer' })
    expect(screen.getByText('the library did not answer')).toBeDefined()
  })

  test('an app overrides the forbidden line', () => {
    render(
      <IntlScope messages={{ 'home.error.forbidden': 'Kein Zugriff.' }}>
        <QueryState phase={{ tag: 'error', kind: 'forbidden' }}>{BODY}</QueryState>
      </IntlScope>,
    )
    expect(screen.getByText('Kein Zugriff.')).toBeDefined()
  })
})

describe('offline', () => {
  test('pending and paused with no data reads Offline', () => {
    show(result({ isPending: true, fetchStatus: 'paused' }))
    expect(screen.getByRole('status').textContent).toBe(
      'You are offline. This loads when the connection is back.',
    )
    expect(tag()).toBe('offline')
  })

  test('pending and fetching is loading, not offline', () => {
    show(result({ isPending: true, fetchStatus: 'fetching' }))
    expect(tag()).toBe('loading')
    expect(screen.queryByText(/offline/i)).toBeNull()
  })

  test('pending with no fetchStatus is loading', () => {
    show(result({ isPending: true }))
    expect(tag()).toBe('loading')
  })

  test('paused with data in hand is not offline', () => {
    show(result({ isPending: false, fetchStatus: 'paused' }))
    expect(body()).not.toBeNull()
    expect(tag()).toBe('ready')
  })

  test('offline wins over the empty prop: a paused fetch has not settled', () => {
    show(result({ isPending: true, fetchStatus: 'paused' }), { empty: { cause: 'No images' } })
    expect(screen.queryByText('No images')).toBeNull()
    expect(tag()).toBe('offline')
  })

  test('an app overrides the offline copy', () => {
    render(
      <IntlScope messages={{ 'home.offline': 'Offline.' }}>
        <QueryState phase={result({ isPending: true, fetchStatus: 'paused' })}>{BODY}</QueryState>
      </IntlScope>,
    )
    expect(screen.getByText('Offline.')).toBeDefined()
  })
})

describe('loading', () => {
  test('a pending query is a spinner named Loading', () => {
    show(result({ isPending: true }))
    expect(screen.getByRole('status', { name: 'Loading' })).toBeDefined()
    expect(body()).toBeNull()
  })

  test('the loading phase is the same spinner', () => {
    show('loading')
    expect(tag()).toBe('loading')
  })

  test('a pending query is loading even with `empty` set', () => {
    show(result({ isPending: true }), { empty: { cause: 'No images' } })
    expect(screen.queryByText('No images')).toBeNull()
    expect(tag()).toBe('loading')
  })

  test('`loading` replaces the spinner', () => {
    show('loading', { loading: <div data-testid="skel" /> })
    expect(screen.getByTestId('skel')).toBeDefined()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('empty', () => {
  test('a settled query with `empty` renders the empty state', () => {
    show(result({}), { empty: { cause: 'No images match' } })
    expect(screen.getByText('No images match')).toBeDefined()
    expect(body()).toBeNull()
    expect(tag()).toBe('empty')
  })

  test('the empty action reaches the empty state', () => {
    const onSelect = mock(() => {})
    show(result({}), { empty: { cause: 'None', action: { label: 'Add one', onSelect } } })
    fireEvent.click(screen.getByRole('button', { name: 'Add one' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  test('a filtered empty renders Clear filters', () => {
    const reset = mock(() => {})
    show(result({}), { empty: { cause: 'Filters hid all 12.', filtered: { reset } } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  test('`empty: null` renders the children', () => {
    show(result({}), { empty: null })
    expect(body()).not.toBeNull()
  })

  test('without `empty` the children render: the page decides what empty means', () => {
    show(result({}))
    expect(body()).not.toBeNull()
  })

  test('the tier reaches the empty state', () => {
    show(result({}), { empty: { cause: 'x' }, tier: 'section' })
    expect(document.querySelector<HTMLElement>('[data-slot="empty-state"]')?.dataset['tier']).toBe(
      'section',
    )
  })
})

describe('cached data survives a failed refresh', () => {
  const stale = (refetch: () => unknown = () => undefined): Result =>
    result({ isError: true, isRefetchError: true, error: new Error('refresh failed'), refetch })

  test('a refetch error renders the body plus a banner, not the error page', () => {
    show(stale())
    expect(body()).not.toBeNull()
    expect(screen.getByText('Showing saved data. The last refresh failed.')).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('the banner retries', () => {
    const refetch = mock(() => undefined)
    show(stale(refetch))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test('an empty prop still wins over the stale body', () => {
    show(stale(), { empty: { cause: 'No images' } })
    expect(screen.getByText('No images')).toBeDefined()
  })

  test('the stale phase renders the body without a banner', () => {
    show('stale')
    expect(body()).not.toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(tag()).toBe('stale')
  })

  test('placeholder data is stale and renders the body', () => {
    show(result({ isPlaceholderData: true }))
    expect(body()).not.toBeNull()
    expect(tag()).toBe('stale')
  })
})

describe('ready', () => {
  test.each<[string, QueryStateProps['phase']]>([
    ['the ready phase', 'ready'],
    ['a settled query', result({})],
  ])('%s renders the children', (_, phase) => {
    show(phase)
    expect(body()).not.toBeNull()
    expect(tag()).toBe('ready')
  })

  test('the root carries the slot and the phase', () => {
    show('ready')
    const root = document.querySelector('[data-slot="query-state"]')
    expect(root?.getAttribute('data-phase')).toBe('ready')
  })
})

describe('data-phase prints every branch it can reach', () => {
  const cases: [string, QueryStateProps['phase'], string, Partial<QueryStateProps>?][] = [
    ['ready', 'ready', 'ready'],
    ['loading', 'loading', 'loading'],
    ['stale', 'stale', 'stale'],
    ['error', { tag: 'error' } satisfies Phase, 'error'],
    ['offline', result({ isPending: true, fetchStatus: 'paused' }), 'offline'],
    ['empty', result({}), 'empty', { empty: { cause: 'x' } }],
  ]
  for (const [name, phase, expected, extra] of cases) {
    test(name, () => {
      show(phase, extra)
      expect(tag()).toBe(expected)
    })
  }
})

describe('the tier', () => {
  test('error and offline notices take the page padding by default and the section padding in a card', () => {
    show({ tag: 'error' })
    expect(screen.getByRole('alert').className).toContain('py-16')
    cleanup()
    show({ tag: 'error' }, { tier: 'section' })
    expect(screen.getByRole('alert').className).toContain('py-8')
  })

  test('the error notice is a role=alert region', () => {
    show({ tag: 'error' })
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})

describe('server render', () => {
  test('a loading query renders the spinner markup', () => {
    expect(renderToString(<QueryState phase="loading">{BODY}</QueryState>)).toContain(
      'data-slot="spinner"',
    )
  })

  test('an error renders its line and no body', () => {
    const html = renderToString(<QueryState phase={{ tag: 'error' }}>{BODY}</QueryState>)
    expect(html).toContain('Could not load this.')
    expect(html).not.toContain('data-testid="body"')
  })
})
