/**
 * Pinned 2.x invariant that the v3 virtual path flips (Issue t4, docs/v3/concepts/data-table.md
 * section 8; evidence: docs/v3/evidence/self-table-data.md). `test.failing` until the flipper
 * lands; the flipper turns it into a plain `test`.
 *
 *   I26  virtual rows: item key = row id, never sorts, windowed only above 200   t4
 */
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { VirtualItem, VirtualLike } from '../../core/ports'
import { renderTable } from './harness'
import type { Row } from './harness'

afterEach(cleanup)

describe('virtual invariants', () => {
  // 2.x: virtual-rows.tsx:8-30,60-110,120-175
  test.failing(
    'I26 the virtual port keys items by row id and renders the window it is given',
    () => {
      const keys: (string | number)[] = []
      const virtual: VirtualLike = ({ count, estimateSize, getItemKey, children }) => {
        const items: VirtualItem[] = Array.from({ length: count }, (_, index) => {
          keys.push(getItemKey(index))
          return {
            index,
            key: getItemKey(index),
            start: index * estimateSize(index),
            size: estimateSize(index),
          }
        })
        return <div data-testid="window">{children(items, count * estimateSize(0))}</div>
      }
      const data: Row[] = Array.from({ length: 250 }, (_, i) => ({
        id: `r${i}`,
        name: `Row ${i}`,
        amount: i,
        state: 'Eng',
      }))
      const { container } = renderTable({ data }, { height: 'fill', virtual })
      expect(keys.slice(0, 3)).toEqual(['r0', 'r1', 'r2'])
      expect(container.querySelectorAll('tbody tr').length).toBe(250)
    },
  )
})
