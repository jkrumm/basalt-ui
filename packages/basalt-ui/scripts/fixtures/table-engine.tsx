// The engine fixture (docs/v3/concepts/data-table.md S5 input, quality-contract section 6): React +
// react-dom `createRoot` and one table on the 10-feature engine. Built beside `base0` in one run by
// `src/table/core/features.bytes.test.ts`; the difference is the engine.
import { createRoot } from 'react-dom/client'
import type { ReactNode } from 'react'
import { tableEngine } from '../../src/table/core/features'

function Engine(): ReactNode {
  const table = tableEngine.useAppTable({ columns: [], data: [] })
  return <div>{table.getRowModel().rows.length}</div>
}

const root = document.getElementById('root')
if (root !== null) createRoot(root).render(<Engine />)
