/**
 * ToolChip — `RAIL_STYLE` reference stability. A DOM assertion after `render()` can't observe this:
 * React's `style` diffing is per-key, so a freshly-allocated object with identical values looks the
 * same in the DOM either way. The only way to see whether the no-override case reuses `RAIL_STYLE`
 * verbatim (one module-scope allocation) or reallocates an equivalent object every render is to read
 * the React element's `style` prop directly — which means calling `ToolChip` as a plain function
 * instead of through a mounted tree.
 *
 * `useDisclosure` is the component's only hook, so mocking it out (this file's isolated module
 * registry — `bun:test`'s `mock.module` scopes to the FILE running it, never leaking into sibling
 * test files) makes that call safe with no React dispatcher active.
 */
import { describe, expect, mock, test } from 'bun:test'
import * as mantineHooks from '@mantine/hooks'
import type { ReactElement } from 'react'
import type { ToolCallPart } from '../agent'

mock.module('@mantine/hooks', () => ({
  ...mantineHooks,
  useDisclosure: () => [false, { toggle: () => {}, open: () => {}, close: () => {} }] as const,
}))

const { ToolChip } = await import('./tool-chip')

const PART: ToolCallPart = {
  id: 'p1',
  type: 'tool',
  toolCallId: 'c1',
  toolName: 'search',
  state: 'input-available',
  input: { q: 'x' },
}

function rootStyle(element: ReactElement): unknown {
  return (element.props as { style: unknown }).style
}

describe('ToolChip RAIL_STYLE reference stability', () => {
  test('the root `style` object is the SAME reference across renders when no override is passed', () => {
    const first = ToolChip({ part: PART })
    const second = ToolChip({ part: PART })
    expect(rootStyle(first)).toBe(rootStyle(second))
  })

  test('a `style` override merges into a NEW object and leaves the base untouched', () => {
    const base = ToolChip({ part: PART })
    const overridden = ToolChip({ part: PART, style: { color: 'red' } })
    expect(rootStyle(overridden)).not.toBe(rootStyle(base))
    expect((rootStyle(overridden) as { color: string }).color).toBe('red')
  })
})
