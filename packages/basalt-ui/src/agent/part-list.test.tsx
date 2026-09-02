/**
 * PartList's headless default tool-call renderer — a failed/denied call must stay visible.
 *
 * Regression coverage: after the seven-state ToolCallPart split, `output-error` carries no
 * `output` field, so the old `part.state === 'output-available'`-only body left a failed call
 * rendering as name+input and nothing else — the failure was silently invisible. Same gap for
 * `output-denied`, indistinguishable from a still-pending call.
 *
 * Plus the `settled` flag's forwarding contract — the field that lets a text renderer drop out of
 * streaming mode once the message it belongs to has finished.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { PartList } from './part-list'
import type { PartListProps } from './part-list'
import type { AgentPart, ToolCallPart } from './parts'

afterEach(cleanup)

const BASE = { id: 'p1', type: 'tool' as const, toolCallId: 'c1', toolName: 'search' }

describe('DefaultToolCall — terminal states stay visible', () => {
  test('output-error renders the errorText', () => {
    const part: ToolCallPart = { ...BASE, state: 'output-error', errorText: 'boom' }
    render(<PartList parts={[part]} />)
    expect(screen.getByText('boom')).not.toBeNull()
  })

  test('output-error with no validated input falls back to rendering rawInput', () => {
    const part: ToolCallPart = {
      ...BASE,
      state: 'output-error',
      errorText: 'boom',
      rawInput: { q: 'x' },
    }
    render(<PartList parts={[part]} />)
    expect(screen.getByText(/"q": "x"/)).not.toBeNull()
  })

  test('output-error with validated input present does not also render rawInput', () => {
    const part: ToolCallPart = {
      ...BASE,
      state: 'output-error',
      errorText: 'boom',
      input: { q: 'x' },
      rawInput: { q: 'stale' },
    }
    render(<PartList parts={[part]} />)
    expect(screen.queryByText(/stale/)).toBeNull()
  })

  test('output-denied is visibly denied, not indistinguishable from a pending call', () => {
    const part: ToolCallPart = {
      ...BASE,
      state: 'output-denied',
      input: { q: 'x' },
      approval: { id: 'a1', approved: false, reason: 'too risky' },
    }
    render(<PartList parts={[part]} />)
    expect(screen.getByText(/Denied/)).not.toBeNull()
    expect(screen.getByText(/too risky/)).not.toBeNull()
  })

  test('output-denied with no reason still renders a visible denial', () => {
    const part: ToolCallPart = {
      ...BASE,
      state: 'output-denied',
      input: { q: 'x' },
      approval: { id: 'a1', approved: false },
    }
    render(<PartList parts={[part]} />)
    expect(screen.getByText('Denied')).not.toBeNull()
  })

  test('output-available is unaffected — still renders output, no error/denied line', () => {
    const part: ToolCallPart = {
      ...BASE,
      state: 'output-available',
      input: { q: 'x' },
      output: { hits: 3 },
    }
    render(<PartList parts={[part]} />)
    expect(screen.getByText(/"hits": 3/)).not.toBeNull()
    expect(screen.queryByText(/Denied/)).toBeNull()
  })
})

describe('settled — forwarded to every renderer', () => {
  const TEXT: AgentPart = { id: 't1', type: 'text', text: 'hello' }

  function settledProbe() {
    const seen: boolean[] = []
    const components = {
      text: ({ settled }: { settled: boolean }) => {
        seen.push(settled)
        return <div data-testid="probe">{String(settled)}</div>
      },
    }
    return { seen, components }
  }

  test('defaults to true — a caller that knows nothing about a run renders a finished list', () => {
    const { seen, components } = settledProbe()
    render(<PartList parts={[TEXT]} components={components} />)
    expect(seen).toEqual([true])
  })

  test('an explicit settled={false} reaches the renderer', () => {
    const { seen, components } = settledProbe()
    render(<PartList parts={[TEXT]} components={components} settled={false} />)
    expect(seen).toEqual([false])
  })
})

describe('assertRequiredProps (F-ERR-1)', () => {
  test('a missing `parts` throws a named message, not a raw TypeError', () => {
    expect(() => {
      render(<PartList {...({} as unknown as PartListProps)} />)
    }).toThrow('[basalt] PartList: prop "parts" is required')
  })
})
