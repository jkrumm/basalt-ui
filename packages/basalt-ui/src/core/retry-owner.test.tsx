/**
 * Expression cycle 12 (`v3-expr-12-kit-fixes` 6): separate frames that share one source draw one
 * Retry. The source is the `retry` function the page hands every frame.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { StatCell } from '../cards/stat-cell'
import { StatGroup } from '../cards/stat-group'
import { ChartCard } from '../charts'
import { Card, CardPhase } from '../ui/card'
import { resolvePhase } from './phase'
import type { Phase, QueryStateLike } from './ports'

afterEach(cleanup)

const failed = (retry: () => void): Phase => ({ tag: 'error', retry })

function Panel({ phase, title }: { phase: Phase | QueryStateLike; title: string }) {
  return (
    <Card aria-label={title}>
      <CardPhase phase={phase} height={72}>
        {() => null}
      </CardPhase>
    </Card>
  )
}

const buttons = () => screen.queryAllByRole('button', { name: 'Retry' })

describe('one Retry across frames', () => {
  test('three frames on one retry draw one button and one click runs it once', () => {
    const retry = mock(() => undefined)
    const phase = failed(retry)
    const { container } = render(
      <>
        <Panel phase={phase} title="A" />
        <Panel phase={phase} title="B" />
        <Panel phase={phase} title="C" />
      </>,
    )
    expect(container.querySelectorAll('[role="alert"]').length).toBe(3)
    expect(buttons().length).toBe(1)
    fireEvent.click(buttons()[0] as HTMLElement)
    expect(retry).toHaveBeenCalledTimes(1)
  })

  test('the first mounted frame owns the button', () => {
    const phase = failed(() => undefined)
    const { container } = render(
      <>
        <Panel phase={phase} title="A" />
        <Panel phase={phase} title="B" />
      </>,
    )
    const [first, second] = [...container.querySelectorAll('[role="alert"]')]
    expect(first?.querySelector('button')).not.toBeNull()
    expect(second?.querySelector('button')).toBeNull()
  })

  test('frames on one query result share one stable retry', () => {
    const refetch = mock(() => undefined)
    const query: QueryStateLike = {
      isPending: false,
      isError: true,
      error: new Error('x'),
      refetch,
    }
    const a = resolvePhase({ phase: query })
    const b = resolvePhase({ phase: query })
    expect(a.tag === 'error' && b.tag === 'error' && a.retry === b.retry).toBe(true)
    render(
      <>
        <Panel phase={query} title="A" />
        <Panel phase={query} title="B" />
      </>,
    )
    expect(buttons().length).toBe(1)
    fireEvent.click(buttons()[0] as HTMLElement)
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test('different retries stay two buttons', () => {
    render(
      <>
        <Panel phase={failed(() => undefined)} title="A" />
        <Panel phase={failed(() => undefined)} title="B" />
      </>,
    )
    expect(buttons().length).toBe(2)
  })

  test('the next frame takes the button when the owner unmounts', () => {
    const phase = failed(() => undefined)
    const { rerender } = render(
      <>
        <Panel key="a" phase={phase} title="A" />
        <Panel key="b" phase={phase} title="B" />
      </>,
    )
    expect(buttons().length).toBe(1)
    rerender(<Panel key="b" phase={phase} title="B" />)
    expect(buttons().length).toBe(1)
  })

  test('a frame that recovers hands nothing away and a lone frame keeps its button', () => {
    const phase = failed(() => undefined)
    const { rerender } = render(
      <>
        <Panel phase={phase} title="A" />
        <Panel phase={phase} title="B" />
      </>,
    )
    rerender(
      <>
        <Panel phase="ready" title="A" />
        <Panel phase={phase} title="B" />
      </>,
    )
    expect(buttons().length).toBe(1)
  })

  test('a ChartCard keeps its own button; a panel and a stat cell on its retry share one', () => {
    const retry = mock(() => undefined)
    const phase = failed(retry)
    render(
      <>
        <Panel phase={phase} title="Panel" />
        <ChartCard title="Revenue" phase={phase} chart={() => null} />
        <StatCell label="Orders" phase={phase} />
      </>,
    )
    expect(buttons().length).toBe(2)
    fireEvent.click(buttons()[1] as HTMLElement)
    expect(retry).toHaveBeenCalledTimes(1)
  })

  test('a group banner and a panel on one retry draw one button', () => {
    const retry = mock(() => undefined)
    const phase = failed(retry)
    render(
      <>
        <StatGroup variant="cards" label="Link health">
          <StatCell label="Downstream" phase={phase} />
          <StatCell label="Upstream" phase={phase} />
        </StatGroup>
        <Panel phase={phase} title="Panel" />
      </>,
    )
    expect(buttons().length).toBe(1)
    fireEvent.click(buttons()[0] as HTMLElement)
    expect(retry).toHaveBeenCalledTimes(1)
  })

  test('a forbidden frame draws no button and does not take the owner seat', () => {
    const phase = failed(() => undefined)
    render(
      <>
        <Panel phase={{ tag: 'error', kind: 'forbidden', retry: () => undefined }} title="A" />
        <Panel phase={phase} title="B" />
      </>,
    )
    expect(buttons().length).toBe(1)
  })
})
