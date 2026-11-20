/**
 * The five parts that used to decide their layout from a size measured in the browser (ArticleLayout,
 * DataPanel, Resizable, VirtualList, Segmented), each in a probe box. `static-measured.layout.test.ts`
 * renders them to a string on the server side of the test and measures the HTML with no script, then
 * hydrates the same HTML and measures again: the two must be one picture.
 */
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { ArticleLayout } from '../../../src/page/article-layout'
import { Prose } from '../../../src/page/prose'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../../src/ui/resizable'
import { Segmented } from '../../../src/ui/segmented'
import { VirtualList } from '../../../src/ui/virtual-list'

const TASKS = ['Network policy baseline', 'Schema export tooling', 'Secrets store cutover']
const ROWS = Array.from({ length: 400 }, (_, i) => `Run ${i + 1}`)

export function Parts(): ReactElement {
  return (
    <main className="flex flex-col gap-6 p-4 text-foreground">
      <section data-testid="article">
        <ArticleLayout
          meta={{ title: 'Reading run charts', description: 'One pass.', readingTime: 4 }}
          tocItems={[
            { id: 'setup', label: 'Setup', level: 2 },
            { id: 'load', label: 'Training load', level: 2 },
          ]}
        >
          <Prose>
            <h2 id="setup">Setup</h2>
            <p>Pick a window first, then read the bars left to right.</p>
            <h2 id="load">Training load</h2>
            <p>Volume rises by at most ten percent a week.</p>
          </Prose>
        </ArticleLayout>
      </section>
      <section data-testid="panel">
        <DataPanel
          title="Open tasks"
          bodySize={{ rows: 5 }}
          body={() => (
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
              {TASKS.map((task) => (
                <li key={task}>{task}</li>
              ))}
            </ul>
          )}
        />
      </section>
      <section data-testid="resizable">
        <ResizablePanelGroup className="h-64 border">
          <ResizablePanel defaultSize="35%" minSize="20%">
            <div className="p-3 text-sm">Runs, 12</div>
          </ResizablePanel>
          <ResizableHandle grip />
          <ResizablePanel defaultSize="65%">
            <div className="p-3 text-sm">Morning run, 12.4 km</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </section>
      <section data-testid="virtual">
        <VirtualList
          className="max-h-96"
          count={ROWS.length}
          estimateSize={() => 44}
          getItemKey={(index) => index}
          initialHeight={384}
        >
          {(items) =>
            items.map((item) => (
              <div
                key={item.key}
                data-row=""
                className="flex h-11 items-center border-b px-3 text-sm"
              >
                {ROWS[item.index]}
              </div>
            ))
          }
        </VirtualList>
      </section>
      <section data-testid="segmented">
        <Segmented
          aria-label="Window"
          defaultValue="30d"
          options={[
            { value: '7d', label: '7 days' },
            { value: '30d', label: '30 days' },
            { value: '90d', label: '90 days' },
          ]}
        />
      </section>
    </main>
  )
}
