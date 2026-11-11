import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { Card, CardPhase } from '../ui/card'
import { resolvePhase } from './phase'
import type { FrameState, PhaseTag } from './phase'
import { PhaseBoundary } from './phase-boundary'
import type { Phase, QueryStateLike } from './ports'

afterEach(cleanup)

const query = (over: Partial<QueryStateLike> = {}): QueryStateLike => ({
  isPending: false,
  isError: false,
  error: null,
  ...over,
})

describe('resolvePhase', () => {
  const rows: Array<[string, FrameState, PhaseTag]> = [
    ['no phase', {}, 'ready'],
    ['ready', { phase: 'ready' }, 'ready'],
    ['loading', { phase: 'loading' }, 'loading'],
    ['stale', { phase: 'stale' }, 'stale'],
    ['error', { phase: { tag: 'error' } }, 'error'],
    ['pending query', { phase: query({ isPending: true }) }, 'loading'],
    ['settled query', { phase: query() }, 'ready'],
    ['failed query', { phase: query({ isError: true, error: new Error('x') }) }, 'error'],
    ['placeholder data', { phase: query({ isPlaceholderData: true }) }, 'stale'],
    ['failed refetch', { phase: query({ isError: true, isRefetchError: true }) }, 'stale'],
    ['empty on a settled query', { phase: query(), empty: { cause: 'None' } }, 'empty'],
    ['empty with no phase', { empty: { cause: 'None' } }, 'empty'],
    ['empty on stale data', { phase: 'stale', empty: { cause: 'None' } }, 'empty'],
    ['loading beats empty', { phase: 'loading', empty: { cause: 'None' } }, 'loading'],
    [
      'pending query beats empty',
      { phase: query({ isPending: true }), empty: { cause: 'None' } },
      'loading',
    ],
    ['error beats empty', { phase: { tag: 'error' }, empty: { cause: 'None' } }, 'error'],
    ['null empty is no empty', { phase: 'ready', empty: null }, 'ready'],
  ]
  for (const [name, input, tag] of rows) {
    test(`${name} resolves to ${tag}`, () => {
      expect(resolvePhase(input).tag).toBe(tag)
    })
  }

  test('only ready and stale run the body', () => {
    const phases: Phase[] = ['ready', 'loading', 'stale', { tag: 'error' }]
    const body = phases.map((phase) => resolvePhase({ phase }).body)
    expect(body).toEqual([true, false, true, false])
  })

  test('a 403 or 404 on the query error sets the kind; forbidden drops Retry', () => {
    const refetch = (): void => {}
    const forbidden = resolvePhase({
      phase: query({ isError: true, error: { status: 403 }, refetch }),
    })
    const missing = resolvePhase({
      phase: query({ isError: true, error: { status: 404 }, refetch }),
    })
    const other = resolvePhase({ phase: query({ isError: true, error: { status: 500 }, refetch }) })
    expect(forbidden).toMatchObject({ tag: 'error', kind: 'forbidden' })
    expect(forbidden).not.toHaveProperty('retry')
    expect(missing).toMatchObject({ tag: 'error', kind: 'not-found' })
    expect(missing).toHaveProperty('retry')
    expect(other).not.toHaveProperty('kind')
  })

  test('the retry of a query error calls refetch', () => {
    let calls = 0
    const resolved = resolvePhase({
      phase: query({ isError: true, refetch: () => ++calls }),
    })
    if (resolved.tag !== 'error') throw new Error('expected error')
    resolved.retry?.()
    expect(calls).toBe(1)
  })
})

const BOOM = 'slot exploded'

function Boom(): never {
  throw new Error(BOOM)
}

describe('PhaseBoundary', () => {
  let errors: ReturnType<typeof spyOn>
  beforeEach(() => {
    // React reports a caught render error through console.error; the throw is the test's point.
    errors = spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => errors.mockRestore())

  test('renders the fallback for a throwing child and resets on demand', () => {
    let broken = true
    const Maybe = (): string => {
      if (broken) throw new Error(BOOM)
      return 'recovered'
    }
    render(
      <PhaseBoundary
        fallback={({ error, reset }) => <button onClick={reset}>{(error as Error).message}</button>}
      >
        <Maybe />
      </PhaseBoundary>,
    )
    expect(screen.getByRole('button').textContent).toBe(BOOM)
    broken = false
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('recovered')).toBeTruthy()
  })
})

describe('CardPhase', () => {
  let errors: ReturnType<typeof spyOn>
  beforeEach(() => {
    errors = spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => errors.mockRestore())

  const phaseOf = (container: ParentNode): string | null =>
    container.querySelector('[data-slot="card-phase"]')?.getAttribute('data-phase') ?? null

  test('a throwing box slot renders the error arm, a sibling card still renders, Retry resets', () => {
    let broken = true
    const Slot = (): string => {
      if (broken) return Boom()
      return 'chart'
    }
    const { container } = render(
      <>
        <Card data-testid="bad">
          <CardPhase height={72}>{() => <Slot />}</CardPhase>
        </Card>
        <Card data-testid="sibling">
          <CardPhase height={72}>{() => 'neighbour'}</CardPhase>
        </Card>
      </>,
    )
    expect(screen.getByRole('alert').textContent).toContain('Could not load this.')
    expect(screen.getByText('neighbour')).toBeTruthy()
    expect(container.querySelectorAll('[data-phase="error"]')).toHaveLength(1)

    broken = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('chart')).toBeTruthy()
    expect(screen.getByText('neighbour')).toBeTruthy()
  })

  test('the body is called only in ready and stale, with the final box', () => {
    const calls: unknown[] = []
    const slot = (box: unknown): string => {
      calls.push(box)
      return 'body'
    }
    const states: FrameState[] = [
      { phase: 'loading' },
      { phase: { tag: 'error' } },
      { phase: 'ready', empty: { cause: 'None' } },
      { phase: 'ready' },
      { phase: 'stale' },
    ]
    for (const state of states) {
      render(
        <CardPhase height={72} {...state}>
          {slot}
        </CardPhase>,
      )
      cleanup()
    }
    expect(calls).toEqual([
      { height: 72, phase: 'ready' },
      { height: 72, phase: 'stale' },
    ])
  })

  test('data-phase prints every phase', () => {
    const printed = (props: FrameState): string | null => {
      const { container, unmount } = render(<CardPhase {...props}>x</CardPhase>)
      const tag = phaseOf(container)
      unmount()
      return tag
    }
    expect([
      printed({}),
      printed({ phase: 'loading' }),
      printed({ phase: 'stale' }),
      printed({ phase: { tag: 'error' } }),
      printed({ empty: { cause: 'None' } }),
    ]).toEqual(['ready', 'loading', 'stale', 'error', 'empty'])
  })

  test('the loading arm holds the final box and hides from assistive tech', () => {
    const { container } = render(
      <CardPhase phase="loading" height={72} skeleton={{ rows: 3 }}>
        {() => 'never'}
      </CardPhase>,
    )
    const region = container.querySelector<HTMLElement>('[data-slot="card-phase"]')
    expect(region?.style.height).toBe('72px')
    expect(region?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelectorAll('[aria-hidden="true"] > div')).toHaveLength(3)
    expect(screen.queryByText('never')).toBeNull()
  })

  test('a 403 shows no Retry, a 404 says it is gone, a plain error offers Retry', () => {
    const retry = (): void => {}
    const { rerender } = render(
      <CardPhase phase={{ tag: 'error', kind: 'forbidden', retry }}>{() => 'x'}</CardPhase>,
    )
    expect(screen.getByRole('alert').textContent).toContain('do not have access')
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()

    rerender(<CardPhase phase={{ tag: 'error', kind: 'not-found', retry }}>{() => 'x'}</CardPhase>)
    expect(screen.getByRole('alert').textContent).toContain('no longer exists')

    rerender(<CardPhase phase={{ tag: 'error', retry }}>{() => 'x'}</CardPhase>)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  })

  test('the empty arm names its cause; a filtered empty offers Clear filters', () => {
    let reset = 0
    const { rerender } = render(
      <CardPhase empty={{ cause: 'No merges yet', action: { label: 'Open board', href: '/b' } }}>
        {() => 'x'}
      </CardPhase>,
    )
    expect(screen.getByText('No merges yet')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open board' }).getAttribute('href')).toBe('/b')

    rerender(
      <CardPhase empty={{ cause: 'No results', filtered: { reset: () => ++reset } }}>
        {() => 'x'}
      </CardPhase>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(reset).toBe(1)
  })

  test('stale draws the body and a status line', () => {
    render(<CardPhase phase="stale">{() => 'old data'}</CardPhase>)
    expect(screen.getByText('old data')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Updating')
  })
})
