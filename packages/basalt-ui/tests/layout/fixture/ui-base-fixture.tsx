/**
 * The `ui-base` fixture (docs/v3/concepts/primitives-distribution.md section 4, rows 24-26 and 30):
 * skeleton, spinner, separator, kbd and scroll-area on their own markup, no shell and no provider.
 * It is the entry the `ui-base` layout test bundles; the harness is told to "mount" it by a no-op
 * `window.basaltMountFixture`, since the page renders itself on load.
 *
 * Probes, each carrying a `data-testid`:
 * - `ui-text-{sm,lg}` / `ui-skel-{sm,lg}`: a text line and the skeleton that stands for it;
 * - `ui-line-plain` / `ui-line-spin`: a text line with and without a spinner in it;
 * - `ui-sep-h`, `ui-sep-v`: the two separators (the vertical one in a flex row of `ui-row`);
 * - `ui-kbd-mod`, `ui-kbd-key`: a `Mod` key cap and a plain one;
 * - `ui-scroll-fit`, `ui-scroll-long`, `ui-scroll-wide`: a scroller whose content fits, one that
 *   overflows vertically and one that overflows horizontally; `ui-scroll-grow` fits until
 *   `ui-grow` adds rows.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Kbd } from '../../../src/ui/kbd'
import { ScrollArea } from '../../../src/ui/scroll-area'
import { Separator } from '../../../src/ui/separator'
import { Skeleton, Spinner } from '../../../src/ui/skeleton'

const ROWS = (n: number) => Array.from({ length: n }, (_, i) => <p key={i}>Row {i + 1}</p>)

function Growing() {
  const [rows, setRows] = useState(2)
  return (
    <>
      <button type="button" data-testid="ui-grow" onClick={() => setRows(40)}>
        Grow
      </button>
      <ScrollArea aria-label="Growing" className="max-h-24" data-testid="ui-scroll-grow">
        {ROWS(rows)}
      </ScrollArea>
    </>
  )
}

function Fixture() {
  return (
    <main className="flex flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">Base</h1>
      <section aria-label="Loading" className="flex flex-col gap-3">
        <p className="text-sm" data-testid="ui-text-sm">
          Quarterly revenue
        </p>
        <Skeleton className="w-40 text-sm" data-testid="ui-skel-sm" />
        <p className="text-lg" data-testid="ui-text-lg">
          Quarterly revenue
        </p>
        <Skeleton className="w-40 text-lg" data-testid="ui-skel-lg" />
        <p className="text-sm" data-testid="ui-line-plain">
          Saving
        </p>
        <p className="text-sm" data-testid="ui-line-spin">
          Saving <Spinner data-testid="ui-spin" />
        </p>
      </section>
      <section aria-label="Structure" className="flex flex-col gap-3">
        <Separator data-testid="ui-sep-h" />
        <div className="flex items-center gap-3 text-sm" data-testid="ui-row">
          Left
          <Separator orientation="vertical" data-testid="ui-sep-v" />
          Right
          <span className="flex gap-1">
            <Kbd data-testid="ui-kbd-mod">Mod</Kbd>
            <Kbd data-testid="ui-kbd-key">K</Kbd>
          </span>
        </div>
      </section>
      <section aria-label="Scrollers" className="flex min-w-0 flex-col gap-3">
        <ScrollArea aria-label="Short list" className="max-h-24" data-testid="ui-scroll-fit">
          {ROWS(2)}
        </ScrollArea>
        <ScrollArea aria-label="Long list" className="max-h-24" data-testid="ui-scroll-long">
          {ROWS(40)}
        </ScrollArea>
        <ScrollArea aria-label="Wide list" orientation="horizontal" data-testid="ui-scroll-wide">
          <p className="whitespace-nowrap">{'Wide row '.repeat(60)}</p>
        </ScrollArea>
        <Growing />
      </section>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
createRoot(container).render(<Fixture />)
