/**
 * ToolChip — one test per wire state proving it renders without throwing, plus the
 * approve/deny-visibility contract: rendered ONLY in 'approval-requested', and only for whichever
 * of onApprove/onDeny is actually supplied.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { ToolChip } from './tool-chip'
import type { ToolCallPart } from '../agent'

afterEach(cleanup)

function renderChip(part: ToolCallPart, extra: Partial<Parameters<typeof ToolChip>[0]> = {}) {
  return render(
    <MantineProvider>
      <ToolChip part={part} defaultExpanded {...extra} />
    </MantineProvider>,
  )
}

const BASE = { id: 'p1', type: 'tool' as const, toolCallId: 'c1', toolName: 'search' }

describe('every wire state renders without throwing', () => {
  const CASES: { name: string; part: ToolCallPart }[] = [
    { name: 'input-streaming', part: { ...BASE, state: 'input-streaming' } },
    { name: 'input-available', part: { ...BASE, state: 'input-available', input: { q: 'x' } } },
    {
      name: 'approval-requested',
      part: { ...BASE, state: 'approval-requested', input: { q: 'x' }, approval: { id: 'a1' } },
    },
    {
      name: 'approval-responded (approved)',
      part: {
        ...BASE,
        state: 'approval-responded',
        input: { q: 'x' },
        approval: { id: 'a1', approved: true },
      },
    },
    {
      name: 'approval-responded (declined)',
      part: {
        ...BASE,
        state: 'approval-responded',
        input: { q: 'x' },
        approval: { id: 'a1', approved: false },
      },
    },
    {
      name: 'output-available',
      part: { ...BASE, state: 'output-available', input: { q: 'x' }, output: { hits: 3 } },
    },
    {
      name: 'output-available (preliminary)',
      part: {
        ...BASE,
        state: 'output-available',
        input: { q: 'x' },
        output: { hits: 1 },
        preliminary: true,
      },
    },
    {
      name: 'output-error (with rawInput)',
      part: { ...BASE, state: 'output-error', errorText: 'boom', rawInput: { q: 'x' } },
    },
    {
      name: 'output-denied (with reason)',
      part: {
        ...BASE,
        state: 'output-denied',
        input: { q: 'x' },
        approval: { id: 'a1', approved: false, reason: 'not now' },
      },
    },
  ]

  for (const { name, part } of CASES) {
    test(name, () => {
      expect(() => renderChip(part)).not.toThrow()
    })
  }
})

describe('approve/deny affordances', () => {
  const REQUESTED: ToolCallPart = {
    ...BASE,
    state: 'approval-requested',
    input: { q: 'x' },
    approval: { id: 'a1' },
  }

  test('read-only when both handlers are omitted', () => {
    renderChip(REQUESTED)
    expect(screen.queryByText('Approve')).toBeNull()
    expect(screen.queryByText('Deny')).toBeNull()
  })

  test('renders only the supplied handler', () => {
    renderChip(REQUESTED, { onApprove: () => {} })
    expect(screen.queryByText('Approve')).not.toBeNull()
    expect(screen.queryByText('Deny')).toBeNull()
  })

  test('calls onApprove with the approval id', () => {
    let approvedId: string | undefined
    renderChip(REQUESTED, { onApprove: (id) => (approvedId = id) })
    fireEvent.click(screen.getByText('Approve'))
    expect(approvedId).toBe('a1')
  })

  test('never renders for a non-approval-requested state even with both handlers supplied', () => {
    renderChip(
      { ...BASE, state: 'output-available', input: { q: 'x' }, output: {} },
      { onApprove: () => {}, onDeny: () => {} },
    )
    expect(screen.queryByText('Approve')).toBeNull()
    expect(screen.queryByText('Deny')).toBeNull()
  })
})

// F3: a runtime value the type system believes is exhaustively handled — but isn't, once
// persisted (localStorage, zero shape validation) or wire (edenTransport, zero validation) data
// is involved — must render an inert 'unknown' chip, never throw via assertNever and blank the
// transcript.
describe('a malformed/unrecognized state never throws (F3)', () => {
  test('state undefined (the pre-1.11.0 flat persisted shape) renders "unknown" instead of throwing', () => {
    const malformed = { ...BASE, output: { hits: 1 } } as unknown as ToolCallPart
    expect(() => renderChip(malformed)).not.toThrow()
    expect(screen.getByText('unknown')).not.toBeNull()
  })

  test('an unrecognized state string renders "unknown" instead of throwing', () => {
    const malformed = { ...BASE, state: 'bogus-future-state' } as unknown as ToolCallPart
    expect(() => renderChip(malformed)).not.toThrow()
    expect(screen.getByText('unknown')).not.toBeNull()
  })
})
