/**
 * The `ui-bar` fixture (docs/v3/concepts/primitives-distribution.md section 4, rows 33, 34, 36):
 * the toolbar, num and virtual-list primitives on their own markup, no shell and no provider, the
 * page set to `de-DE` by an `IntlScope`. It is the entry the `ui-bar` layout test bundles; the
 * harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each carrying a `data-testid`:
 * - `ui-bar-toolbar`: a Button, a group of two, a Select trigger, a Segmented and a last Button;
 *   `ui-bar-group`: the group; `ui-bar-first`, `ui-bar-plain`: a toolbar button and a `Button`;
 * - `ui-num-<null|nan|inf|finite>`: a figure each;
 * - `ui-vl`: 10 000 rows in a 256 px list; `window.uiBarPrepend()` puts 100 rows in front.
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { IntlScope } from '../../../src/core/provider-props'
import { Button } from '../../../src/ui/button'
import { Num } from '../../../src/ui/num'
import { Segmented } from '../../../src/ui/segmented'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../src/ui/select'
import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator } from '../../../src/ui/toolbar'
import { VirtualList } from '../../../src/ui/virtual-list'

const ROW = 32
type Item = { id: string }
const range = (from: number, n: number): Item[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${from + i}` }))

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
]

function Rows() {
  const [rows, setRows] = useState<Item[]>(() => range(100, 10_000))
  const [focused, setFocused] = useState<string | undefined>()
  useEffect(() => {
    ;(window as unknown as { uiBarPrepend: () => void }).uiBarPrepend = () =>
      setRows((current) => [...range(0, 100), ...current])
  }, [])
  const keepIndex = focused === undefined ? undefined : rows.findIndex((r) => r.id === focused)
  return (
    <VirtualList
      data-testid="ui-vl"
      aria-label="Rows"
      className="max-h-64 w-72 rounded-ctrl border border-border"
      count={rows.length}
      estimateSize={() => ROW}
      getItemKey={(i) => rows[i]!.id}
      keepIndex={keepIndex}
    >
      {([item]) => (
        <button
          type="button"
          data-row={rows[item!.index]!.id}
          onFocus={() => setFocused(rows[item!.index]!.id)}
          className="focus-ring block h-8 w-full px-2 text-left text-sm"
        >
          {rows[item!.index]!.id}
        </button>
      )}
    </VirtualList>
  )
}

function Fixture() {
  return (
    <IntlScope locale="de-DE">
      <main className="flex flex-col gap-8 p-4 text-foreground">
        <h1 className="text-lg font-medium">Bar</h1>
        <Toolbar aria-label="View" data-testid="ui-bar-toolbar">
          <ToolbarButton data-testid="ui-bar-first">Back</ToolbarButton>
          <ToolbarSeparator />
          <ToolbarGroup aria-label="Zoom" data-testid="ui-bar-group">
            <ToolbarButton>Fit</ToolbarButton>
            <ToolbarButton>100%</ToolbarButton>
          </ToolbarGroup>
          <Select defaultValue="30d" items={RANGES} className="w-36">
            <ToolbarButton
              render={
                <SelectTrigger aria-label="Range">
                  <SelectValue />
                </SelectTrigger>
              }
            />
            <SelectContent>
              {RANGES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Segmented
            aria-label="Mode"
            defaultValue="a"
            options={[
              { value: 'a', label: 'Grid' },
              { value: 'b', label: 'List' },
            ]}
          />
          <ToolbarButton data-testid="ui-bar-last" variant="primary">
            Export
          </ToolbarButton>
        </Toolbar>
        <Button data-testid="ui-bar-plain" variant="ghost">
          Plain
        </Button>
        <section aria-label="Figures" className="flex flex-wrap gap-4 text-sm">
          <Num data-testid="ui-num-null" value={null} />
          <Num data-testid="ui-num-nan" value={Number.NaN} />
          <Num data-testid="ui-num-inf" value={Number.POSITIVE_INFINITY} />
          <Num data-testid="ui-num-finite" value={1234.5} />
          <Num data-testid="ui-num-tone" value={-3} tone="bad" />
        </section>
        <Rows />
      </main>
    </IntlScope>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
