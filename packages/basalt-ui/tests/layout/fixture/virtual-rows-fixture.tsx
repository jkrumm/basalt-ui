import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { VirtualRows } from '../../../src/common/virtual-rows'
import type { VirtualRow } from '../../../src/common/virtual-rows'

const GROUP = 30

declare global {
  interface Window {
    /** Prepends `n` rows to the fixture list (W44 virtual-rows). */
    basaltVrPrepend?: (n: number) => void
  }
}

function makeRow(id: string, index: number, header: boolean): VirtualRow {
  const height = header ? 32 : 40 + (index % 5) * 8
  return {
    key: id,
    sticky: header,
    node: header ? (
      <div data-vr-header data-testid={`vr-${id}`} style={{ height }}>
        {`Group ${id}`}
      </div>
    ) : (
      <div data-vr-row data-testid={`vr-${id}`} style={{ height }}>
        {`Row ${id}`}
      </div>
    ),
  }
}

const INITIAL: VirtualRow[] = Array.from({ length: 300 }, (_, i) =>
  makeRow(`r${i}`, i, i % GROUP === 0),
)

/** Wave 44: the lazy virtual-rows seam — a fixed-height list (sticky headers, prepend anchoring)
 * or `scroll: 'parent'` against the shell's scrollport. */
export function VirtualRowsFixture({ mode }: { mode: 'height' | 'parent' }): ReactElement {
  const [rows, setRows] = useState(INITIAL)
  useEffect(() => {
    window.basaltVrPrepend = (n) =>
      setRows((prev) => [
        ...Array.from({ length: n }, (_, i) => makeRow(`p${n}-${i}`, i, false)),
        ...prev,
      ])
  }, [])
  if (mode === 'parent') {
    return (
      <div data-testid="vr-host">
        <VirtualRows scroll="parent" rows={rows} overscan={4} estimateSize={48} />
      </div>
    )
  }
  return (
    <div data-testid="vr-host">
      <VirtualRows
        height={400}
        rows={rows}
        overscan={4}
        estimateSize={48}
        anchorTo="end"
        followOnAppend
        initialScroll="start"
      />
    </div>
  )
}
