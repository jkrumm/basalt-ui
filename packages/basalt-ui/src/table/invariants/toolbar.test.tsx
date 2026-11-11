/**
 * Pinned 2.x invariant that the v3 toolbar and bulk bar flip (Issue t3, docs/v3/concepts/
 * data-table.md section 8; evidence: docs/v3/evidence/self-table-data.md). `test.failing` until
 * the flipper lands; the flipper turns it into a plain `test`.
 *
 *   I22  bulk bar renders only while rows are selected, memoized per row set   t3
 */
import { cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { renderTable } from './harness'

afterEach(cleanup)

describe('toolbar invariants', () => {
  // 2.x: data-table.tsx:505-520,804-816,1620-1640
  test.failing('I22 the bulk bar exists only while a row is ticked', () => {
    const bulk = [{ key: 'x', label: 'Act', onClick: mock(() => undefined) }]
    const { container } = renderTable({ selection: { bulk } })
    expect(container.querySelector('[data-slot="table-bulk"]')).toBeNull()
    fireEvent.click(container.querySelector('tbody input[type="checkbox"]') as HTMLElement)
    expect(container.querySelector('[data-slot="table-bulk"]')).not.toBeNull()
    fireEvent.click(container.querySelector('tbody input[type="checkbox"]') as HTMLElement)
    expect(container.querySelector('[data-slot="table-bulk"]')).toBeNull()
  })
})
